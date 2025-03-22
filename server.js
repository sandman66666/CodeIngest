const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Create a data directory for storing repositories
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}
if (!fs.existsSync('./data/repositories')) {
  fs.mkdirSync('./data/repositories');
}

// In-memory repository store (in production, use a database)
const repositories = [];

// GitHub API client
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
  try {
    const { url, includeAllFiles } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }
    
    // Extract owner and name from GitHub URL
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(urlPattern);
    
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub URL format' });
    }
    
    const [, owner, name] = match;
    
    // Fetch repository metadata from GitHub
    const repoResponse = await github.get(`/repos/${owner}/${name}`);
    const repo = repoResponse.data;
    
    // Fetch repository tree recursively to get all files
    const treeResponse = await github.get(`/repos/${owner}/${name}/git/trees/${repo.default_branch}?recursive=1`);
    const tree = treeResponse.data;
    
    if (tree.truncated) {
      console.warn('Repository tree is truncated due to size');
    }
    
    // Format the tree for display
    let formattedTree = '';
    const fileEntries = {};
    let fileCount = 0;
    let totalSize = 0;
    
    // Process files
    for (const item of tree.tree) {
      // Skip directories
      if (item.type === 'tree') continue;
      
      // Get file extension
      const extension = path.extname(item.path);
      
      // Check if file should be included based on filter
      if (!includeAllFiles && !isImportantFile(item.path, extension)) {
        continue;
      }
      
      // Skip files that are too large
      if (item.size > FILE_SIZE_LIMIT) {
        console.warn(`Skipping large file: ${item.path} (${item.size} bytes)`);
        continue;
      }
      
      fileEntries[item.path] = item;
      fileCount++;
      totalSize += item.size || 0;
    }
    
    // Build formatted tree for display
    const pathSegments = Object.keys(fileEntries).sort();
    
    let currentIndent = '';
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
    
    // Try to fetch the README file
    let readme = null;
    const readmeFile = Object.keys(fileEntries).find(path => 
      path.toLowerCase().includes('readme.md') || path.toLowerCase() === 'readme'
    );
    
    if (readmeFile) {
      try {
        const readmeResponse = await github.get(
          `/repos/${owner}/${name}/contents/${readmeFile}`,
          { headers: { Accept: 'application/vnd.github.raw' } }
        );
        readme = readmeResponse.data;
      } catch (err) {
        console.error(`Error fetching README: ${err.message}`);
      }
    }
    
    // Get the full code for important files
    let fullCode = '';
    const maxFilesToInclude = 10; // Limit the number of files to include in the code view
    let filesAdded = 0;
    
    for (const filePath of pathSegments) {
      if (filesAdded >= maxFilesToInclude) break;
      
      const extension = path.extname(filePath);
      // Only include code files, not assets, etc.
      const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.rb', '.php', '.go', '.rs', '.c', '.cpp'];
      
      if (codeExtensions.includes(extension)) {
        try {
          const contentResponse = await github.get(
            `/repos/${owner}/${name}/contents/${filePath}`,
            { headers: { Accept: 'application/vnd.github.raw' } }
          );
          
          fullCode += `// File: ${filePath}\n\n`;
          fullCode += contentResponse.data;
          fullCode += '\n\n' + '='.repeat(80) + '\n\n';
          
          filesAdded++;
        } catch (err) {
          console.error(`Error fetching file ${filePath}: ${err.message}`);
        }
      }
    }
    
    // Create repository object
    const repository = {
      id: uuidv4(),
      url,
      owner,
      name,
      fileCount,
      sizeInBytes: totalSize,
      createdAt: new Date().toISOString(),
      summary: {
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        description: repo.description
      },
      ingestedContent: {
        allFilesIncluded: includeAllFiles,
        tree: formattedTree,
        fullCode,
        readme
      }
    };
    
    // Add to in-memory store
    repositories.unshift(repository);
    
    // Save to file system (in production, use a database)
    fs.writeFileSync(
      `./data/repositories/${repository.id}.json`, 
      JSON.stringify(repository, null, 2)
    );
    
    return res.status(201).json({ 
      success: true,
      repository
    });
  } catch (error) {
    console.error('Error ingesting repository:', error.message);
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Failed to ingest repository' 
    });
  }
});

app.get('/api/repositories', (req, res) => {
  // In a real app, this would fetch from a database
  // For now, reading from filesystem
  try {
    const repoIds = fs.readdirSync('./data/repositories')
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    
    const repos = repoIds.map(id => {
      const data = fs.readFileSync(`./data/repositories/${id}.json`, 'utf8');
      return JSON.parse(data);
    });
    
    // Sort by creation date (newest first)
    repos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ repositories: repos });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.json({ repositories: repositories });
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
    
    // Update in-memory store if present
    const repoIndex = repositories.findIndex(repo => repo.id === repository.id);
    if (repoIndex !== -1) {
      repositories[repoIndex] = repository;
    }
    
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
    
    // Use Claude API to generate Swift code
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured on server' });
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
    
    // Store the generated Swift code in the repository data
    repository.nativeApp = {
      generatedAt: new Date().toISOString(),
      swiftCode: generatedSwiftCode
    };
    
    // Save updated repository data
    fs.writeFileSync(`./data/repositories/${req.params.id}.json`, JSON.stringify(repository, null, 2));
    
    return res.json({ 
      success: true,
      repository
    });
  } catch (error) {
    console.error('Error generating native app:', error.message);
    console.error('Error details:', error.response?.data);
    
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error?.message || 'Failed to generate native app code' 
    });
  }
});

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
