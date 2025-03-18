// Simple Express server for Heroku deployment
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// GitHub API helper functions
const githubApi = {
  async getRepoDetails(owner, repo, token = null) {
    try {
      const headers = token ? { Authorization: `token ${token}` } : {};
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching repository details:', error.message);
      throw new Error(`Failed to fetch repository details: ${error.message}`);
    }
  },
  
  async getRepoTree(owner, repo, branch = 'main', token = null) {
    try {
      const headers = token ? { Authorization: `token ${token}` } : {};
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching repository tree:', error.message);
      throw new Error(`Failed to fetch repository tree: ${error.message}`);
    }
  },
  
  async getFileContent(owner, repo, path, branch = 'main', token = null) {
    try {
      const headers = token ? { Authorization: `token ${token}` } : {};
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers });
      
      // GitHub API returns the content as base64 encoded
      if (response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString();
      }
      return null;
    } catch (error) {
      console.error(`Error fetching file content for ${path}:`, error.message);
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
  credentials: true
}));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  
  console.log(`Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));
  
  // For direct URL navigation in SPA
  app.get('*', (_, res) => {
    // Only serve index.html for paths that don't start with /api
    if (!_.path.startsWith('/api')) {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  });
} else {
  // In development, serve static files from the client's dist directory
  const clientDistPath = path.join(__dirname, 'client', 'dist');
  console.log(`Development: Serving static files from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
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

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`GitHub OAuth: ${process.env.GITHUB_CLIENT_ID ? 'Configured' : 'Not configured'}`);
});
