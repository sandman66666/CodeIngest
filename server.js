// Express server for Heroku deployment
const express = require('express');
const path = require('path');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Basic CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

// Mock repositories endpoint
app.get('/api/repositories', (req, res) => {
  res.json({
    repositories: [
      { 
        id: '1', 
        name: 'example-repo', 
        owner: 'github-user',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'sample-project',
        owner: 'github-user',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '3',
        name: 'test-codebase',
        owner: 'test-user',
        status: 'pending',
        createdAt: new Date(Date.now() - 172800000).toISOString()
      }
    ]
  });
});

// Mock ingest endpoint
app.post('/api/repositories/:id/ingest', (req, res) => {
  const repoId = req.params.id;
  res.json({
    success: true,
    repoId,
    message: 'Repository ingestion started',
    timestamp: new Date().toISOString()
  });
});

// Mock repository details endpoint
app.get('/api/repositories/:id', (req, res) => {
  const repoId = req.params.id;
  res.json({
    id: repoId,
    name: repoId === '1' ? 'example-repo' : (repoId === '2' ? 'sample-project' : 'test-codebase'),
    owner: repoId === '3' ? 'test-user' : 'github-user',
    status: repoId === '3' ? 'pending' : 'active',
    files: repoId === '1' ? 150 : (repoId === '2' ? 230 : 75),
    size: repoId === '1' ? '2.4MB' : (repoId === '2' ? '3.8MB' : '1.2MB'),
    lastIngested: new Date().toISOString(),
    languages: repoId === '1' ? 
      ['JavaScript', 'TypeScript', 'CSS', 'HTML'] : 
      (repoId === '2' ? ['Python', 'JavaScript', 'HTML'] : ['Java', 'XML'])
  });
});

// Add repository endpoint
app.post('/api/repositories', (req, res) => {
  const { name, owner, url } = req.body;
  
  // Validate input
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  
  // Mock successful creation
  res.status(201).json({
    id: Math.floor(Math.random() * 10000).toString(),
    name,
    owner: owner || 'default-user',
    url,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
});

// Mock analysis results endpoint
app.get('/api/repositories/:id/analysis', (req, res) => {
  const repoId = req.params.id;
  res.json({
    id: repoId,
    analysisComplete: true,
    summary: {
      totalFiles: repoId === '1' ? 150 : (repoId === '2' ? 230 : 75),
      totalLines: repoId === '1' ? 15000 : (repoId === '2' ? 23000 : 7500),
      languages: repoId === '1' ? 
        [
          { name: 'JavaScript', percentage: 45 },
          { name: 'TypeScript', percentage: 35 },
          { name: 'CSS', percentage: 10 },
          { name: 'HTML', percentage: 10 }
        ] : 
        (repoId === '2' ? 
          [
            { name: 'Python', percentage: 60 },
            { name: 'JavaScript', percentage: 30 },
            { name: 'HTML', percentage: 10 }
          ] : 
          [
            { name: 'Java', percentage: 85 },
            { name: 'XML', percentage: 15 }
          ]
        )
    },
    insights: [
      {
        type: 'complexity',
        description: 'High complexity detected in several key modules',
        files: ['src/main.js', 'src/utils/helpers.js']
      },
      {
        type: 'patterns',
        description: 'Singleton pattern heavily used throughout the codebase',
        examples: ['src/services/api.js', 'src/managers/state.js']
      }
    ]
  });
});

// User authentication endpoints (mock)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simple validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Mock successful login
  res.json({
    success: true,
    token: 'mock-jwt-token-' + Date.now(),
    user: {
      id: '1',
      email,
      name: email.split('@')[0]
    }
  });
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
