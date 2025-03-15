import { createClient, RedisClientType } from 'redis';
import { ApiException } from '@codeinsight/common';
import env from '../config/env';
import logger from '../config/logger';

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType;
  private connected: boolean;

  private constructor() {
    this.connected = false;
    this.client = createClient({
      url: env.REDIS_URL,
    });

    this.setupEventHandlers();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private setupEventHandlers() {
    this.client.on('error', (error) => {
      logger.error('Redis Client Error:', error);
      this.connected = false;
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis successfully');
      this.connected = true;
    });
  }

  public async connect() {
    if (!this.connected) {
      try {
        await this.client.connect();
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw new ApiException(
          'INTERNAL_SERVER_ERROR',
          'Failed to connect to cache service'
        );
      }
    }
  }

  public async disconnect() {
    if (this.connected) {
      try {
        await this.client.quit();
        this.connected = false;
      } catch (error) {
        logger.error('Failed to disconnect from Redis:', error);
      }
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  public async increment(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }

  public async getRateLimit(key: string, windowSeconds: number): Promise<number> {
    try {
      const count = await this.client.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error('Rate limit get error:', error);
      return 0;
    }
  }

  public async setRateLimit(
    key: string,
    windowSeconds: number,
    maxRequests: number
  ): Promise<boolean> {
    try {
      const count = await this.increment(key);
      if (count === 1) {
        await this.client.expire(key, windowSeconds);
      }
      return count <= maxRequests;
    } catch (error) {
      logger.error('Rate limit set error:', error);
      return false;
    }
  }

  public async clearRateLimit(key: string): Promise<void> {
    await this.delete(key);
  }

  // Analysis caching methods
  public async getCachedAnalysis(repoId: string): Promise<unknown | null> {
    return this.get(`analysis:${repoId}`);
  }

  public async setCachedAnalysis(
    repoId: string,
    analysis: unknown,
    ttlSeconds = 3600 // 1 hour default
  ): Promise<void> {
    await this.set(`analysis:${repoId}`, analysis, ttlSeconds);
  }

  // Repository content caching methods
  public async getCachedRepoContent(
    owner: string,
    repo: string,
    path: string
  ): Promise<unknown | null> {
    return this.get(`repo:${owner}:${repo}:${path}`);
  }

  public async setCachedRepoContent(
    owner: string,
    repo: string,
    path: string,
    content: unknown,
    ttlSeconds = 300 // 5 minutes default
  ): Promise<void> {
    await this.set(
      `repo:${owner}:${repo}:${path}`,
      content,
      ttlSeconds
    );
  }

  // User repository list caching
  public async getCachedUserRepos(userId: string): Promise<unknown | null> {
    return this.get(`user:${userId}:repos`);
  }

  public async setCachedUserRepos(
    userId: string,
    repos: unknown,
    ttlSeconds = 300 // 5 minutes default
  ): Promise<void> {
    await this.set(`user:${userId}:repos`, repos, ttlSeconds);
  }

  // Generic cache key builder
  public static buildKey(...parts: string[]): string {
    return parts.join(':');
  }
}
