// Simple Express server for Heroku deployment
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');

// Logging setup
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
  
  // Also log to a file for troubleshooting
  try {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, 'server.log'), logMessage + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// Log startup information
log('Starting server...');
log(`Node environment: ${process.env.NODE_ENV || 'development'}`);
log(`Current directory: ${__dirname}`);
try {
  log(`Directory contents: ${fs.readdirSync(__dirname).join(', ')}`);
} catch (err) {
  log(`Error reading directory: ${err.message}`, 'error');
}

// Log environment variables (excluding sensitive ones)
log('Environment variables:');
const safeEnvVars = Object.keys(process.env)
  .filter(key => !key.includes('KEY') && !key.includes('SECRET') && !key.includes('TOKEN') && !key.includes('PASSWORD'))
  .reduce((obj, key) => {
    obj[key] = process.env[key];
    return obj;
  }, {});
log(JSON.stringify(safeEnvVars, null, 2));

const app = express();
const port = process.env.PORT || 3000;

log(`Initializing server on port ${port}`);

// GitHub API helper functions
const githubApi = {
  async getRepoDetails(owner, repo, token = null) {
    try {
      log(`GitHub API: Fetching repository details for ${owner}/${repo}`);
      const headers = token ? { Authorization: `token ${token}` } : {};
      
      // Add User-Agent header to prevent GitHub API from rejecting the request
      headers['User-Agent'] = 'CodeIngest-App';
      
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      log(`GitHub API Request: GET ${url}`);
      
      const response = await axios.get(url, { headers });
      log(`GitHub API Response: Status ${response.status} for repository details`);
      
      return response.data;
    } catch (error) {
      log(`Error fetching repository details: ${error.message}`, 'error');
      if (error.response) {
        log(`GitHub API Error Response: Status ${error.response.status}`, 'error');
        log(`GitHub API Error Response Headers: ${JSON.stringify(error.response.headers)}`, 'error');
      }
      throw new Error(`Failed to fetch repository details: ${error.message}`);
    }
  },
  
  async getRepoTree(owner, repo, branch = 'main', token = null) {
    try {
      log(`GitHub API: Fetching repository tree for ${owner}/${repo} on branch ${branch}`);
      const headers = token ? { Authorization: `token ${token}` } : {};
      
      // Add User-Agent header to prevent GitHub API from rejecting the request
      headers['User-Agent'] = 'CodeIngest-App';
      
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      log(`GitHub API Request: GET ${url}`);
      
      const response = await axios.get(url, { headers });
      log(`GitHub API Response: Status ${response.status} for repository tree with ${response.data.tree.length} items`);
      
      return response.data;
    } catch (error) {
      log(`Error fetching repository tree: ${error.message}`, 'error');
      if (error.response) {
        log(`GitHub API Error Response: Status ${error.response.status}`, 'error');
      }
      throw new Error(`Failed to fetch repository tree: ${error.message}`);
    }
  },
  
  async getFileContent(owner, repo, path, branch = 'main', token = null) {
    try {
      log(`GitHub API: Fetching file content for ${path} in ${owner}/${repo}`);
      const headers = token ? { Authorization: `token ${token}` } : {};
      
      // Add User-Agent header to prevent GitHub API from rejecting the request
      headers['User-Agent'] = 'CodeIngest-App';
      
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      log(`GitHub API Request: GET ${url}`);
      
      const response = await axios.get(url, { headers });
      log(`GitHub API Response: Status ${response.status} for file content`);
      
      // GitHub API returns the content as base64 encoded
      if (response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString();
      }
      return null;
    } catch (error) {
      log(`Error fetching file content for ${path}: ${error.message}`, 'error');
      if (error.response) {
        log(`GitHub API Error Response: Status ${error.response.status}`, 'error');
      }
      return null;
    }
  },
  
  // Helper to filter files based on include/exclude patterns
  matchesPattern(path, pattern) {
    // Convert glob pattern to regex
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    return regex.test(path);
  },
  
  // Generate a directory tree representation
  generateTreeView(files) {
    const tree = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // This is a file
          current[part] = null;
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    });
    
    // Convert the tree object to string representation
    const stringifyTree = (node, prefix = '') => {
      if (!node) return '';
      
      let result = '';
      const entries = Object.entries(node);
      entries.forEach(([key, value], index) => {
        const isLast = index === entries.length - 1;
        const currentPrefix = prefix + (isLast ? '- ' : '- ');
        result += `${prefix}${isLast ? '- ' : '- '}${key}\n`;
        
        if (value !== null) {
          result += stringifyTree(value, prefix + (isLast ? '  ' : '  '));
        }
      });
      
      return result;
    };
    
    return stringifyTree(tree);
  }
};

