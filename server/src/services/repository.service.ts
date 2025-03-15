import { ApiException } from '@codeinsight/common';
import { RepositoryModel } from '../models/repository.model';
import { GitHubService } from './github.service';
import { UserModel } from '../models/user.model';
import logger from '../config/logger';

export class RepositoryService {
  async addRepository(userId: string, owner: string, name: string) {
    try {
      // Get user with GitHub access token
      const user = await UserModel.findById(userId).select('+accessToken');
      if (!user) {
        throw new ApiException('NOT_FOUND', 'User not found');
      }

      // Initialize GitHub service with user's token
      const githubService = new GitHubService(user.accessToken);

      // Fetch repository details from GitHub
      const repoDetails = await githubService.getRepository(owner, name);

      // Create repository in database
      const repository = await RepositoryModel.create({
        userId,
        ...repoDetails,
      });

      // Set up webhook for repository updates
      if (process.env.GITHUB_WEBHOOK_URL) {
        await githubService.createRepositoryWebhook(
          owner,
          name,
          process.env.GITHUB_WEBHOOK_URL
        );
      }

      return repository;
    } catch (error) {
      logger.error('Failed to add repository:', error);
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to add repository'
      );
    }
  }

  async getUserRepositories(userId: string, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const [repositories, total] = await Promise.all([
        RepositoryModel.find({ userId })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
        RepositoryModel.countDocuments({ userId }),
      ]);

      return {
        repositories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get user repositories:', error);
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to fetch repositories'
      );
    }
  }

  async getRepository(userId: string, repoId: string) {
    try {
      const repository = await RepositoryModel.findOne({
        _id: repoId,
        userId,
      });

      if (!repository) {
        throw new ApiException('NOT_FOUND', 'Repository not found');
      }

      return repository;
    } catch (error) {
      logger.error('Failed to get repository:', error);
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to fetch repository'
      );
    }
  }

  async syncWithGitHub(userId: string, repoId: string) {
    try {
      const repository = await this.getRepository(userId, repoId);
      const user = await UserModel.findById(userId).select('+accessToken');
      if (!user) {
        throw new ApiException('NOT_FOUND', 'User not found');
      }

      const githubService = new GitHubService(user.accessToken);
      const repoDetails = await githubService.getRepository(
        repository.owner,
        repository.name
      );

      // Update repository details
      Object.assign(repository, repoDetails);
      await repository.save();

      return repository;
    } catch (error) {
      logger.error('Failed to sync repository:', error);
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to sync repository'
      );
    }
  }

  async removeRepository(userId: string, repoId: string) {
    try {
      const result = await RepositoryModel.deleteOne({
        _id: repoId,
        userId,
      });

      if (result.deletedCount === 0) {
        throw new ApiException('NOT_FOUND', 'Repository not found');
      }

      return true;
    } catch (error) {
      logger.error('Failed to remove repository:', error);
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to remove repository'
      );
    }
  }

  async listRepositoryContent(
    userId: string,
    repoId: string,
    path = '',
    ref?: string
  ) {
    try {
      const repository = await this.getRepository(userId, repoId);
      const user = await UserModel.findById(userId).select('+accessToken');
      if (!user) {
        throw new ApiException('NOT_FOUND', 'User not found');
      }

      const githubService = new GitHubService(user.accessToken);
      return await githubService.getRepositoryContent(
        repository.owner,
        repository.name,
        path,
        ref
      );
    } catch (error) {
      logger.error('Failed to list repository content:', error);
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to fetch repository content'
      );
    }
  }
}
