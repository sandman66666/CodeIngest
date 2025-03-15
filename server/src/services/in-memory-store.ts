/**
 * In-memory data store for development purposes
 * Replaces MongoDB and Redis with simple in-memory structures
 */

// Types for our in-memory database
export interface User {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
  githubId: number;
  accessToken: string;
}

export interface Repository {
  id: string;
  userId: string;
  name: string;
  owner: string;
  description: string | null;
  url: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Analysis {
  id: string;
  repositoryId: string;
  userId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  insights: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    category: string;
  }>;
  vulnerabilities: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
    location: string;
  }>;
  specification: {
    overview: string;
    components: Array<{
      name: string;
      description: string;
      responsibilities: string[];
    }>;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

// Singleton class to manage in-memory data
class InMemoryStore {
  private static instance: InMemoryStore;
  private users: Map<string, User>;
  private repositories: Map<string, Repository>;
  private analyses: Map<string, Analysis>;
  private cache: Map<string, { value: any; expiry: number | null }>;

  private constructor() {
    this.users = new Map();
    this.repositories = new Map();
    this.analyses = new Map();
    this.cache = new Map();
    this.seedDemoData();
  }

  public static getInstance(): InMemoryStore {
    if (!InMemoryStore.instance) {
      InMemoryStore.instance = new InMemoryStore();
    }
    return InMemoryStore.instance;
  }

  // User methods
  public getUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getUserById(id: string): User | null {
    return this.users.get(id) || null;
  }

  public getUserByGithubId(githubId: number): User | null {
    return Array.from(this.users.values()).find(u => u.githubId === githubId) || null;
  }

  public createUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | null {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  public deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  // Repository methods
  public getRepositories(userId?: string): Repository[] {
    const repos = Array.from(this.repositories.values());
    return userId ? repos.filter(r => r.userId === userId) : repos;
  }

  public getRepositoryById(id: string): Repository | null {
    return this.repositories.get(id) || null;
  }

  public getRepositoryByOwnerAndName(userId: string, owner: string, name: string): Repository | null {
    return Array.from(this.repositories.values()).find(
      r => r.userId === userId && r.owner === owner && r.name === name
    ) || null;
  }

  public createRepository(repository: Repository): Repository {
    this.repositories.set(repository.id, repository);
    return repository;
  }

  public updateRepository(id: string, updates: Partial<Repository>): Repository | null {
    const repository = this.repositories.get(id);
    if (!repository) return null;
    
    const updatedRepository = { ...repository, ...updates };
    this.repositories.set(id, updatedRepository);
    return updatedRepository;
  }

  public deleteRepository(id: string): boolean {
    return this.repositories.delete(id);
  }

  // Analysis methods
  public getAnalyses(repositoryId?: string): Analysis[] {
    const analyses = Array.from(this.analyses.values());
    return repositoryId ? analyses.filter(a => a.repositoryId === repositoryId) : analyses;
  }

  public getAnalysisById(id: string): Analysis | null {
    return this.analyses.get(id) || null;
  }

  public createAnalysis(analysis: Analysis): Analysis {
    this.analyses.set(analysis.id, analysis);
    return analysis;
  }

  public updateAnalysis(id: string, updates: Partial<Analysis>): Analysis | null {
    const analysis = this.analyses.get(id);
    if (!analysis) return null;
    
    const updatedAnalysis = { ...analysis, ...updates };
    this.analyses.set(id, updatedAnalysis);
    return updatedAnalysis;
  }

  public deleteAnalysis(id: string): boolean {
    return this.analyses.delete(id);
  }

  // Cache methods (replacing Redis)
  public setCache(key: string, value: any, ttlSeconds?: number): void {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiry });
  }

  public getCache<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  public deleteCache(key: string): boolean {
    return this.cache.delete(key);
  }

  public clearCache(): void {
    this.cache.clear();
  }

  // Seed with some demo data
  private seedDemoData(): void {
    // Add a demo user
    const demoUser: User = {
      id: 'user-1',
      username: 'devuser',
      name: 'Development User',
      email: 'dev@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      githubId: 1,
      accessToken: 'mock-token',
    };
    this.users.set(demoUser.id, demoUser);

    // Add some demo repositories
    const demoRepos: Repository[] = [
      {
        id: 'repo-1',
        userId: 'user-1',
        name: 'react',
        owner: 'facebook',
        description: 'A JavaScript library for building user interfaces',
        url: 'https://github.com/facebook/react',
        language: 'JavaScript',
        stargazersCount: 200000,
        forksCount: 40000,
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2023-06-15'),
      },
      {
        id: 'repo-2',
        userId: 'user-1',
        name: 'typescript',
        owner: 'microsoft',
        description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output',
        url: 'https://github.com/microsoft/typescript',
        language: 'TypeScript',
        stargazersCount: 85000,
        forksCount: 10000,
        createdAt: new Date('2020-03-15'),
        updatedAt: new Date('2023-05-20'),
      },
      {
        id: 'repo-3',
        userId: 'user-1',
        name: 'node',
        owner: 'nodejs',
        description: 'Node.js JavaScript runtime',
        url: 'https://github.com/nodejs/node',
        language: 'JavaScript',
        stargazersCount: 92000,
        forksCount: 24000,
        createdAt: new Date('2020-02-10'),
        updatedAt: new Date('2023-06-01'),
      },
    ];

    demoRepos.forEach(repo => this.repositories.set(repo.id, repo));

    // Add a demo analysis
    const demoAnalysis: Analysis = {
      id: 'analysis-1',
      repositoryId: 'repo-1',
      userId: 'user-1',
      status: 'completed',
      startedAt: new Date('2023-06-16T10:00:00Z'),
      completedAt: new Date('2023-06-16T10:05:00Z'),
      insights: [
        {
          id: 'insight-1',
          title: 'Extensive use of React Hooks',
          description: 'The codebase makes extensive use of React Hooks, which improves code reusability and simplifies state management.',
          severity: 'low',
          category: 'best_practice',
        },
        {
          id: 'insight-2',
          title: 'Missing error handling in asynchronous operations',
          description: 'Several components lack proper error handling for async operations, which could lead to unexpected behavior.',
          severity: 'medium',
          category: 'error_handling',
        },
      ],
      vulnerabilities: [
        {
          id: 'vuln-1',
          title: 'Potential XSS vulnerability',
          description: 'The application uses dangerouslySetInnerHTML without proper input sanitization.',
          severity: 'high',
          recommendation: 'Implement a proper sanitization library like DOMPurify before rendering user-generated content.',
          location: 'src/components/UserContent.jsx:42',
        },
      ],
      specification: {
        overview: 'React is a JavaScript library for building user interfaces, particularly single-page applications.',
        components: [
          {
            name: 'React Core',
            description: 'The core React library that provides component-based architecture.',
            responsibilities: ['Virtual DOM', 'Component lifecycle', 'State management'],
          },
          {
            name: 'React DOM',
            description: 'Renderer for web applications that enables React components to interact with the DOM.',
            responsibilities: ['DOM updates', 'Event handling', 'Browser compatibility'],
          },
        ],
      },
      createdAt: new Date('2023-06-16T10:00:00Z'),
      updatedAt: new Date('2023-06-16T10:05:00Z'),
    };

    this.analyses.set(demoAnalysis.id, demoAnalysis);
  }
}

export default InMemoryStore;
