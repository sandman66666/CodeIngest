// Express server for Heroku deployment
const express = require('express');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const app = express();
const InMemoryStore = require('./services/in-memory-store');
const { ingestRepository } = require('./services/code-ingestion');

// Configuration
const PORT = process.env.PORT || 3000;
const store = InMemoryStore.getInstance();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files from the public directory (client build)
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    message: 'CodeIngest API is running'
  });
});

// Get all repositories
app.get('/api/repositories', (req, res) => {
  const userId = store.getUsers()[0].id; // Using default user
  const repositories = store.getRepositories(userId);
  res.json({ repositories });
});

// Get a repository by id
app.get('/api/repositories/:id', (req, res) => {
  const repoId = req.params.id;
  const repository = store.getRepositoryById(repoId);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  res.json({ repository });
});

// Add a new repository with owner/name
app.post('/api/repositories', (req, res) => {
  const { owner, name, url } = req.body;
  
  if (!owner || !name) {
    return res.status(400).json({ error: 'Owner and name are required' });
  }
  
  const userId = store.getUsers()[0].id;
  
  // Check if repository already exists
  const existingRepo = store.getRepositoryByOwnerAndName(userId, owner, name);
  
  if (existingRepo) {
    return res.status(409).json({ error: 'Repository already exists' });
  }
  
  // Create new repository
  const newRepo = {
    id: `repo-${uuidv4()}`,
    userId,
    owner,
    name,
    description: `${name} repository`,
    url: url || `https://github.com/${owner}/${name}`,
    language: 'JavaScript',
    stargazersCount: Math.floor(Math.random() * 1000),
    forksCount: Math.floor(Math.random() * 200),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const repository = store.createRepository(newRepo);
  return res.status(201).json({ repository });
});

// Ingest a public GitHub repository
app.post('/api/public-repositories', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'GitHub repository URL is required' });
  }
  
  // Parse owner and name from GitHub URL
  let repoOwner, repoName;
  
  try {
    const githubUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(githubUrlPattern);
    
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub URL format. Expected format: https://github.com/owner/repository' });
    }
    
    repoOwner = match[1];
    repoName = match[2].replace('.git', ''); // Remove .git if present
  } catch (error) {
    return res.status(400).json({ error: 'Could not parse GitHub URL' });
  }
  
  if (!repoOwner || !repoName) {
    return res.status(400).json({ error: 'Could not extract repository owner and name from URL' });
  }
  
  try {
    // Check if the repository exists on GitHub
    let githubResponse;
    try {
      githubResponse = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}`);
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({ error: 'Repository not found on GitHub' });
      } else if (error.response?.status === 403) {
        return res.status(403).json({ error: 'This repository appears to be private. Please log in with GitHub to access private repositories.' });
      } else {
        throw error;
      }
    }
    
    const repoData = githubResponse.data;
    
    // Check if the repository is private
    if (repoData.private) {
      return res.status(403).json({ error: 'This is a private repository. Please log in with GitHub to access private repositories.' });
    }
    
    // Use our demo user ID for simplicity
    const userId = store.getUsers()[0].id;
    
    // Check if repository already exists in our system
    const existingRepo = store.getRepositoryByOwnerAndName(userId, repoOwner, repoName);
    
    if (existingRepo) {
      // If it exists but doesn't have ingested content, we could update it
      if (!existingRepo.ingestedContent) {
        console.log(`Adding content for existing repository: ${repoOwner}/${repoName}`);
        
        // Perform code ingestion
        const ingestionResult = await ingestRepository(url);
        
        // Update the repository with ingested content
        existingRepo.ingestedContent = {
          summary: ingestionResult.summary,
          tree: ingestionResult.tree,
          fullCode: ingestionResult.content,
          fileCount: ingestionResult.fileCount,
          sizeInBytes: ingestionResult.totalSizeBytes
        };
        
        store.updateRepository(existingRepo.id, existingRepo);
      }
      
      return res.status(200).json({ repository: existingRepo, message: 'Repository already exists' });
    }
    
    // Perform code ingestion process
    console.log(`Starting ingestion process for ${repoOwner}/${repoName}`);
    const ingestionResult = await ingestRepository(url);
    console.log(`Completed ingestion for ${repoOwner}/${repoName} with ${ingestionResult.fileCount} files`);
    
    // Create new repository with data from GitHub API
    const newRepo = {
      id: `repo-${uuidv4()}`,
      userId,
      owner: repoOwner,
      name: repoName,
      description: repoData.description || null,
      url: repoData.html_url,
      language: repoData.language || null,
      stargazersCount: repoData.stargazers_count,
      forksCount: repoData.forks_count,
      ingestedContent: {
        summary: ingestionResult.summary,
        tree: ingestionResult.tree,
        fullCode: ingestionResult.content,
        fileCount: ingestionResult.fileCount,
        sizeInBytes: ingestionResult.totalSizeBytes
      },
      createdAt: new Date()
    };
    
    const repository = store.createRepository(newRepo);
    
    // Create a new analysis record for this repository
    const analysisId = uuidv4();
    const analysis = {
      id: analysisId,
      repositoryId: repository.id,
      status: 'pending',
      createdAt: new Date(),
      completedAt: null,
      results: null
    };

    store.createAnalysis(analysis);
    
    // Simulate analysis completion after 5 seconds
    setTimeout(() => {
      const updatedAnalysis = {
        status: 'completed',
        completedAt: new Date(),
        results: [
          {
            id: uuidv4(),
            title: 'Good code organization',
            description: `The ${repository.name} codebase has a clear structure with separate concerns.`,
            severity: 'low',
            category: 'best_practice'
          },
          {
            id: uuidv4(),
            title: 'Consider refactoring some components',
            description: 'Several components could benefit from being broken down into smaller, more focused components.',
            severity: 'medium',
            category: 'refactoring'
          }
        ]
      };
      
      store.updateAnalysis(analysisId, updatedAnalysis);
      console.log(`Analysis completed for repository: ${repository.name}`);
    }, 5000);
    
    return res.status(201).json({ repository });
    
  } catch (error) {
    console.error('Error during repository ingestion:', error);
    return res.status(500).json({ error: 'An error occurred during repository ingestion' });
  }
});

// Get analyses for a repository
app.get('/api/repositories/:repositoryId/analyses', (req, res) => {
  const { repositoryId } = req.params;
  const repository = store.getRepositoryById(repositoryId);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  const analyses = store.getAnalysesByRepositoryId(repositoryId);
  res.json({ analyses });
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
