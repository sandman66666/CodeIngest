import { Octokit } from '@octokit/rest';
import { ApiException } from '@codeinsight/common';
import logger from '../config/logger';

export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  async getUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return {
        githubId: data.id,
        username: data.login,
        email: data.email,
        name: data.name,
        avatarUrl: data.avatar_url,
      };
    } catch (error) {
      logger.error('GitHub API Error - getUser:', error);
      throw new ApiException(
        'GITHUB_API_ERROR',
        'Failed to fetch GitHub user data'
      );
    }
  }

  async getRepository(owner: string, repo: string) {
    try {
      const { data } = await this.octokit.repos.get({
        owner,
        repo,
      });

      return {
        name: data.name,
        owner: data.owner.login,
        url: data.html_url,
        description: data.description,
        branch: data.default_branch,
        private: data.private,
      };
    } catch (error) {
      logger.error('GitHub API Error - getRepository:', error);
      throw new ApiException(
        'GITHUB_API_ERROR',
        'Failed to fetch repository data'
      );
    }
  }

  async listUserRepositories(page = 1, perPage = 30) {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        direction: 'desc',
        per_page: perPage,
        page,
      });

      return data.map((repo) => ({
        name: repo.name,
        owner: repo.owner.login,
        url: repo.html_url,
        description: repo.description,
        branch: repo.default_branch,
        private: repo.private,
      }));
    } catch (error) {
      logger.error('GitHub API Error - listUserRepositories:', error);
      throw new ApiException(
        'GITHUB_API_ERROR',
        'Failed to fetch user repositories'
      );
    }
  }

  async getRepositoryContent(owner: string, repo: string, path: string, ref?: string) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      // Handle directory case
      if (Array.isArray(data)) {
        return data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          url: item.html_url,
        }));
      }

      // Handle file case
      if ('content' in data) {
        return {
          name: data.name,
          path: data.path,
          type: data.type,
          size: data.size,
          url: data.html_url,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
        };
      }

      throw new Error('Unsupported content type');
    } catch (error) {
      logger.error('GitHub API Error - getRepositoryContent:', error);
      throw new ApiException(
        'GITHUB_API_ERROR',
        'Failed to fetch repository content'
      );
    }
  }

  async createRepositoryWebhook(owner: string, repo: string, webhookUrl: string) {
    try {
      const { data } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: process.env.GITHUB_WEBHOOK_SECRET,
        },
        events: ['push', 'pull_request'],
        active: true,
      });

      return {
        id: data.id,
        url: data.config.url,
        events: data.events,
      };
    } catch (error) {
      logger.error('GitHub API Error - createRepositoryWebhook:', error);
      throw new ApiException(
        'GITHUB_API_ERROR',
        'Failed to create repository webhook'
      );
    }
  }
}
