import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { ApiError } from './error.middleware';

// Default rate limit configuration
const defaultConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response) => {
    throw new ApiError(429, 'Too many requests from this IP, please try again later');
  },
};

// More restrictive limit for authentication routes
export const authLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login attempts per hour
  message: 'Too many login attempts from this IP, please try again after an hour',
  handler: (_req: Request, _res: Response) => {
    throw new ApiError(429, 'Too many login attempts from this IP, please try again after an hour');
  },
});
