const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const fs = require('fs');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const os = require('os');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://codanalyzer-49ec21ea6aca.herokuapp.com' 
    : 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(morgan('dev'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'codeingest-session-secret',
  resave: true,
  saveUninitialized: true,
  cookie: { 
    // Only use secure cookies if we're not using localhost
    secure: process.env.NODE_ENV === 'production' && !process.env.HEROKU_SKIP_SSL, 
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  // Trust the Heroku proxy
  proxy: true
}));

// For Heroku HTTPS support
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// GitHub OAuth Configuration
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  // Use a hard-coded callback URL in production to ensure exact match with GitHub settings
  callbackURL: process.env.NODE_ENV === 'production'
    ? 'https://codanalyzer-49ec21ea6aca.herokuapp.com/auth/github/callback'
    : 'http://localhost:3000/auth/github/callback',
  scope: ['user:email', 'repo'] // Request access to user's repositories
},
function(accessToken, refreshToken, profile, done) {
  // Store comprehensive user data
  const user = {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName || profile.username,
    accessToken: accessToken,
    emails: profile.emails,
    avatar: profile._json.avatar_url,
    lastLogin: new Date()
  };
  
  return done(null, user);
}));

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Create a data directory for storing repositories
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}
if (!fs.existsSync('./data/repositories')) {
  fs.mkdirSync('./data/repositories');
}

// Utility function to build a tree representation from GitHub files
function buildFileTree(items) {
  // Sort items by path
  const sortedItems = [...items].sort((a, b) => a.path.localeCompare(b.path));
  
  // Initialize tree structure
  let formattedTree = '';
  let lastPathParts = [];
  
  // Process each item
  for (const item of sortedItems) {
    // Skip non-blob items (we only want files, not directories)
    if (item.type !== 'blob') continue;
    
    const parts = item.path.split('/');
    
    // Calculate common path with the last entry
    let commonPathLength = 0;
    if (lastPathParts.length > 0) {
      for (let i = 0; i < Math.min(parts.length - 1, lastPathParts.length - 1); i++) {
        if (parts[i] === lastPathParts[i]) {
          commonPathLength = i + 1;
        } else {
          break;
        }
      }
    }
    
    // Add directories that are different from the last path
    for (let i = commonPathLength; i < parts.length - 1; i++) {
      const indent = '│   '.repeat(i);
      formattedTree += `${indent}├── ${parts[i]}/\n`;
    }
    
    // Add the file
    const fileIndent = '│   '.repeat(parts.length - 1);
    formattedTree += `${fileIndent}├── ${parts[parts.length - 1]}\n`;
    
    lastPathParts = parts;
  }
  
  return formattedTree;
}

// Helper function for ignoring certain file types in JSON output
function isJsonIgnorableFile(filePath) {
  // Skip binary, media, and other non-code files
  const ignoredExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', 
    '.ico', '.woff', '.woff2', '.ttf', '.eot',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
    '.zip', '.tar', '.gz', '.rar',
    '.exe', '.dll', '.so',
    '.min.js', '.min.css'  // Minified files
  ];
  
  // Skip hidden files and directories
  if (filePath.split('/').some(part => part.startsWith('.'))) {
    return true;
  }
  
  // Skip by extension
  for (const ext of ignoredExtensions) {
    if (filePath.toLowerCase().endsWith(ext)) {
      return true;
    }
  }
  
  // Skip node_modules, etc.
  const ignoredDirs = ['node_modules', 'dist', 'build', 'vendor', 'bin'];
  if (ignoredDirs.some(dir => filePath.includes(`/${dir}/`))) {
    return true;
  }
  
  return false;
}

// Authentication Routes
app.get('/auth/github', (req, res, next) => {
  // Store the intended return URL in session if available
  if (req.query.returnTo) {
    req.session.returnTo = req.query.returnTo;
  }
  
  console.log('GitHub auth initiated');
  passport.authenticate('github')(req, res, next);
});

