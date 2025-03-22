const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

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

// Mock repositories data store (in a real app, this would be a database)
const repositories = [];

// API Routes
app.post('/api/public-repositories', (req, res) => {
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
    
    // Create a mock repository object
    const repository = {
      id: uuidv4(),
      url,
      owner,
      name,
      fileCount: Math.floor(Math.random() * 100) + 20,
      sizeInBytes: Math.floor(Math.random() * 5000000) + 1000000,
      createdAt: new Date().toISOString(),
      summary: {
        language: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Ruby'][Math.floor(Math.random() * 5)]
      },
      ingestedContent: {
        allFilesIncluded: includeAllFiles,
        tree: `
├── src/
│   ├── components/
│   │   ├── App.jsx
│   │   ├── Header.jsx
│   │   └── Footer.jsx
│   ├── utils/
│   │   └── helpers.js
│   └── index.js
├── tests/
│   └── app.test.js
├── package.json
└── README.md
        `,
        fullCode: `// Sample code for ${owner}/${name}
import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
        `,
        readme: `# ${name}\n\nA sample repository created by ${owner}.\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n## Installation\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\``
      }
    };
    
    // Add to in-memory store
    repositories.unshift(repository);
    
    return res.status(201).json({ 
      success: true,
      repository
    });
  } catch (error) {
    console.error('Error ingesting repository:', error);
    return res.status(500).json({ error: 'Failed to ingest repository' });
  }
});

app.get('/api/repositories', (req, res) => {
  res.json({ repositories });
});

app.get('/api/repositories/:id', (req, res) => {
  const repository = repositories.find(repo => repo.id === req.params.id);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  res.json({ repository });
});

app.post('/api/repositories/:id/additional-files', (req, res) => {
  const repository = repositories.find(repo => repo.id === req.params.id);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  // Update the repository to include all files
  repository.ingestedContent.allFilesIncluded = true;
  repository.fileCount += Math.floor(Math.random() * 50) + 10;
  repository.sizeInBytes += Math.floor(Math.random() * 1000000) + 100000;
  
  res.json({ 
    success: true,
    repository 
  });
});

app.post('/api/extract/:id', (req, res) => {
  const { apiKey } = req.body;
  const repository = repositories.find(repo => repo.id === req.params.id);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  if (!apiKey) {
    return res.status(400).json({ error: 'Claude API key is required' });
  }
  
  // Mock a delay for Claude AI processing
  setTimeout(() => {
    const extractedCode = `// Core algorithm extracted from ${repository.owner}/${repository.name}
function processData(input) {
  // Parse input data
  const data = JSON.parse(input);
  
  // Apply transformation
  const result = data.map(item => ({
    id: item.id,
    name: item.name,
    score: calculateScore(item)
  }));
  
  return result;
}

function calculateScore(item) {
  // Core scoring algorithm
  let score = item.baseValue * 0.8;
  
  if (item.factors) {
    score += item.factors.reduce((sum, factor) => sum + factor.weight, 0);
  }
  
  return Math.round(score * 100) / 100;
}

// Main processing function
export function analyzeRepository(repo) {
  const metrics = processData(repo.data);
  return {
    summary: generateSummary(metrics),
    details: metrics,
    timestamp: new Date().toISOString()
  };
}`;
    
    res.json({ 
      success: true,
      extractedCode 
    });
  }, 2000);
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
