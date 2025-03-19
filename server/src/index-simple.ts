import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import InMemoryStore, { Analysis } from './services/in-memory-store';
import { ingestRepository } from './services/code-ingestion';
import { analyzeCodeWithOpenAI } from './services/openai-service';
import privateRepositoriesRouter from './routes/private-repositories';

// Load environment variables from .env file
dotenv.config();

// Initialize the express application
const app = express();
const port = process.env.PORT || 3000;
const store = InMemoryStore.getInstance();

// In-memory storage for user sessions
const sessions: Record<string, any> = {};

// Environment information
const environment = process.env.NODE_ENV || 'development';
const githubOAuthConfigured = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;
const openaiApiConfigured = process.env.OPENAI_API_KEY;

// Configure middleware
app.use(cors());
app.use(bodyParser.json());

// Add error handling for JSON parsing
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

// Serve static files from the client build directory
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  
  // Path to the public directory in production
  const publicPath = path.join(__dirname, '../../../public');
  
  console.log(`Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));
  
  // For direct URL navigation in SPA (Single Page Application)
  app.get('*', (_, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Basic health check endpoint
app.get('/api/health', (_, res: Response) => {
  return res.json({ status: 'healthy', message: 'Server is running in simplified mode with in-memory storage' });
});

// GitHub OAuth routes
app.get('/api/auth/github', (_, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;
  const scope = 'repo read:user user:email';
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(githubAuthUrl);
});

app.get('/api/auth/github/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code: string };
  
  if (!code) {
    console.error('Missing code parameter in GitHub callback');
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3001'}/login?error=missing_code`);
  }

  try {
    console.log('Processing GitHub callback with code');
    
    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, {
      headers: {
        'Accept': 'application/json'
      }
    });

    const tokenData = tokenResponse.data;
    
    if (tokenData.error) {
      console.error('GitHub token error:', tokenData.error);
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3001'}/login?error=${tokenData.error}`);
    }

    if (!tokenData.access_token) {
      console.error('No access token in GitHub response');
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3001'}/login?error=no_access_token`);
    }

    console.log('Successfully received GitHub access token');
    
    // Get user data from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const userData = userResponse.data;
    console.log('Received user data for:', userData.login);
    
    // Create session
    const sessionId = Math.random().toString(36).substring(2);
    sessions[sessionId] = {
      id: userData.id,
      username: userData.login,
      email: userData.email || `${userData.login}@example.com`, // Fallback if no email
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url,
      accessToken: tokenData.access_token,
    };

    // Create JWT
    const token = jwt.sign(
      { sessionId },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    console.log('Generated JWT token, redirecting to client');
    
    // Redirect back to the client with the token
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3001'}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Authentication error:', error);
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3001'}/login?error=server_error`);
  }
});