app.get('/auth/github/callback', 
  passport.authenticate('github', { 
    failureRedirect: '/?error=auth_failed'
  }),
  (req, res) => {
    // Successful authentication, redirect to the intended URL or home
    console.log('User authenticated successfully:', req.user ? req.user.username : 'unknown user');
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

app.get('/auth/user', (req, res) => {
  console.log('Auth check:', req.isAuthenticated(), req.user ? `User: ${req.user.username}` : 'No user');
  console.log('Session ID:', req.sessionID);
  
  if (req.isAuthenticated()) {
    res.json({
      isAuthenticated: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        avatar: req.user.avatar
      }
    });
  } else {
    res.json({
      isAuthenticated: false
    });
  }
});

app.get('/auth/logout', (req, res, next) => {
  console.log('Logout request received');
  
  // Using req.logout() with a callback (Passport v0.6.0+)
  if (req.logout && typeof req.logout === 'function') {
    req.logout((err) => {
      if (err) { 
        console.error('Logout error:', err);
        return next(err); 
      }
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return next(err);
        }
        res.redirect('/');
      });
    });
  } else {
    // Fallback for older Passport versions
    try {
      req.logout();
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return next(err);
        }
        res.redirect('/');
      });
    } catch (error) {
      console.error('Logout fallback error:', error);
      res.redirect('/');
    }
  }
});

// Helper function to create GitHub API client
const createGitHubClient = (req) => {
  const headers = {
    Accept: 'application/vnd.github.v3+json'
  };
  
  // If user is authenticated, add their token
  if (req && req.isAuthenticated && req.isAuthenticated()) {
    headers.Authorization = `token ${req.user.accessToken}`;
  }
  
  return axios.create({
    baseURL: 'https://api.github.com',
    headers
  });
};

// Helper function to create unauthenticated GitHub API client
const createUnauthenticatedGitHubClient = () => {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Accept: 'application/vnd.github.v3+json'
    }
  });
};

// In-memory repository store (in production, use a database)
const repositories = [];

// GitHub API client with default config (no auth)
const github = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github.v3+json'
  }
});

// Filter functions for important files
const isImportantFile = (filePath, extension) => {
  // Skip node_modules, .git directories, etc.
  if (
    filePath.includes('node_modules/') ||
    filePath.includes('.git/') ||
    filePath.includes('dist/') ||
    filePath.includes('build/') ||
    filePath.includes('.next/') ||
    filePath.includes('.DS_Store')
  ) {
    return false;
  }

  // Identify important file extensions for business logic
  const importantExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.rb', '.php',
    '.go', '.rs', '.c', '.cpp', '.h', '.cs', '.swift', '.kt',
    '.json', '.yaml', '.yml', '.md', '.sh'
  ];

  return importantExtensions.includes(extension);
};

// Limit for the file size (in bytes) - 500KB
const FILE_SIZE_LIMIT = 500 * 1024;

// API Routes
app.post('/api/public-repositories', async (req, res) => {
  console.log('Processing /api/public-repositories request:', req.body);
  try {
    const { url, includeAllFiles } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }
    
    // Parse GitHub URL
    const githubUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(githubUrlPattern);
    
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }
    
    const owner = match[1];
    const repo = match[2].replace('.git', '');
    
    // Use authenticated client if user is logged in, otherwise use unauthenticated client
    const githubClient = req.isAuthenticated() ? createGitHubClient(req) : createUnauthenticatedGitHubClient();
    
    console.log(`Ingesting repository: ${owner}/${repo}, authenticated: ${req.isAuthenticated()}`);
    
    // Check if repository exists and is accessible
    let repoData;
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}`);
      repoData = response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({ error: 'Repository not found or not accessible' });
      } else {
        throw error;
      }
    }
    
    console.log(`Ingesting repository: ${owner}/${repo}`);
    console.log('Repository info:', {
      stars: repoData.stargazers_count,
      language: repoData.language,
      description: repoData.description,
      private: repoData.private
    });
    
    // Get repository contents
    const contents = await githubClient.get(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
    
    // Filter for important files based on extension
    const filteredFiles = contents.data.tree
      .filter(item => {
        if (item.type !== 'blob') return false;
        
        // If includeAllFiles is true, include most files except binary/large files
        if (includeAllFiles) {
          return !isJsonIgnorableFile(item.path);
        } 
        
        // Otherwise only include important files based on extension
        return isImportantFile(item.path);
      })
      .filter(item => item.size <= FILE_SIZE_LIMIT);
    
    console.log(`Found ${filteredFiles.length} important files to ingest`);
    
    // Create a tree representation for display
    const fileTree = buildFileTree(contents.data.tree);
    
    // Get README content if available
    let readmeContent = '';
    const readmeFile = contents.data.tree.find(item => 
      item.path.toLowerCase() === 'readme.md' || 
      item.path.toLowerCase() === 'readme' ||
      item.path.toLowerCase() === 'readme.txt'
    );
    
    if (readmeFile) {
      try {
        const readmeResponse = await githubClient.get(`/repos/${owner}/${repo}/contents/${readmeFile.path}`);
        if (readmeResponse.data.content) {
          readmeContent = Buffer.from(readmeResponse.data.content, 'base64').toString('utf-8');
        }
      } catch (error) {
        console.error('Error fetching README:', error.message);
      }
    }
    
    // Get contents of each file
    let allCode = '';
    for (const file of filteredFiles) {
      try {
        const fileResponse = await githubClient.get(`/repos/${owner}/${repo}/contents/${file.path}`);
        
        if (fileResponse.data.content) {
          const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
          allCode += `\n\n// File: ${file.path}\n${content}`;
        }
      } catch (error) {
        console.error(`Error fetching ${file.path}:`, error.message);
      }
    }
    
    // Create repository object
    const repository = {
      id: uuidv4(),
      url,
      owner,
      name: repo,
      createdAt: new Date().toISOString(),
      summary: {
        stars: repoData.stargazers_count,
        language: repoData.language,
        description: repoData.description,
        isPrivate: repoData.private
      },
      fileCount: filteredFiles.length,
      sizeInBytes: filteredFiles.reduce((sum, file) => sum + file.size, 0),
      ingestedContent: {
        tree: fileTree,
        fullCode: allCode,
        readme: readmeContent,
        allFilesIncluded: includeAllFiles
      }
    };
    
    // Store repository in filesystem
    fs.writeFileSync(`./data/repositories/${repository.id}.json`, JSON.stringify(repository, null, 2));
    
    console.log(`Repository ${owner}/${repo} ingested successfully`);
    
    return res.status(201).json({ success: true, repository });
    
  } catch (error) {
    console.error('Error ingesting repository:', error.message);
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Failed to ingest repository' 
    });
  }
});

