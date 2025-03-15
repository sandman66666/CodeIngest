import { apiClient, ApiException } from '../api';
import axios, { AxiosInstance } from 'axios';

// Import Jest types
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('axios');

// Create a mock type for the axios instance
type MockAxiosInstance = {
  create: jest.MockedFunction<typeof axios.create>;
  get: jest.MockedFunction<any>;
  post: jest.MockedFunction<any>;
} & Partial<AxiosInstance>;

const mockedAxios = axios as unknown as MockAxiosInstance;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('repositories', () => {
    it('should list repositories successfully', async () => {
      const mockRepositories = [
        {
          id: '1',
          owner: 'test-owner',
          name: 'test-repo',
          url: 'https://github.com/test-owner/test-repo',
          createdAt: '2025-03-14T16:37:41Z',
          updatedAt: '2025-03-14T16:37:41Z',
        },
      ];

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockRepositories }),
      } as any);

      const response = await apiClient.repositories.list();
      expect(response.data).toEqual(mockRepositories);
    });

    it('should handle API errors correctly', async () => {
      const errorResponse = {
        response: {
          data: {
            message: 'Not found',
            code: 'REPOSITORY_NOT_FOUND',
          },
          status: 404,
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(errorResponse),
      } as any);

      await expect(apiClient.repositories.get('non-existent')).rejects.toThrow(
        new ApiException('Not found', 'REPOSITORY_NOT_FOUND')
      );
    });
  });

  describe('analysis', () => {
    it('should start analysis successfully', async () => {
      const mockAnalysis = {
        id: '1',
        repositoryId: 'repo-1',
        status: 'pending',
        insights: {},
        vulnerabilities: {},
        createdAt: '2025-03-14T16:37:41Z',
        updatedAt: '2025-03-14T16:37:41Z',
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockAnalysis }),
      } as any);

      const response = await apiClient.analysis.start('repo-1');
      expect(response.data).toEqual(mockAnalysis);
    });
  });

  describe('share', () => {
    it('should generate share link successfully', async () => {
      const mockShareLink = {
        url: 'https://codeinsight.app/share/abc123',
        expiresAt: '2025-03-21T16:37:41Z',
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockShareLink }),
      } as any);

      const response = await apiClient.share.generateLink('repo-1', 'repository', {
        expiresInDays: 7,
        allowEdit: false,
      });
      expect(response.data).toEqual(mockShareLink);
    });
  });
});
