import jwt from 'jsonwebtoken';
import { ApiException } from '@codeinsight/common';
import { UserModel } from '../models/user.model';
import { GitHubService } from './github.service';
import env from '../config/env';
import logger from '../config/logger';

export class AuthService {
  async authenticateWithGitHub(code: string): Promise<{
    user: any;
    token: string;
  }> {
    try {
      // Exchange code for access token
      const accessToken = await this.getGitHubAccessToken(code);
      
      // Get user data from GitHub
      const githubService = new GitHubService(accessToken);
      const githubUser = await githubService.getUser();

      // Find or create user in our database
      const user = await this.findOrCreateUser({
        ...githubUser,
        accessToken,
      });

      // Generate JWT token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      logger.error('Authentication Error:', error);
      throw new ApiException(
        'UNAUTHORIZED',
        'Failed to authenticate with GitHub'
      );
    }
  }

  private async getGitHubAccessToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    });

    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: params,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get GitHub access token');
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return data.access_token;
  }

  private async findOrCreateUser(githubUser: {
    githubId: number;
    username: string;
    email: string;
    name?: string;
    avatarUrl: string;
    accessToken: string;
  }) {
    try {
      // Try to find existing user
      let user = await UserModel.findOne({ githubId: githubUser.githubId });

      if (user) {
        // Update existing user
        user.username = githubUser.username;
        user.email = githubUser.email;
        user.name = githubUser.name;
        user.avatarUrl = githubUser.avatarUrl;
        user.accessToken = githubUser.accessToken;
        await user.save();
      } else {
        // Create new user
        user = await UserModel.create(githubUser);
      }

      return user;
    } catch (error) {
      logger.error('Database Error - findOrCreateUser:', error);
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to process user data'
      );
    }
  }

  private generateToken(user: any): string {
    return jwt.sign(
      {
        id: user._id,
        githubId: user.githubId,
        username: user.username,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
      }
    );
  }

  async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id: string;
        githubId: number;
        username: string;
      };

      const user = await UserModel.findById(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user._id,
        githubId: user.githubId,
        username: user.username,
      };
    } catch (error) {
      throw new ApiException('UNAUTHORIZED', 'Invalid or expired token');
    }
  }

  async revokeAccess(userId: string) {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new ApiException('NOT_FOUND', 'User not found');
      }

      // Clear GitHub access token
      user.accessToken = '';
      await user.save();

      return true;
    } catch (error) {
      logger.error('Failed to revoke access:', error);
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to revoke access'
      );
    }
  }
}