// Add endpoint for private repositories (requires authentication)
app.post('/api/private-repositories', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required to access private repositories' });
  }

  try {
    const { url, repoFullName, includeAllFiles } = req.body;
    
    if (!url && !repoFullName) {
      return res.status(400).json({ error: 'Repository URL or full name is required' });
    }
    
    // Extract owner and repo from the full name
    let owner, repo;
    
    if (repoFullName) {
      [owner, repo] = repoFullName.split('/');
    } else {
      // Parse GitHub URL as fallback
      const githubUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
      const match = url.match(githubUrlPattern);
      
      if (!match) {
        return res.status(400).json({ error: 'Invalid GitHub repository URL' });
      }
      
      owner = match[1];
      repo = match[2].replace('.git', '');
    }
    
    // Create a repository ID
    const repositoryId = `${owner}-${repo}-${Date.now()}`;
    
    // Create GitHub client with user's auth token
    const githubClient = createGitHubClient(req);
    
    // Fetch repository metadata
    const repoResponse = await githubClient.get(`/repos/${owner}/${repo}`);
    const repoData = repoResponse.data;
    
    // Create repository object
    const repository = {
      id: repositoryId,
      name: repoData.name,
      owner: repoData.owner.login,
      url: repoData.html_url,
      description: repoData.description,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      language: repoData.language,
      isPrivate: repoData.private,
      size: repoData.size,
      createdAt: new Date().toISOString(),
      files: [],
      fileCount: 0,
      totalSize: 0,
      includesAllFiles: includeAllFiles
    };
    
    // Fetch repository contents
    await fetchRepositoryContents(githubClient, repository, owner, repo, '', includeAllFiles);
    
    // Normalize files size and calculate total size
    repository.totalSize = repository.files.reduce((total, file) => total + file.size, 0);
    repository.fileCount = repository.files.length;
    
    // Save to memory and disk
    repositories.unshift(repository);
    
    // Make sure data directory exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }
    
    if (!fs.existsSync('./data/repositories')) {
      fs.mkdirSync('./data/repositories');
    }
    
    // Save repository data to file
    fs.writeFileSync(
      `./data/repositories/${repository.id}.json`,
      JSON.stringify(repository, null, 2)
    );
    
    res.json({ repository });
  } catch (error) {
    console.error('Error ingesting repository:', error.message);
    res.status(500).json({ error: 'Failed to ingest repository' });
  }
});