app.get('/api/auth/profile', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { sessionId: string };
    const sessionId = decoded.sessionId;
    
    const userData = sessions[sessionId];
    if (!userData) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    return res.json({
      status: 'success',
      data: {
        id: userData.id,
        login: userData.username,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatarUrl,
      },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Authentication endpoints
app.get('/api/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // In a real app, we would validate the token
  // For our simplified version, we'll just return the demo user
  const demoUser = store.getUsers()[0];
  
  if (!demoUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Convert to API response format
  const user = {
    id: demoUser.id,
    login: demoUser.username,
    name: demoUser.name || demoUser.username,
    email: demoUser.email,
    avatarUrl: demoUser.avatarUrl
  };
  
  return res.json({ user });
});

// Repository endpoints
app.get('/api/repositories', (_, res: Response) => {
  // In a real app, we'd get the user ID from the authenticated request
  const userId = store.getUsers()[0].id;
  const repositories = store.getRepositories(userId);
  
  return res.json({ repositories });
});

app.get('/api/repositories/:owner/:name', (req: Request, res: Response) => {
  const { owner, name } = req.params;
  const userId = store.getUsers()[0].id;
  
  const repository = store.getRepositoryByOwnerAndName(userId, owner, name);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  return res.json({ repository });
});

app.post('/api/repositories', (req: Request, res: Response) => {
  const { owner, name } = req.body;
  
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
    url: `https://github.com/${owner}/${name}`,
    language: 'JavaScript',
    stargazersCount: Math.floor(Math.random() * 1000),
    forksCount: Math.floor(Math.random() * 200),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const repository = store.createRepository(newRepo);
  return res.status(201).json({ repository });
});

// New endpoint to ingest public GitHub repositories without login
app.post('/api/public-repositories', async (req: Request, res: Response) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'GitHub repository URL is required' });
  }
  
  // Parse owner and name from GitHub URL
  let repoOwner: string;
  let repoName: string;
  
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
    } catch (error: any) {
      if (error.response?.status === 404) {
        return res.status(404).json({ error: 'Repository not found on GitHub' });
      } else if (error.response?.status === 403) {
        return res.status(403).json({ error: 'This repository appears to be private. Please log in with GitHub to access private repositories.' });
      } else {
        throw error; // Re-throw for the outer catch block
      }
    }
    
    const repoData = githubResponse.data;
    
    // Check if the repository is private
    if (repoData.private) {
      return res.status(403).json({ error: 'This is a private repository. Please log in with GitHub to access private repositories.' });
    }
    
    // Use our demo user ID for simplicity in this simplified version
    const userId = store.getUsers()[0].id;
    
    // Check if repository already exists in our system
    const existingRepo = store.getRepositoryByOwnerAndName(userId, repoOwner, repoName);
    
    if (existingRepo) {
      // For testing purposes, let's add some mock code for existing repos if they don't have code
      if (!existingRepo.ingestedContent || !existingRepo.ingestedContent.fullCode) {
        console.log(`Adding mock code content for existing repository: ${repoOwner}/${repoName}`);
        const mockCode = `// Mock code for ${repoOwner}/${repoName}
import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>${repoName} Demo</h1>
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
      </header>
    </div>
  );
}

export default App;`;

        existingRepo.ingestedContent = {
          summary: `# Repository: ${repoOwner}/${repoName}\n\n`,
          tree: "- /src\n  - /components\n    - App.js\n  - index.js\n- package.json\n- README.md",
          fullCode: mockCode,
          fileCount: 5,
          sizeInBytes: mockCode.length
        };
        
        // Update the repository in the store
        store.updateRepository(existingRepo.id, existingRepo);
      }
      
      return res.status(200).json({ repository: existingRepo, message: 'Repository already exists' });
    }
    
    // ---- Perform code ingestion process ----
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
    
    const repository = {
      ...newRepo
    };

    store.createRepository(repository);

    const analysisId = uuidv4();
    const analysis: Analysis = {
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
      const updatedAnalysis: Partial<Analysis> = {
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
            title: 'Missing test coverage',
            description: 'Some critical components lack proper test coverage.',
            severity: 'medium',
            category: 'testing'
          }
        ]
      };
      
      store.updateAnalysis(analysis.id, updatedAnalysis);
      console.log(`Analysis ${analysis.id} for public repository ${repository.owner}/${repository.name} completed`);
    }, 5000);
    
    return res.status(201).json({ 
      repository, 
      analysisId: analysis.id,
      message: 'Repository ingested successfully and analysis initiated'
    });
    
  } catch (error) {
    console.error('Error ingesting public repository:', error);
    return res.status(500).json({ 
      error: 'Failed to ingest repository', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analysis endpoints
app.get('/api/repositories/:repositoryId/analyses', (_, res: Response) => {
  const { repositoryId } = _.params;
  const analyses = store.getAnalyses(repositoryId);
  
  return res.json({ analyses });
});

app.get('/api/analyses/:id', (_, res: Response) => {
  const { id } = _.params;
  const analysis = store.getAnalysisById(id);
  
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }
  
  return res.json({ analysis });
});

app.get('/api/analysis/:analysisId', async (_, res: Response) => {
  const { analysisId } = _.params;
  const analysis = store.getAnalysisById(analysisId);

  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  // Get the repository details
  const repository = store.getRepositoryById(analysis.repositoryId);
  
  return res.status(200).json({
    analysis,
    repository
  });
});

app.post('/api/repositories/:repositoryId/analyses', (_, res: Response) => {
  const { repositoryId } = _.params;
  const repository = store.getRepositoryById(repositoryId);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  // Create a new analysis with pending status
  const newAnalysis: Analysis = {
    id: `analysis-${uuidv4()}`,
    repositoryId,
    status: 'pending',
    createdAt: new Date(),
    completedAt: null,
    results: null
  };
  
  const analysis = store.createAnalysis(newAnalysis);
  
  // In a real app, we would start the analysis process asynchronously
  // For our simplified version, we'll just return the created analysis
  res.status(201).json({ analysis });
  
  // Simulate analysis completion after 5 seconds
  setTimeout(() => {
    const updatedAnalysis: Partial<Analysis> = {
      status: 'completed',
      completedAt: new Date(),
      results: [
        {
          id: uuidv4(),
          title: 'Code Quality Issue',
          description: 'Mock: The code has inconsistent formatting.',
          severity: 'low',
          category: 'code_quality'
        },
        {
          id: uuidv4(),
          title: 'Potential Security Vulnerability',
          description: 'Mock: There might be an XSS vulnerability in the input handling.',
          severity: 'high',
          category: 'security'
        }
      ]
    };
    
    store.updateAnalysis(analysis.id, updatedAnalysis);
    console.log(`Analysis ${analysis.id} completed`);
  }, 5000);
  
  return;
});

app.post('/api/analysis/:repositoryId', async (req: Request, res: Response) => {
  const { repositoryId } = req.params;
  
  // Validate repository exists
  const repository = store.getRepositoryById(repositoryId);
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  if (!repository.ingestedContent?.fullCode) {
    return res.status(400).json({ error: 'Repository content not found. Please ingest the repository first.' });
  }
  
  try {
    // Create a new analysis record
    const analysisId = uuidv4();
    const analysis: Analysis = {
      id: analysisId,
      repositoryId,
      status: 'pending',
      createdAt: new Date(),
      completedAt: null,
      results: null
    };
    
    // Save the analysis to the store
    store.createAnalysis(analysis);
    
    // Get API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not configured. Using mock analysis.');
      
      // If no API key, provide mock analysis after a delay
      setTimeout(() => {
        store.updateAnalysis(analysisId, {
          status: 'completed',
          completedAt: new Date(),
          results: [
            {
              id: uuidv4(),
              title: 'Mock Analysis Result',
              description: 'This is a mock result because no OpenAI API key is configured.',
              severity: 'medium',
              category: 'code_quality'
            },
            {
              id: uuidv4(),
              title: 'Configuration Needed',
              description: 'To get real analysis results, please configure an OpenAI API key in the environment variables.',
              severity: 'low',
              category: 'best_practice'
            }
          ]
        });
      }, 3000);
      
      return res.status(200).json({
        status: 'success',
        analysisId,
        message: 'No API key configured. Mock analysis will be performed.'
      });
    }
    
    // Start analysis in background
    (async () => {
      try {
        // Use OpenAI for analysis
        console.log(`Starting code analysis with OpenAI for repository: ${repository.owner}/${repository.name}`);
        
        const analysisResults = await analyzeCodeWithOpenAI(
          apiKey,
          repository
        );
        
        // Update the analysis with the results
        store.updateAnalysis(analysisId, {
          status: 'completed',
          completedAt: new Date(),
          results: analysisResults.insights
        });
        
        console.log(`Analysis completed for repository: ${repository.owner}/${repository.name}`);
      } catch (error) {
        console.error('Analysis error:', error);
        store.updateAnalysis(analysisId, {
          status: 'failed',
          completedAt: new Date(),
          results: null
        });
      }
    })();
    
    return res.status(200).json({
      status: 'success',
      analysisId
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    return res.status(500).json({ error: 'Failed to start analysis' });
  }
});

// Mock analysis endpoint (for development only)
app.post('/api/analysis/mock/:repositoryId', (_, res: Response) => {
  const { repositoryId } = _.params;
  
  // Create a new analysis with pending status
  const newAnalysis: Analysis = {
    id: `analysis-${uuidv4()}`,
    repositoryId,
    status: 'pending',
    createdAt: new Date(),
    completedAt: null,
    results: null
  };
  
  store.createAnalysis(newAnalysis);
  
  // Return the analysis ID
  res.status(202).json({ analysisId: newAnalysis.id });
  
  // Simulate analysis completion after 5 seconds
  setTimeout(() => {
    const updatedAnalysis: Partial<Analysis> = {
      status: 'completed',
      completedAt: new Date(),
      results: [
        {
          id: `result-${uuidv4()}`,
          title: 'Code Quality Issue',
          description: 'This is a mock analysis result. The code has inconsistent formatting.',
          severity: 'low',
          category: 'code_quality'
        },
        {
          id: `result-${uuidv4()}`,
          title: 'Potential Security Vulnerability',
          description: 'This is a mock analysis result. There might be an XSS vulnerability in your input handling.',
          severity: 'high',
          category: 'security'
        }
      ]
    };
    
    store.updateAnalysis(newAnalysis.id, updatedAnalysis);
  }, 5000);
});

app.use('/api/private-repositories', privateRepositoriesRouter);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port} in ${environment} mode with in-memory storage`);
  console.log(`GitHub OAuth configured: ${githubOAuthConfigured ? 'Yes' : 'No'}`);
  console.log(`OpenAI API configured: ${openaiApiConfigured ? 'Yes' : 'No'}`);
  
  if (environment === 'production') {
    console.log(`Server available at your app's URL`);
  } else {
    console.log(`Health check available at http://localhost:${port}/api/health`);
  }
});

export default app;
