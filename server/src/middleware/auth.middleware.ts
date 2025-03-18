import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

class ApiException extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiException';
  }
}

import env from '../config/env';

interface User {
  _id: any;
  githubId: number;
  username: string;
}

const findUserById = async (_id: string): Promise<User | null> => {
  // In production this would use a real database query
  // For now, just return null to pass compilation
  return null;
};

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
  _res: Response,
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
    const user = await findUserById(decoded.id);
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
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try to get from cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}