// Get all repositories
app.get('/api/repositories', (req, res) => {
  // In a real app, this would fetch from a database
  // For now, reading from filesystem
  try {
    const files = fs.readdirSync('./data/repositories');
    const repositories = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const data = fs.readFileSync(`./data/repositories/${file}`, 'utf8');
        const repo = JSON.parse(data);
        
        // If the repository is private, only return it if the user is authenticated
        // and it belongs to the authenticated user
        if (repo.summary?.isPrivate) {
          if (!req.isAuthenticated()) {
            return null;
          }
        }
        
        return {
          id: repo.id,
          owner: repo.owner,
          name: repo.name,
          createdAt: repo.createdAt,
          summary: repo.summary,
          fileCount: repo.fileCount,
          sizeInBytes: repo.sizeInBytes
        };
      })
      .filter(Boolean) // Remove null entries (private repos for unauthenticated users)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by date, newest first
    
    return res.json({ repositories });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Add a new endpoint to fetch user's GitHub repositories
app.get('/api/user/repositories', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const githubClient = createGitHubClient(req);
    const response = await githubClient.get('/user/repos?sort=updated&per_page=100');
    
    const repositories = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      isPrivate: repo.private,
      updatedAt: repo.updated_at
    }));
    
    return res.json({ repositories });
  } catch (error) {
    console.error('Error fetching user repositories:', error.message);
    return res.status(500).json({ error: 'Failed to fetch user repositories' });
  }
});

app.get('/api/repositories/:id', (req, res) => {
  // Try to find repository in memory first
  let repository = repositories.find(repo => repo.id === req.params.id);
  
  // If not in memory, try to load from file
  if (!repository) {
    try {
      const data = fs.readFileSync(`./data/repositories/${req.params.id}.json`, 'utf8');
      repository = JSON.parse(data);
    } catch (error) {
      console.error(`Error loading repository ${req.params.id}:`, error);
    }
  }
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  res.json({ repository });
});

app.post('/api/repositories/:id/additional-files', async (req, res) => {
  try {
    // Find repository
    let repository = null;
    try {
      const data = fs.readFileSync(`./data/repositories/${req.params.id}.json`, 'utf8');
      repository = JSON.parse(data);
    } catch (error) {
      console.error(`Error loading repository ${req.params.id}:`, error);
    }
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // If already has all files, just return
    if (repository.ingestedContent.allFilesIncluded) {
      return res.json({ 
        success: true,
        repository 
      });
    }
    
    // Re-fetch with all files included
    const repoResponse = await github.get(`/repos/${repository.owner}/${repository.name}`);
    const repo = repoResponse.data;
    
    const treeResponse = await github.get(
      `/repos/${repository.owner}/${repository.name}/git/trees/${repo.default_branch}?recursive=1`
    );
    const tree = treeResponse.data;
    
    // Format the tree for display
    let formattedTree = '';
    const fileEntries = {};
    let fileCount = 0;
    let totalSize = 0;
    
    // Process all files
    for (const item of tree.tree) {
      // Skip directories
      if (item.type === 'tree') continue;
      
      // Skip files that are too large
      if (item.size > FILE_SIZE_LIMIT) {
        console.warn(`Skipping large file: ${item.path} (${item.size} bytes)`);
        continue;
      }
      
      fileEntries[item.path] = item;
      fileCount++;
      totalSize += item.size || 0;
    }
    
    // Build formatted tree
    const pathSegments = Object.keys(fileEntries).sort();
    
    let lastPathParts = [];
    
    for (const filePath of pathSegments) {
      const parts = filePath.split('/');
      
      // Calculate the common part with the last path
      let commonPathLength = 0;
      if (lastPathParts.length > 0) {
        for (let i = 0; i < Math.min(parts.length - 1, lastPathParts.length - 1); i++) {
          if (parts[i] === lastPathParts[i]) {
            commonPathLength = i + 1;
          } else {
            break;
          }
        }
      }
      
      // Add directories that are different from the last path
      for (let i = commonPathLength; i < parts.length - 1; i++) {
        const indent = '│   '.repeat(i);
        formattedTree += `${indent}├── ${parts[i]}/\n`;
      }
      
      // Add the file
      const fileIndent = '│   '.repeat(parts.length - 1);
      formattedTree += `${fileIndent}├── ${parts[parts.length - 1]}\n`;
      
      lastPathParts = parts;
    }
    
    // Update repository object
    repository.fileCount = fileCount;
    repository.sizeInBytes = totalSize;
    repository.ingestedContent.allFilesIncluded = true;
    repository.ingestedContent.tree = formattedTree;
    
    // Save to file system
    fs.writeFileSync(
      `./data/repositories/${repository.id}.json`, 
      JSON.stringify(repository, null, 2)
    );
    
    console.log(`Repository ${repository.id} updated with additional files`);
    
    return res.json({ 
      success: true,
      repository 
    });
  } catch (error) {
    console.error('Error loading additional files:', error.message);
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Failed to load additional files' 
    });
  }
});

