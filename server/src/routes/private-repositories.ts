import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Repository, Analysis, User } from '../services/in-memory-store';
import InMemoryStore from '../services/in-memory-store';
import { ingestRepository } from '../services/code-ingestion';

const router = express.Router();
const store = InMemoryStore.getInstance();

// Extend the base User with the token we need for API calls
interface AuthenticatedUser extends User {
  githubToken?: string;
  accessToken?: string;
}

// Add user property to Express Request
declare namespace Express {
  export interface Request {
    user?: AuthenticatedUser;
  }
}

// Authentication middleware for private repository routes
const authenticate = async (req: Request, res: Response, next: Function): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in with GitHub.' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Validate the token by making a request to GitHub API
    const githubResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!githubResponse.data?.id) {
      res.status(401).json({ error: 'Invalid GitHub token' });
      return;
    }
    
    // Store GitHub user data in request object for later use
    const userId = githubResponse.data.id.toString();
    const githubUser: AuthenticatedUser = {
      id: userId,
      githubId: githubResponse.data.id,
      username: githubResponse.data.login,
      name: githubResponse.data.name || null,
      email: githubResponse.data.email || null,
      avatarUrl: githubResponse.data.avatar_url,
      accessToken: token,
      githubToken: token
    };
    
    req.user = githubUser;
    
    // Store user in memory if not already exists
    const existingUser = store.getUserById(userId);
    if (!existingUser) {
      store.createUser(githubUser);
    }
    
    next();
  } catch (error: any) {
    if (error.response?.status === 401) {
      res.status(401).json({ error: 'Invalid or expired GitHub token' });
      return;
    }
    
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
    return;
  }
};

// Apply authentication middleware to all routes in this router
router.use(authenticate);

// POST endpoint for ingesting private repositories
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;
  const user = req.user;
  
  if (!url) {
    res.status(400).json({ error: 'GitHub repository URL is required' });
    return;
  }
  
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  // Ensure user has access token
  const authenticatedUser = user as AuthenticatedUser;
  if (!authenticatedUser.accessToken) {
    res.status(401).json({ error: 'GitHub token not available' });
    return;
  }
  
  // Parse owner and name from GitHub URL
  let repoOwner: string;
  let repoName: string;
  
  try {
    const githubUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(githubUrlPattern);
    
    if (!match) {
      res.status(400).json({ error: 'Invalid GitHub URL format. Expected format: https://github.com/owner/repository' });
      return;
    }
    
    repoOwner = match[1];
    repoName = match[2].replace('.git', ''); // Remove .git if present
  } catch (error) {
    res.status(400).json({ error: 'Could not parse GitHub URL' });
    return;
  }
  
  if (!repoOwner || !repoName) {
    res.status(400).json({ error: 'Could not extract repository owner and name from URL' });
    return;
  }
  
  try {
    // Use GitHub token to access the repository (works for both public and private repos the user has access to)
    const githubToken = authenticatedUser.githubToken || authenticatedUser.accessToken;
    const githubResponse = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    // Check if user has access to repository (will throw 404 if not)
    if (!githubResponse.data?.id) {
      res.status(404).json({ error: 'Repository not found or no access' });
      return;
    }
    
    // Generate a repository ID
    const repoId = uuidv4();
    
    // Ingest the repository code
    const ingestionOptions = {
      token: githubToken,
      includePatterns: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.html', '**/*.css', '**/*.json'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
    };
    
    try {
      const ingestionResult = await ingestRepository(repoOwner, repoName, ingestionOptions);
      
      // Create repository entry in our store
      const repository: Repository = {
        id: repoId,
        owner: repoOwner,
        name: repoName,
        description: githubResponse.data.description || null,
        url: githubResponse.data.html_url,
        language: githubResponse.data.language || null,
        stargazersCount: githubResponse.data.stargazers_count,
        forksCount: githubResponse.data.forks_count,
        createdAt: new Date(),
        userId: user.id,
        isPrivate: githubResponse.data.private,
        ingestedContent: {
          summary: ingestionResult.summary,
          tree: ingestionResult.tree,
          fullCode: ingestionResult.content,
          fileCount: ingestionResult.fileCount,
          sizeInBytes: ingestionResult.totalSizeBytes
        }
      };
      
      // Store repository in memory
      store.createRepository(repository);
      
      // Create initial analysis
      const analysisId = uuidv4();
      const analysis: Analysis = {
        id: analysisId,
        repositoryId: repoId,
        status: 'pending',
        createdAt: new Date(),
        completedAt: null,
        results: null
      };
      
      store.createAnalysis(analysis);
      
      // Return success response
      res.status(200).json({
        message: 'Private repository ingested successfully',
        repository,
        analysisId
      });
    } catch (ingestionError) {
      console.error('Repository ingestion error:', ingestionError);
      res.status(500).json({ error: 'Failed to ingest repository code. Please try again.' });
    }
  } catch (error: any) {
    console.error('GitHub API error:', error);
    
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Repository not found or you don\'t have access to it' });
      return;
    }
    
    if (error.response?.status === 401) {
      res.status(401).json({ error: 'GitHub authentication failed. Please re-authenticate.' });
      return;
    }
    
    res.status(500).json({ error: 'Failed to retrieve repository information' });
  }
});

export default router;