// Store for in-memory data
const store = {
  users: [{ id: 'user-1', name: 'Demo User', email: 'demo@example.com' }],
  repositories: [],
  analyses: [],
  
  getUsers() {
    return this.users;
  },
  
  getRepositories(userId) {
    return this.repositories.filter(repo => repo.userId === userId);
  },
  
  getRepositoryById(id) {
    return this.repositories.find(repo => repo.id === id);
  },
  
  addRepository(repository) {
    this.repositories.push(repository);
    return repository;
  },
  
  getAnalyses(repositoryId) {
    return this.analyses.filter(analysis => analysis.repositoryId === repositoryId);
  },
  
  getAnalysisById(id) {
    return this.analyses.find(analysis => analysis.id === id);
  },
  
  addAnalysis(analysis) {
    this.analyses.push(analysis);
    return analysis;
  },
  
  updateAnalysis(id, updates) {
    const index = this.analyses.findIndex(analysis => analysis.id === id);
    if (index !== -1) {
      this.analyses[index] = { ...this.analyses[index], ...updates };
      return this.analyses[index];
    }
    return null;
  }
};

// Middleware for CORS and parsing
app.use(bodyParser.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Log all requests
app.use((req, res, next) => {
  log(`${req.method} ${req.originalUrl} from ${req.get('origin') || 'unknown origin'}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  log(`Error processing request: ${err.message}`, 'error');
  log(`Stack trace: ${err.stack}`, 'error');
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  
  log(`Production mode: Serving static files from: ${publicPath}`);
  // Check if directory exists
  try {
    if (fs.existsSync(publicPath)) {
      log(`Public directory exists with contents: ${fs.readdirSync(publicPath).join(', ')}`);
    } else {
      log(`Warning: Public directory does not exist at ${publicPath}`, 'warn');
      // Try to create it
      fs.mkdirSync(publicPath, { recursive: true });
      log(`Created public directory at ${publicPath}`);
    }
  } catch (err) {
    log(`Error checking public directory: ${err.message}`, 'error');
  }
  
  app.use(express.static(publicPath));
  
  // For direct URL navigation in SPA
  app.get('*', (req, res) => {
    // Only serve index.html for paths that don't start with /api
    if (!req.path.startsWith('/api')) {
      const indexPath = path.join(publicPath, 'index.html');
      log(`Serving index.html for path: ${req.path}`);
      
      // Check if index.html exists
      try {
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          log(`Error: index.html not found at ${indexPath}`, 'error');
          res.status(404).send('index.html not found');
        }
      } catch (err) {
        log(`Error serving index.html: ${err.message}`, 'error');
        res.status(500).send(`Server error: ${err.message}`);
      }
    }
  });
} else {
  // In development, serve static files from the client's dist directory
  const clientDistPath = path.join(__dirname, 'client', 'dist');
  log(`Development mode: Serving static files from: ${clientDistPath}`);
  
  // Check if directory exists
  try {
    if (fs.existsSync(clientDistPath)) {
      log(`Client dist directory exists with contents: ${fs.readdirSync(clientDistPath).join(', ')}`);
    } else {
      log(`Warning: Client dist directory does not exist at ${clientDistPath}`, 'warn');
    }
  } catch (err) {
    log(`Error checking client dist directory: ${err.message}`, 'error');
  }
  
  app.use(express.static(clientDistPath));
}

// Public repositories endpoint
app.post('/api/public-repositories', async (req, res) => {
  try {
    log(`POST request to /api/public-repositories with body: ${JSON.stringify(req.body)}`);
    const { url } = req.body;
    
    if (!url) {
      log('Missing URL in request body', 'error');
      return res.status(400).json({ error: 'Repository URL is required' });
    }
    
    // Parse GitHub URL
    const githubUrlRegex = /github\.com\/([^/]+)\/([^/]+)/;
    const match = url.match(githubUrlRegex);
    
    if (!match) {
      log(`Invalid GitHub URL: ${url}`, 'error');
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }
    
    const [, repoOwner, repoName] = match;
    const normalizedRepoName = repoName.replace('.git', '');
    
    log(`Parsed GitHub URL - Owner: ${repoOwner}, Repo: ${normalizedRepoName}`);
    
    try {
      // Fetch repository details and tree
      log(`Fetching repository details for ${repoOwner}/${normalizedRepoName}`);
      const repoDetails = await githubApi.getRepoDetails(repoOwner, normalizedRepoName);
      const branch = repoDetails.default_branch || 'main';
      
      log(`Fetching repository tree for ${repoOwner}/${normalizedRepoName} on branch ${branch}`);
      const repoTree = await githubApi.getRepoTree(repoOwner, normalizedRepoName, branch);
      
      // Get file contents for code files (limit to reasonable size and number)
      log(`Fetching file contents for ${repoOwner}/${normalizedRepoName}`);
      const MAX_FILES = 50; // Limit number of files to fetch
      const MAX_SIZE_KB = 500; // Don't fetch files larger than 500KB
      const EXCLUDED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.tar', '.gz'];
      
      // Filter tree to get only code files within size limits
      const codeFiles = repoTree.tree
        .filter(item => {
          // Only include blob files (not directories)
          if (item.type !== 'blob') return false;
          
          // Check file size (in KB)
          const sizeKB = (item.size || 0) / 1024;
          if (sizeKB > MAX_SIZE_KB) return false;
          
          // Check file extension
          const extension = item.path.includes('.') ? 
            item.path.substring(item.path.lastIndexOf('.')).toLowerCase() : '';
          return !EXCLUDED_EXTENSIONS.includes(extension);
        })
        .slice(0, MAX_FILES); // Limit number of files
      
      log(`Found ${codeFiles.length} code files to fetch`);
      
      // Fetch content for each file and build consolidated code string
      const fileContents = [];
      const consolidatedCode = [];
      let totalSizeBytes = 0;
      
      for (const file of codeFiles) {
        try {
          log(`Fetching content for ${file.path}`);
          // Get file content directly from GitHub raw URL to avoid base64 encoding/decoding
          const fileContent = await githubApi.getFileContent(repoOwner, normalizedRepoName, file.path, branch);
          
          if (fileContent) {
            fileContents.push({
              path: file.path,
              content: fileContent
            });
            
            consolidatedCode.push(
              `// ****************************************************`,
              `// File: ${file.path}`,
              `// ****************************************************`,
              ``,
              fileContent,
              ``,
              ``
            );
            
            totalSizeBytes += (fileContent.length || 0);
          }
        } catch (error) {
          log(`Error fetching content for ${file.path}: ${error.message}`, 'error');
          // Continue with other files even if one fails
        }
      }
      
      const fullCode = consolidatedCode.join('\n');
      log(`Generated consolidated code: ${Math.round(totalSizeBytes / 1024)} KB`);
      
      // Generate tree display
      const treeDisplay = [];
      const processedPaths = new Set();
      
      repoTree.tree.forEach(item => {
        const parts = item.path.split('/');
        let indent = '';
        
        for (let i = 0; i < parts.length; i++) {
          const currentPath = parts.slice(0, i + 1).join('/');
          
          if (!processedPaths.has(currentPath)) {
            processedPaths.add(currentPath);
            
            if (i === parts.length - 1 && item.type === 'blob') {
              treeDisplay.push(`${indent}├── ${parts[i]}`);
            } else {
              treeDisplay.push(`${indent}└── ${parts[i]}/`);
              indent += '    ';
            }
          }
        }
      });
      
      // Create response object with detailed information for debugging
      const repository = {
        id: uuidv4(),
        url,
        owner: repoOwner,
        repo: normalizedRepoName,
        name: normalizedRepoName,
        fullName: repoDetails.full_name,
        description: repoDetails.description || '',
        defaultBranch: branch,
        createdAt: new Date().toISOString(),
        fileCount: repoTree.tree.filter(item => item.type === 'blob').length,
        size: repoDetails.size,
        language: repoDetails.language || 'Unknown',
        stargazersCount: repoDetails.stargazers_count || 0,
        forksCount: repoDetails.forks_count || 0,
        apiRequestsSuccessful: true,
        status: 'completed',
        tree: repoTree.tree.slice(0, 20), // Limit the tree size for performance
        ingestedContent: {
          summary: `Repository: ${repoDetails.full_name}\nDescription: ${repoDetails.description || 'None'}\nLanguage: ${repoDetails.language || 'Unknown'}\nTotal Files: ${repoTree.tree.filter(item => item.type === 'blob').length}\nFetched Files: ${fileContents.length}`,
          tree: treeDisplay.join('\n'),
          fullCode: fullCode,
          fileCount: codeFiles.length,
          sizeInBytes: totalSizeBytes
        }
      };
      
      log(`Successfully created repository object: ${repository.id}`);
      
      // Add to in-memory store for future reference
      if (!global.repositories) {
        global.repositories = {};
      }
      global.repositories[repository.id] = repository;
      
      // For debugging in production, add extra diagnostics
      if (process.env.NODE_ENV === 'production') {
        log(`Production diagnostics - Repository object created: ${JSON.stringify({
          id: repository.id,
          owner: repository.owner,
          repo: repository.repo,
          fileCount: repository.fileCount,
          createdAt: repository.createdAt
        })}`);
      }
      
      // Return the repository wrapped in an object as expected by the frontend
      return res.json({ 
        repository: repository,
        analysisId: null
      });
    } catch (error) {
      log(`Error fetching repository information: ${error.message}`, 'error');
      if (error.response && error.response.status) {
        log(`GitHub API response status: ${error.response.status}`, 'error');
        log(`GitHub API response headers: ${JSON.stringify(error.response.headers || {})}`, 'error');
      }
      return res.status(500).json({ 
        error: `Failed to fetch repository information: ${error.message}`,
        details: error.response ? { 
          status: error.response.status,
          statusText: error.response.statusText
        } : null
      });
    }
  } catch (error) {
    log(`Unexpected error in /api/public-repositories: ${error.message}`, 'error');
    log(`Stack trace: ${error.stack}`, 'error');
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GitHub OAuth redirect (simplified)
app.get('/api/auth/github', (_, res) => {
  res.json({ message: 'OAuth is not configured in simplified mode' });
});

// GitHub OAuth callback (simplified)
app.get('/api/auth/github/callback', (_, res) => {
  res.json({ message: 'OAuth callback is not configured in simplified mode' });
});

// Get repositories endpoint
app.get('/api/repositories', (_, res) => {
  const userId = store.getUsers()[0].id;
  const repositories = store.getRepositories(userId);
  
  return res.json({ repositories });
});

// Add repository endpoint with GitHub API integration
app.post('/api/repositories', async (req, res) => {
  try {
    const { url, includePatterns = ["**/*"], excludePatterns = [] } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!url) {
      return res.status(400).json({ error: 'GitHub repository URL is required' });
    }
    
    // Parse GitHub URL
    const githubUrlRegex = /github\.com\/([^/]+)\/([^/]+)/;
    const match = url.match(githubUrlRegex);
    
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }
    
    const [, repoOwner, repoName] = match;
    const normalizedRepoName = repoName.replace('.git', '');
    
    // Check if repository already exists
    const userId = store.getUsers()[0].id;
    const existingRepo = store.getRepositories(userId).find(
      repo => repo.name === normalizedRepoName && repo.owner === repoOwner
    );
    
    if (existingRepo) {
      return res.json({ repository: existingRepo });
    }
    
    // Create new repository record
    const newRepository = {
      id: uuidv4(),
      userId,
      name: normalizedRepoName,
      owner: repoOwner,
      url,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ingestedContent: {
        summary: `# Repository: ${repoOwner}/${normalizedRepoName}\n\n`,
        tree: "",
        files: []
      }
    };
    
    // Add repository to store
    store.addRepository(newRepository);
    
    // Perform ingestion with GitHub API
    (async () => {
      try {
        // Fetch repository details and tree
        console.log(`Fetching repository details for ${repoOwner}/${normalizedRepoName}`);
        const repoDetails = await githubApi.getRepoDetails(repoOwner, normalizedRepoName, token);
        const branch = repoDetails.default_branch || 'main';
        
        console.log(`Fetching repository tree for ${repoOwner}/${normalizedRepoName} on branch ${branch}`);
        const repoTree = await githubApi.getRepoTree(repoOwner, normalizedRepoName, branch, token);
        
        // Filter files based on include/exclude patterns
        const filteredFiles = repoTree.tree
          .filter(item => item.type === 'blob')
          .filter(file => {
            // Check if the file matches any include pattern
            const matchesInclude = includePatterns.some(pattern => 
              githubApi.matchesPattern(file.path, pattern)
            );
            
            // Check if the file matches any exclude pattern
            const matchesExclude = excludePatterns.some(pattern => 
              githubApi.matchesPattern(file.path, pattern)
            );
            
            return matchesInclude && !matchesExclude;
          });
        
        // Fetch content for each file
        const fileContents = [];
        const maxFiles = 30; // Limit the number of files to process
        for (let i = 0; i < Math.min(filteredFiles.length, maxFiles); i++) {
          const file = filteredFiles[i];
          console.log(`Fetching content for file ${i+1}/${Math.min(filteredFiles.length, maxFiles)}: ${file.path}`);
          
          const content = await githubApi.getFileContent(repoOwner, normalizedRepoName, file.path, branch, token);
          if (content !== null) {
            fileContents.push({
              path: file.path,
              content
            });
          }
        }
        
        // Generate tree view
        const treeView = githubApi.generateTreeView(filteredFiles);
        
        // Update repository with ingested content
        newRepository.ingestedContent = {
          summary: `# Repository: ${repoOwner}/${normalizedRepoName}\n\n${fileContents.length} files processed`,
          tree: treeView,
          files: fileContents
        };
        
        newRepository.status = 'ingested';
        
        console.log(`Repository ${repoOwner}/${normalizedRepoName} successfully ingested`);
      } catch (error) {
        console.error('Error during repository ingestion:', error);
        newRepository.status = 'failed';
        newRepository.error = error.message;
      }
    })();
    
    return res.json({ repository: newRepository });
    
  } catch (error) {
    console.error('Error adding repository:', error);
    return res.status(500).json({ error: 'Failed to add repository' });
  }
});

