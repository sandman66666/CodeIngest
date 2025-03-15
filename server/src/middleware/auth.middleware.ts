import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiException } from '@codeinsight/common';
import env from '../config/env';
import { UserModel } from '../models/user.model';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        githubId: number;
        username: string;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new ApiException('UNAUTHORIZED', 'Authentication required');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      githubId: number;
      username: string;
    };

    // Verify user exists in database
    const user = await UserModel.findById(decoded.id);
    if (!user) {
      throw new ApiException('UNAUTHORIZED', 'User not found');
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      githubId: user.githubId,
      username: user.username,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiException('UNAUTHORIZED', 'Invalid token'));
    } else {
      next(error);
    }
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
}
