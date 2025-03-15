export * from './types/analysis';
export * from './types/user';
export * from './types/error';

export const API_ROUTES = {
  AUTH: {
    GITHUB_LOGIN: '/auth/github',
    GITHUB_CALLBACK: '/auth/github/callback',
    LOGOUT: '/auth/logout',
  },
  REPOSITORIES: {
    LIST: '/repositories',
    GET: (id: string) => `/repositories/${id}`,
    ANALYZE: (id: string) => `/repositories/${id}/analyze`,
  },
  ANALYSIS: {
    LIST: '/analysis',
    GET: (id: string) => `/analysis/${id}`,
    SHARE: (id: string) => `/analysis/${id}/share`,
  },
} as const;

export const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000',
  GITHUB_API_URL: 'https://api.github.com',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
  },
} as const;