// Get repository details endpoint
app.get('/api/repositories/:id', (req, res) => {
  const { id } = req.params;
  const repository = store.getRepositoryById(id);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  return res.json({ repository });
});

// Analysis endpoint for handling OpenAI analysis
app.post('/api/analysis/:id', async (req, res) => {
  try {
    log(`POST request to /api/analysis/${req.params.id}`);
    const { id } = req.params;
    const { apiKey } = req.body;
    
    // Get repository from memory or the global repositories object
    let repository = store.getRepositoryById(id);
    if (!repository && global.repositories && global.repositories[id]) {
      repository = global.repositories[id];
    }
    
    if (!repository) {
      log(`Repository with ID ${id} not found`, 'error');
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    log(`Found repository: ${repository.owner}/${repository.name}`);
    
    // Create an analysis entry
    const analysisId = uuidv4();
    const analysis = {
      id: analysisId,
      repositoryId: id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      results: []
    };
    
    // Add to store
    if (store) {
      store.addAnalysis(analysis);
    }
    
    // If not using the store, use a global object
    if (!global.analyses) {
      global.analyses = {};
    }
    global.analyses[analysisId] = analysis;
    
    // Process the analysis asynchronously
    (async () => {
      try {
        log(`Starting analysis for repository ${id}`);
        
        // Validate OpenAI API key
        let openaiApiKey = apiKey;
        
        // If not provided or placeholder, try environment variable
        if (!openaiApiKey || openaiApiKey.includes('placeholder')) {
          log('API key not provided or is a placeholder, using environment variable');
          openaiApiKey = process.env.OPENAI_API_KEY || '';
        }
        
        if (!openaiApiKey) {
          log('No OpenAI API key available', 'error');
          const error = new Error('OpenAI API key is required');
          updateAnalysisStatus(analysisId, 'failed', error.message);
          return;
        }
        
        // Check if API key is in the correct format
        if (!openaiApiKey.startsWith('sk-') && !openaiApiKey.startsWith('sk-proj-')) {
          log('Provided API key does not start with "sk-" or "sk-proj-", may not be valid', 'warn');
        }
        
        log('Preparing code for analysis');
        
        // Extract code content from repository
        const codeContent = repository.ingestedContent?.fullCode || '';
        
        if (!codeContent) {
          const error = new Error('No code content available for analysis');
          log(error.message, 'error');
          updateAnalysisStatus(analysisId, 'failed', error.message);
          return;
        }
        
        log(`Code content size: ${Math.round(codeContent.length / 1024)} KB`);
        
        // Make request to OpenAI API
        log('Sending request to OpenAI API');
        
        try {
          // Set the OpenAI API key in environment
          process.env.OPENAI_API_KEY = openaiApiKey;
          
          // Make request to OpenAI
          const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: `You are a code analysis assistant. Analyze the following code and provide insightful feedback, 
                suggestions for improvements, and identify potential bugs or vulnerabilities. 
                Focus on the most important aspects of the code. Your response should be structured in JSON format with the following fields:
                [
                  {
                    "id": "unique-id",
                    "title": "Brief title of the insight",
                    "description": "Detailed explanation",
                    "severity": "high/medium/low",
                    "category": "bug/security/performance/maintainability"
                  }
                ]`
              },
              {
                role: 'user',
                content: `Analyze this code repository:\n\n${codeContent}`
              }
            ],
            temperature: 0.3,
            max_tokens: 3000
          }, {
            headers: {
              'Authorization': `Bearer ${openaiApiKey.trim()}`,
              'Content-Type': 'application/json'
            }
          });
          
          log('Received response from OpenAI API');
          
          // Parse the response and extract results
          let results = [];
          try {
            const content = response.data.choices[0].message.content;
            results = JSON.parse(content);
          } catch (parseError) {
            log(`Error parsing OpenAI response: ${parseError.message}`, 'error');
            results = [{
              id: 'parse-error',
              title: 'Error processing analysis results',
              description: 'The analysis completed but the results could not be properly formatted.',
              severity: 'low',
              category: 'other'
            }];
          }
          
          // Update analysis with results
          updateAnalysisStatus(analysisId, 'completed', null, results);
          log(`Analysis completed successfully with ${results.length} insights`);
          
        } catch (apiError) {
          log(`OpenAI API error: ${apiError.message}`, 'error');
          if (apiError.response) {
            log(`Status: ${apiError.response.status}`, 'error');
            log(`Data: ${JSON.stringify(apiError.response.data)}`, 'error');
          }
          
          let errorMessage = 'Failed to analyze code with OpenAI';
          
          if (apiError.response && apiError.response.status === 401) {
            errorMessage = 'Invalid OpenAI API key';
          } else if (apiError.response && apiError.response.status === 429) {
            errorMessage = 'OpenAI API rate limit exceeded';
          } else if (apiError.message.includes('content size too large')) {
            errorMessage = 'Code content too large for analysis';
          }
          
          updateAnalysisStatus(analysisId, 'failed', errorMessage);
        }
        
      } catch (error) {
        log(`Error during analysis: ${error.message}`, 'error');
        updateAnalysisStatus(analysisId, 'failed', error.message);
      }
    })();
    
    return res.json({ analysisId });
    
  } catch (error) {
    log(`Unexpected error in /api/analysis: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to process analysis request' });
  }
});

// Get analysis results endpoint
app.get('/api/analysis/:id', async (req, res) => {
  try {
    log(`GET request to /api/analysis/${req.params.id}`);
    const { id } = req.params;
    
    // Check for analysis in store or global object
    let analysis = store.getAnalysisById(id);
    if (!analysis && global.analyses && global.analyses[id]) {
      analysis = global.analyses[id];
    }
    
    if (!analysis) {
      log(`Analysis with ID ${id} not found`, 'error');
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    // Get repository details
    let repository = null;
    if (analysis.repositoryId) {
      repository = store.getRepositoryById(analysis.repositoryId);
      if (!repository && global.repositories && global.repositories[analysis.repositoryId]) {
        repository = global.repositories[analysis.repositoryId];
      }
    }
    
    return res.json({ 
      analysis,
      repository
    });
    
  } catch (error) {
    log(`Error retrieving analysis: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to retrieve analysis results' });
  }
});

// Helper function to update analysis status
function updateAnalysisStatus(id, status, error = null, results = null) {
  const updates = { 
    status,
    ...(error && { error }),
    ...(status === 'completed' && { completedAt: new Date().toISOString() }),
    ...(results && { results })
  };
  
  // Update in store if available
  if (store) {
    store.updateAnalysis(id, updates);
  }
  
  // Update in global object if available
  if (global.analyses && global.analyses[id]) {
    global.analyses[id] = { ...global.analyses[id], ...updates };
  }
  
  log(`Updated analysis ${id} status to ${status}`);
}

// Basic health check endpoint
app.get('/api/health', (_, res) => {
  return res.json({ 
    status: 'healthy', 
    message: 'Server is running in simplified mode with in-memory storage',
    env: process.env.NODE_ENV || 'development',
    port: port
  });
});

// Start the server
app.listen(port, () => {
  log(`Server running on port ${port}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`GitHub OAuth: ${process.env.GITHUB_CLIENT_ID ? 'Configured' : 'Not configured'}`);
});
