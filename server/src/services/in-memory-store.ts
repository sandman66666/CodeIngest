/**
 * In-memory data store for development purposes
 * Replaces MongoDB and Redis with simple in-memory structures
 */

// Types for our in-memory database
export interface User {
  id: string;
  githubId: number;
  username: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string;
  accessToken?: string;
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  url: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  createdAt: Date;
  userId: string;
  isPrivate?: boolean;
  ingestedContent?: {
    summary: string;
    tree: string;
    fullCode: string;
    fileCount: number;
    sizeInBytes: number;
  };
}

export interface Analysis {
  id: string;
  repositoryId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt: Date | null;
  results: any | null;
  insights?: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    category: string;
  }>;
  vulnerabilities?: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
    location: string;
  }>;
  specification?: {
    overview: string;
    components: Array<{
      name: string;
      description: string;
      responsibilities: string[];
    }>;
  };
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
    this.initializeExampleData();
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

  // Initialize with some example data (for development only)
  private initializeExampleData(): void {
    // Create demo user
    const demoUser: User = {
      id: 'user-1',
      username: 'demouser',
      name: 'Demo User',
      email: 'demo@example.com',
      githubId: 123456,
      avatarUrl: 'https://github.com/identicons/demouser.png',
      createdAt: new Date()
    };
    
    this.users.set(demoUser.id, demoUser);
    
    // Create example repositories
    const reactRepo: Repository = {
      id: 'repo-1',
      userId: demoUser.id,
      owner: 'facebook',
      name: 'react',
      description: 'A JavaScript library for building user interfaces',
      url: 'https://github.com/facebook/react',
      language: 'JavaScript',
      stargazersCount: 175000,
      forksCount: 35000,
      isPrivate: false,
      ingestedContent: {
        summary: '# Repository: facebook/react\n\nA powerful JavaScript library for building user interfaces.',
        tree: "- /src\n  - /components\n    - Component.js\n  - /core\n    - React.js\n  - index.js\n- package.json\n- README.md",
        fullCode: `// React core implementation
import { createElement, Component } from './core/React';

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === 'object' ? child : createTextElement(child)
      )
    }
  };
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: []
    }
  };
}

class Component {
  constructor(props) {
    this.props = props;
    this.state = {};
  }
  
  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    // Trigger re-render
  }
  
  render() {
    // Override in subclass
  }
}

export default {
  createElement,
  Component
};`,
        fileCount: 15,
        sizeInBytes: 2500
      },
      createdAt: new Date()
    };
    
    const typescriptRepo: Repository = {
      id: 'repo-2',
      userId: demoUser.id,
      owner: 'microsoft',
      name: 'typescript',
      description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output',
      url: 'https://github.com/microsoft/TypeScript',
      language: 'TypeScript',
      stargazersCount: 75000,
      forksCount: 10000,
      isPrivate: false,
      ingestedContent: {
        summary: '# Repository: microsoft/typescript\n\nA typed superset of JavaScript that compiles to plain JavaScript.',
        tree: "- /src\n  - /compiler\n    - checker.ts\n    - parser.ts\n  - /services\n    - formatting.ts\n  - index.ts\n- package.json\n- README.md",
        fullCode: `// TypeScript compiler implementation
namespace ts {
  export interface CompilerOptions {
    target?: ScriptTarget;
    module?: ModuleKind;
    strict?: boolean;
    outDir?: string;
    rootDir?: string;
    sourceMap?: boolean;
    declaration?: boolean;
  }
  
  export enum ScriptTarget {
    ES3 = 0,
    ES5 = 1,
    ES2015 = 2,
    ES2016 = 3,
    ES2017 = 4,
    ES2018 = 5,
    ES2019 = 6,
    ES2020 = 7,
    ESNext = 8
  }
  
  export enum ModuleKind {
    None = 0,
    CommonJS = 1,
    AMD = 2,
    UMD = 3,
    System = 4,
    ES2015 = 5,
    ESNext = 6
  }
  
  export function createProgram(rootNames: string[], options: CompilerOptions) {
    // Parse source files
    // Check types
    // Emit JavaScript
    return {
      // Program implementation
    };
  }
  
  export function parseJsonConfigFileContent(json: any, host: any, basePath: string) {
    // Parse tsconfig.json
  }
}

export = ts;`,
        fileCount: 25,
        sizeInBytes: 3800
      },
      createdAt: new Date()
    };
    
    this.repositories.set(reactRepo.id, reactRepo);
    this.repositories.set(typescriptRepo.id, typescriptRepo);
  }
}

export default InMemoryStore;
