// Simple Express server for Heroku deployment
const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Mock API endpoint to show server is working
app.get('/api/repositories', (req, res) => {
  res.json({
    message: 'This is a mock API response. The server is working!',
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

// Serve the React app for all other routes (client-side routing)
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`
-------------------------------------------------------
| Server running on port ${PORT} in ${NODE_ENV} mode
| Health check: http${NODE_ENV === 'production' ? 's' : ''}://${NODE_ENV === 'production' ? 'your-app-domain' : 'localhost:' + PORT}/api/health
-------------------------------------------------------
  `);
});
