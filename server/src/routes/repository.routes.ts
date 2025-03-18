import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { rateLimit } from 'express-rate-limit';
import { RepositoryService } from '../services/repository.service';
import { CacheService } from '../services/cache.service';

const router = Router();
const repositoryService = new RepositoryService();
const cacheService = CacheService.getInstance();

// Create apiLimiter middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const addRepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
});

const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
});

const contentQuerySchema = z.object({
  path: z.string().default(''),
  ref: z.string().optional(),
});

// Add repository
router.post('/', authenticate, apiLimiter, async (req, res, next) => {
  try {
    const { owner, name } = addRepositorySchema.parse(req.body);
    const repository = await repositoryService.addRepository(
      req.user!.id,
      owner,
      name
    );

    // Clear user's repository cache
    await cacheService.delete(`user:${req.user!.id}:repos`);

    return res.status(201).json(repository);
  } catch (error) {
    return next(error);
  }
});

// List user repositories
router.get('/', authenticate, apiLimiter, async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);

    // Try to get from cache
    const cacheKey = `user:${req.user!.id}:repos:${page}:${limit}`;
    const cachedRepos = await cacheService.get(cacheKey);
    if (cachedRepos) {
      return res.json(cachedRepos);
    }

    const result = await repositoryService.getUserRepositories(
      req.user!.id,
      page,
      limit
    );

    // Cache for 5 minutes
    await cacheService.set(cacheKey, result, 300);

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Get repository by ID
router.get('/:id', authenticate, apiLimiter, async (req, res, next) => {
  try {
    const repository = await repositoryService.getRepository(
      req.user!.id,
      req.params.id
    );
    return res.json(repository);
  } catch (error) {
    return next(error);
  }
});

// Get repository content
router.get('/:id/content', authenticate, apiLimiter, async (req, res, next) => {
  try {
    const { path, ref } = contentQuerySchema.parse(req.query);
    
    // Try to get from cache
    const cacheKey = `repo:${req.params.id}:content:${path}:${ref || 'default'}`;
    const cachedContent = await cacheService.get(cacheKey);
    if (cachedContent) {
      return res.json(cachedContent);
    }

    const content = await repositoryService.listRepositoryContent(
      req.user!.id,
      req.params.id,
      path,
      ref
    );

    // Cache for 5 minutes
    await cacheService.set(cacheKey, content, 300);

    return res.json(content);
  } catch (error) {
    return next(error);
  }
});

// Sync repository with GitHub
router.post('/:id/sync', authenticate, apiLimiter, async (req, res, next) => {
  try {
    const repository = await repositoryService.syncWithGitHub(
      req.user!.id,
      req.params.id
    );

    // Clear repository caches
    const cacheKeys = [
      `repo:${req.params.id}`,
      `user:${req.user!.id}:repos`,
    ];
    await Promise.all(cacheKeys.map((key) => cacheService.delete(key)));

    return res.json(repository);
  } catch (error) {
    return next(error);
  }
});

// Remove repository
router.delete('/:id', authenticate, apiLimiter, async (req, res, next) => {
  try {
    await repositoryService.removeRepository(req.user!.id, req.params.id);

    // Clear repository caches
    const cacheKeys = [
      `repo:${req.params.id}`,
      `user:${req.user!.id}:repos`,
    ];
    await Promise.all(cacheKeys.map((key) => cacheService.delete(key)));

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