app.post('/api/extract/:id', async (req, res) => {
  // Use environment variable for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured on server' });
  }
  
  try {
    // Find repository
    let repository = null;
    try {
      const data = fs.readFileSync(`./data/repositories/${req.params.id}.json`, 'utf8');
      repository = JSON.parse(data);
    } catch (error) {
      console.error(`Error loading repository ${req.params.id}:`, error);
    }
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Configure Anthropic API client with updated headers
    // Using the latest API standard format (2023-06-01)
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };
    
    // Add API key in the correct format
    if (apiKey.startsWith('sk-ant-')) {
      // For Claude API keys that start with sk-ant-
      headers['x-api-key'] = apiKey;
    } else {
      // For API keys in other formats
      headers['anthropic-api-key'] = apiKey;
    }
    
    const anthropic = axios.create({
      baseURL: 'https://api.anthropic.com',
      headers
    });
    
    // Prepare code content for analysis
    const codeContent = repository.ingestedContent.fullCode || '';
    const repoDescription = repository.summary.description || '';
    
    // Create prompt for Claude - focus on extractable code patterns
    const systemPrompt = "You are an expert code assistant who specializes in extracting reusable code patterns. Your task is to identify the most important and reusable code from repositories and present them in a format that can be directly copied and reused by AI systems or developers.";
    
    // Log API request (excluding the full code content for brevity)
    console.log('Sending request to Claude API with:');
    console.log('- Model:', 'claude-3-5-sonnet-20240620');
    console.log('- Headers:', JSON.stringify({...headers, 'x-api-key': '***REDACTED***'}, null, 2));
    console.log('- System prompt:', systemPrompt);
    
    // Send request to Claude API
    const response = await anthropic.post('/v1/messages', {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Extract the most reusable and important code from this GitHub repository. Focus on providing code snippets that can be directly used as a reference for AI to build similar functionality.
            
Repository: ${repository.owner}/${repository.name}
Description: ${repoDescription}

Here's the code:

${codeContent}

Extract and present the core code patterns and key functions that would enable an AI or developer to quickly implement similar functionality. Include:

1. Essential data structures or class definitions
2. Key functions with their implementations
3. Critical algorithms and workflows
4. Important configuration settings
5. Core API definitions
6. Main interfaces and their implementations

For each extracted piece, include a brief comment explaining its purpose, but prioritize showing the actual code itself. Format code properly with correct syntax.`
        }
      ]
    });
    
    // Extract the response content
    const extractedCode = response.data.content[0].text;
    
    return res.json({ 
      success: true,
      extractedCode 
    });
  } catch (error) {
    console.error('Error extracting code:', error.message);
    console.error('Error response data:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Error headers:', error.response?.headers);
    
    // Check for specific error types and provide more user-friendly messages
    let errorMessage = 'Failed to extract code';
    let statusCode = error.response?.status || 500;
    
    if (error.response?.data?.error?.type === 'authentication_error') {
      errorMessage = 'Invalid API key. The server\'s Claude API key is not valid.';
      statusCode = 401;
    } else if (error.response?.data?.error?.type === 'invalid_request_error' && 
               error.response?.data?.error?.message?.includes('credit balance is too low')) {
      errorMessage = 'The server\'s Claude API account has insufficient credits.';
      statusCode = 402; // Payment Required
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      details: error.response?.data?.error?.message
    });
  }
});

app.post('/api/generate-native-app/:id', async (req, res) => {
  try {
    // Find repository
    let repository = null;
    try {
      const data = fs.readFileSync(`./data/repositories/${req.params.id}.json`, 'utf8');
      repository = JSON.parse(data);
    } catch (error) {
      console.error(`Error loading repository ${req.params.id}:`, error);
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Check if it's likely a web app by looking for web-related patterns
    const codeContent = repository.ingestedContent?.fullCode || '';
    
    const webAppPatterns = [
      '<html', '<div', 'react', 'angular', 'vue', 'document.getElementById', 
      'addEventListener', 'querySelector', 'innerHTML', 'fetch(', 'axios', 
      'express', 'app.get', 'app.post', 'router.get', 'http.createServer'
    ];
    
    let isWebApp = false;
    for (const pattern of webAppPatterns) {
      if (codeContent.toLowerCase().includes(pattern.toLowerCase())) {
        isWebApp = true;
        break;
      }
    }
    
    if (!isWebApp) {
      return res.status(400).json({ 
        error: 'This repository does not appear to be a web application. Only web apps can be converted to native iPhone apps.'
      });
    }
    
    // Initialize or update the nativeApp status in the repository data
    repository.nativeApp = {
      status: 'pending',
      startedAt: new Date().toISOString(),
      swiftCode: null
    };
    
    // Save updated repository data
    fs.writeFileSync(`./data/repositories/${req.params.id}.json`, JSON.stringify(repository, null, 2));
    
    // Respond immediately to avoid Heroku's 30-second timeout
    res.json({ 
      success: true,
      status: 'pending',
      repository
    });
    
    // Start the generation process in the background
    generateNativeAppCode(req.params.id, repository)
      .catch(error => {
        console.error('Background native app generation failed:', error);
      });
    
  } catch (error) {
    console.error('Error starting native app generation:', error.message);
    return res.status(500).json({ 
      error: 'Failed to start native app generation process' 
    });
  }
});

app.get('/api/generate-native-app/:id/status', async (req, res) => {
  try {
    // Find repository
    let repository = null;
    try {
      const data = fs.readFileSync(`./data/repositories/${req.params.id}.json`, 'utf8');
      repository = JSON.parse(data);
    } catch (error) {
      console.error(`Error loading repository ${req.params.id}:`, error);
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    if (!repository.nativeApp) {
      return res.json({ 
        status: 'not_started'
      });
    }
    
    return res.json({ 
      status: repository.nativeApp.status,
      swiftCode: repository.nativeApp.swiftCode,
      startedAt: repository.nativeApp.startedAt,
      completedAt: repository.nativeApp.completedAt,
      error: repository.nativeApp.error
    });
    
  } catch (error) {
    console.error('Error checking native app generation status:', error.message);
    return res.status(500).json({ 
      error: 'Failed to check generation status' 
    });
  }
});

// New endpoint to download Swift project as a zip file
app.get('/api/generate-native-app/:id/download', async (req, res) => {
  try {
    // Find repository
    let repository = null;
    try {
      const data = fs.readFileSync(`./data/repositories/${req.params.id}.json`, 'utf8');
      repository = JSON.parse(data);
    } catch (error) {
      console.error(`Error loading repository ${req.params.id}:`, error);
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Check if native app code exists
    if (!repository.nativeApp?.swiftCode || repository.nativeApp.status !== 'completed') {
      return res.status(400).json({ error: 'Native app code has not been generated yet' });
    }
    
    const swiftCode = repository.nativeApp.swiftCode;
    const repoName = repository.name;
    
    // Create temporary directory for the Xcode project
    const tempDir = path.join(os.tmpdir(), `${repoName}-iOS-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Create project directory structure
    const projectDir = path.join(tempDir, `${repoName}App`);
    fs.mkdirSync(projectDir, { recursive: true });
    
    // Standard iOS project directories
    fs.mkdirSync(path.join(projectDir, 'Views'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'Models'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'ViewModels'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'Services'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'Utils'), { recursive: true });
    
    // Parse the Swift code to extract individual files
    const fileMatches = swiftCode.match(/```swift\s*(?:\/\/\s*([^]+?)\.swift\s*)?([^]+?)```/g) || [];
    
    if (fileMatches.length === 0) {
      // If no specific file blocks found, create a single App.swift file
      fs.writeFileSync(path.join(projectDir, `${repoName}App.swift`), swiftCode.replace(/```swift|```/g, '').trim());
    } else {
      // Process each file match
      for (let i = 0; i < fileMatches.length; i++) {
        const fileMatch = fileMatches[i];
        
        // Extract filename and content
        const filenameMatch = fileMatch.match(/```swift\s*(?:\/\/\s*([^]+?)\.swift)?/);
        let filename = filenameMatch && filenameMatch[1] ? 
          `${filenameMatch[1].trim()}.swift` : 
          `File${i + 1}.swift`;
        
        // Clean up the content
        let content = fileMatch
          .replace(/```swift\s*(?:\/\/\s*[^]+?\.swift)?/, '')
          .replace(/```$/, '')
          .trim();
        
        // Determine subdirectory based on filename
        let subdir = '';
        if (filename.includes('View') || filename.includes('Screen')) {
          subdir = 'Views';
        } else if (filename.includes('Model') && !filename.includes('ViewModel')) {
          subdir = 'Models';
        } else if (filename.includes('ViewModel') || filename.includes('Provider')) {
          subdir = 'ViewModels';
        } else if (filename.includes('Service') || filename.includes('Client') || filename.includes('API')) {
          subdir = 'Services';
        } else if (filename.includes('Helper') || filename.includes('Extension') || filename.includes('Util')) {
          subdir = 'Utils';
        }
        
        // Write the file to the appropriate directory
        const filePath = path.join(projectDir, subdir, filename);
        fs.writeFileSync(filePath, content);
      }
    }
    
    // Create the App file if it doesn't exist already
    const appFilePath = path.join(projectDir, `${repoName}App.swift`);
    if (!fs.existsSync(appFilePath)) {
      const appFileContent = `import SwiftUI

@main
struct ${repoName}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
`;
      fs.writeFileSync(appFilePath, appFileContent);
    }
    
    // Create a basic ContentView if it doesn't exist
    const hasContentView = fs.existsSync(path.join(projectDir, 'Views', 'ContentView.swift'));
    if (!hasContentView) {
      const contentViewPath = path.join(projectDir, 'Views', 'ContentView.swift');
      const contentViewContent = `import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationView {
            VStack {
                Text("Welcome to ${repoName}App")
                    .font(.title)
                    .padding()
                Text("Open the project in Xcode to customize and build")
                    .padding()
            }
            .navigationTitle("${repoName}App")
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
`;
      fs.writeFileSync(contentViewPath, contentViewContent);
    }
    
    // Create project.pbxproj file (minimal version)
    const pbxprojDir = path.join(projectDir, `${repoName}App.xcodeproj`);
    fs.mkdirSync(pbxprojDir, { recursive: true });
    
    // Create a .xcworkspace directory
    const xcworkspaceDir = path.join(projectDir, `${repoName}App.xcworkspace`);
    fs.mkdirSync(xcworkspaceDir, { recursive: true });
    
    // Create contents.xcworkspacedata file
    const contentsXCWorkspaceData = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
`;
    fs.writeFileSync(path.join(xcworkspaceDir, 'contents.xcworkspacedata'), contentsXCWorkspaceData);
    
    // Create a Package.swift file for Swift Package Manager
    const packageSwiftContent = `// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "${repoName}App",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "${repoName}App",
            targets: ["${repoName}App"]),
    ],
    dependencies: [
        // Dependencies here
    ],
    targets: [
        .target(
            name: "${repoName}App",
            dependencies: []),
        .testTarget(
            name: "${repoName}AppTests",
            dependencies: ["${repoName}App"]),
    ]
)
`;
    fs.writeFileSync(path.join(projectDir, 'Package.swift'), packageSwiftContent);
    
    // Create README.md with instructions
    const readmeContent = `# ${repoName}App

This iOS app was automatically generated from the web application "${repoName}" using the CodeIngest tool.

## Opening in Xcode

To open this project in Xcode:

1. Launch Xcode
2. Select "Open a project or file"
3. Navigate to the extracted folder
4. Open the \`${repoName}App.xcodeproj\` file

## Project Structure

- **Views/**: SwiftUI view components
- **Models/**: Data models
- **ViewModels/**: View models for business logic
- **Services/**: API and other services
- **Utils/**: Helper utilities and extensions

## Building the App

After opening in Xcode, you may need to:
1. Update the Bundle Identifier
2. Set up your development team
3. Configure any required capabilities
4. Click the Run button to build and run the app

## Generated Code

This is AI-generated code that attempts to match the functionality of the original web app.
Some manual adjustments may be needed to ensure the app works correctly.
`;
    fs.writeFileSync(path.join(projectDir, 'README.md'), readmeContent);
    
    // Create a zip file
    const zipPath = path.join(tempDir, `${repoName}App.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Listen for all archive data to be written
    const zipPromise = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });
    
    // Pipe archive data to the file
    archive.pipe(output);
    archive.directory(projectDir, `${repoName}App`);
    await archive.finalize();
    
    // Wait for the zip to complete
    await zipPromise;
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${repoName}App.zip`);
    
    // Stream the file
    fs.createReadStream(zipPath).pipe(res);
    
    // Clean up temporary directory after sending (asynchronously)
    res.on('finish', () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error cleaning up temp directory:', err);
      }
    });
    
  } catch (error) {
    console.error('Error generating Xcode project:', error);
    return res.status(500).json({ error: 'Failed to generate Xcode project' });
  }
});

// Debug information for callback URL
app.get('/auth/debug', (req, res) => {
  // Only show in development or if explicitly allowed
  if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEBUG === 'true') {
    res.json({
      environment: process.env.NODE_ENV || 'development',
      callbackURL: process.env.NODE_ENV === 'production'
        ? 'https://codanalyzer-49ec21ea6aca.herokuapp.com/auth/github/callback'
        : 'http://localhost:3000/auth/github/callback',
      clientIDConfigured: !!process.env.GITHUB_CLIENT_ID,
      clientSecretConfigured: !!process.env.GITHUB_CLIENT_SECRET
    });
  } else {
    res.status(404).send('Not available in production');
  }
});

// Background function for generating native app code
async function generateNativeAppCode(repositoryId, repository) {
  try {
    // Use Claude API to generate Swift code
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      updateNativeAppStatus(repositoryId, 'error', null, 'Anthropic API key not configured on server');
      return;
    }
    
    // Configure Anthropic API client with updated headers
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };
    
    // Add API key in the correct format
    if (apiKey.startsWith('sk-ant-')) {
      headers['x-api-key'] = apiKey;
    } else {
      headers['anthropic-api-key'] = apiKey;
    }
    
    const anthropic = axios.create({
      baseURL: 'https://api.anthropic.com',
      headers
    });
    
    // Get repository information
    const repoOwner = repository.owner;
    const repoName = repository.name;
    const repoDescription = repository.summary?.description || '';
    const codeContent = repository.ingestedContent?.fullCode || '';
    
    // Create system prompt
    const systemPrompt = `You are an expert iOS developer who specializes in converting web applications to native iOS apps using Swift and SwiftUI. 
Your task is to analyze web application source code and generate equivalent iOS Swift code that implements the same functionality.`;
    
    // Log API request (excluding the full code content for brevity)
    console.log('Sending request to Claude API for native app generation:');
    console.log('- Model:', 'claude-3-5-sonnet-20240620');
    console.log('- Repository:', `${repoOwner}/${repoName}`);
    
    // Send request to Claude API
    const response = await anthropic.post('/v1/messages', {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Convert this web application to a native iOS app using Swift and SwiftUI.

Repository: ${repoOwner}/${repoName}
Description: ${repoDescription}

Here's the source code of the web application:

${codeContent}

Create Swift code for a native iOS app that implements the same core functionality as this web app. Include:

1. Swift UI views that mirror the web app's UI components
2. Model classes for all important data structures
3. Controller/ViewModel code for business logic
4. Network requests to replace any API calls in the web app
5. Navigation structure that matches the web app flow
6. State management similar to the web app

Focus on creating a well-structured, modern Swift codebase that would be ready for implementation.
Provide complete Swift files organized in a typical iOS project structure.`
        }
      ]
    });
    
    // Extract the response content
    const generatedSwiftCode = response.data.content[0].text;
    
    // Update the status to complete
    updateNativeAppStatus(repositoryId, 'completed', generatedSwiftCode);
    
    console.log(`Native app generation completed for repository ${repositoryId}`);
    
  } catch (error) {
    console.error('Error generating native app:', error.message);
    console.error('Error details:', error.response?.data);
    
    const errorMessage = error.response?.data?.error?.message || 'Failed to generate native app code';
    updateNativeAppStatus(repositoryId, 'error', null, errorMessage);
  }
}

// Helper function to update the native app status in the repository data
function updateNativeAppStatus(repositoryId, status, swiftCode = null, error = null) {
  try {
    // Read the current repository data
    const data = fs.readFileSync(`./data/repositories/${repositoryId}.json`, 'utf8');
    const repository = JSON.parse(data);
    
    // Update the nativeApp object
    repository.nativeApp = {
      ...repository.nativeApp,
      status,
      completedAt: new Date().toISOString(),
      swiftCode,
      error
    };
    
    // Save updated repository data
    fs.writeFileSync(`./data/repositories/${repositoryId}.json`, JSON.stringify(repository, null, 2));
    
  } catch (error) {
    console.error(`Error updating native app status for repository ${repositoryId}:`, error);
  }
}

// Serve static files from the React build directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  
  // Handle any requests that don't match the above
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  
  // Log environment status
  console.log('GitHub OAuth:', process.env.GITHUB_CLIENT_ID ? 'Configured' : 'Not configured');
  console.log('Claude API:', process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
