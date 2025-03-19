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
        apiRequestsSuccessful: true,
        status: 'completed',
        tree: repoTree.tree.slice(0, 20) // Limit the tree size for performance
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
