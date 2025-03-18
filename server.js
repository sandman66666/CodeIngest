// Super simple Express server for Heroku deployment
const express = require('express');
const path = require('path');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;

// Middleware - minimal
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
      }
    ]
  });
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
