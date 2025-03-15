import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import bodyParser from 'body-parser';
import path from 'path';
import InMemoryStore, { Repository, Analysis } from './services/in-memory-store';
import axios from 'axios';

// Initialize the express application
const app = express();
const port = process.env.PORT || 3030;
const store = InMemoryStore.getInstance();

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Basic health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({ status: 'healthy', message: 'Server is running in simplified mode with in-memory storage' });
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
app.get('/api/repositories', (_req: Request, res: Response) => {
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
  const newRepo: Repository = {
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
  const { owner, name } = req.body;
  
  if (!owner || !name) {
    return res.status(400).json({ error: 'Owner and name are required' });
  }
  
  try {
    // Check if the repository exists on GitHub
    const githubResponse = await axios.get(`https://api.github.com/repos/${owner}/${name}`);
    const repoData = githubResponse.data;
    
    if (!repoData) {
      return res.status(404).json({ error: 'Repository not found on GitHub' });
    }
    
    // Use our demo user ID for simplicity in this simplified version
    const userId = store.getUsers()[0].id;
    
    // Check if repository already exists in our system
    const existingRepo = store.getRepositoryByOwnerAndName(userId, owner, name);
    
    if (existingRepo) {
      return res.status(200).json({ repository: existingRepo, message: 'Repository already exists' });
    }
    
    // Create new repository with data from GitHub API
    const newRepo: Repository = {
      id: `repo-${uuidv4()}`,
      userId,
      owner,
      name,
      description: repoData.description || `${name} repository`,
      url: repoData.html_url,
      language: repoData.language || 'Unknown',
      stargazersCount: repoData.stargazers_count || 0,
      forksCount: repoData.forks_count || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const repository = store.createRepository(newRepo);
    
    // For simplicity, we'll trigger an analysis right away
    const newAnalysis: Analysis = {
      id: `analysis-${uuidv4()}`,
      repositoryId: repository.id,
      userId,
      status: 'pending',
      startedAt: new Date(),
      completedAt: null,
      insights: [],
      vulnerabilities: [],
      specification: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const analysis = store.createAnalysis(newAnalysis);
    
    // Simulate analysis completion after 5 seconds
    setTimeout(() => {
      const updatedAnalysis: Partial<Analysis> = {
        status: 'completed',
        completedAt: new Date(),
        insights: [
          {
            id: `insight-${uuidv4()}`,
            title: 'Good code organization',
            description: `The ${repository.name} codebase has a clear structure with separate concerns.`,
            severity: 'low',
            category: 'best_practice'
          },
          {
            id: `insight-${uuidv4()}`,
            title: 'Missing test coverage',
            description: 'Some critical components lack proper test coverage.',
            severity: 'medium',
            category: 'testing'
          }
        ],
        vulnerabilities: [
          {
            id: `vuln-${uuidv4()}`,
            title: 'Potential dependency vulnerability',
            description: 'The application uses outdated dependencies with known security issues.',
            severity: 'high',
            recommendation: 'Update dependencies to the latest versions.',
            location: 'package.json'
          }
        ],
        specification: {
          overview: `${repository.name} is a ${repository.language} project hosted by ${repository.owner}.`,
          components: [
            {
              name: 'Frontend',
              description: 'User interface components',
              responsibilities: ['Rendering', 'State management', 'User interactions']
            },
            {
              name: 'Backend',
              description: 'Server-side logic',
              responsibilities: ['API endpoints', 'Business logic', 'Data access']
            }
          ]
        },
        updatedAt: new Date()
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
app.get('/api/repositories/:repositoryId/analyses', (req: Request, res: Response) => {
  const { repositoryId } = req.params;
  const analyses = store.getAnalyses(repositoryId);
  
  return res.json({ analyses });
});

app.get('/api/analyses/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const analysis = store.getAnalysisById(id);
  
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }
  
  return res.json({ analysis });
});

app.post('/api/repositories/:repositoryId/analyses', (req: Request, res: Response) => {
  const { repositoryId } = req.params;
  const repository = store.getRepositoryById(repositoryId);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  const userId = store.getUsers()[0].id;
  
  // Create a new analysis with pending status
  const newAnalysis: Analysis = {
    id: `analysis-${uuidv4()}`,
    repositoryId,
    userId,
    status: 'pending',
    startedAt: new Date(),
    completedAt: null,
    insights: [],
    vulnerabilities: [],
    specification: null,
    createdAt: new Date(),
    updatedAt: new Date()
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
      insights: [
        {
          id: `insight-${uuidv4()}`,
          title: 'Good code organization',
          description: 'The codebase has a clear structure with separate concerns.',
          severity: 'low',
          category: 'best_practice'
        },
        {
          id: `insight-${uuidv4()}`,
          title: 'Missing test coverage',
          description: 'Some critical components lack proper test coverage.',
          severity: 'medium',
          category: 'testing'
        }
      ],
      vulnerabilities: [
        {
          id: `vuln-${uuidv4()}`,
          title: 'Potential dependency vulnerability',
          description: 'The application uses outdated dependencies with known security issues.',
          severity: 'high',
          recommendation: 'Update dependencies to the latest versions.',
          location: 'package.json'
        }
      ],
      specification: {
        overview: `${repository.name} is a ${repository.language} project with standard architecture.`,
        components: [
          {
            name: 'Frontend',
            description: 'User interface components',
            responsibilities: ['Rendering', 'State management', 'User interactions']
          },
          {
            name: 'Backend',
            description: 'Server-side logic',
            responsibilities: ['API endpoints', 'Business logic', 'Data access']
          }
        ]
      },
      updatedAt: new Date()
    };
    
    store.updateAnalysis(analysis.id, updatedAnalysis);
    console.log(`Analysis ${analysis.id} completed`);
  }, 5000);
  
  return;
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port} in simplified mode with in-memory storage`);
  console.log(`Health check available at http://localhost:${port}/api/health`);
});

export default app;
