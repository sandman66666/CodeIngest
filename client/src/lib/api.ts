import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import axios from 'axios';
import { Analysis, AnalysisResponse } from '../types/analysis';

interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface ApiErrorResponse {
  message: string;
  code: string;
}

class ApiException extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const API_URL = window.env?.REACT_APP_API_URL || '/api';
    
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    }) as AxiosInstance;

    // Add request interceptor for auth token
    (this.client as any).interceptors.request.use((config: AxiosRequestConfig): AxiosRequestConfig => {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    (this.client as any).interceptors.response.use(
      (response: AxiosResponse): AxiosResponse => response,
      (error: AxiosError) => {
        const status = error.response?.status ?? 500;
        const errorData = error.response?.data as Partial<ApiErrorResponse>;

        if (errorData?.message) {
          throw new ApiException(
            errorData.message,
            errorData.code ?? String(status)
          );
        }

        throw new ApiException(
          'An unexpected error occurred',
          String(status)
        );
      }
    );
  }

  // Analysis endpoints
  analysis = {
    list: async (page = 1, limit = 10): Promise<AnalysisResponse> => {
      const response = await this.client.get<ApiResponse<AnalysisResponse>>(
        `/analyses?page=${page}&limit=${limit}`
      );
      return response.data.data;
    },

    get: async (id: string): Promise<Analysis> => {
      const response = await this.client.get<ApiResponse<Analysis>>(`/analyses/${id}`);
      return response.data.data;
    },

    create: async (repositoryId: string): Promise<Analysis> => {
      const response = await this.client.post<ApiResponse<Analysis>>('/analyses', {
        repositoryId,
      });
      return response.data.data;
    },

    delete: async (id: string): Promise<void> => {
      await this.client.delete(`/analyses/${id}`);
    },
  };

  // Repository endpoints
  repositories = {
    list: async (page = 1, limit = 10) => {
      const response = await this.client.get(`/repositories?page=${page}&limit=${limit}`);
      return response.data.data;
    },

    get: async (id: string) => {
      const response = await this.client.get(`/repositories/${id}`);
      return response.data.data;
    },

    create: async (data: { owner: string; name: string }) => {
      const response = await this.client.post('/repositories', data);
      return response.data.data;
    },

    delete: async (id: string) => {
      await this.client.delete(`/repositories/${id}`);
    },
  };

  // Auth endpoints
  auth = {
    login: async (code: string) => {
      const response = await this.client.post('/auth/github/callback', { code });
      const { token } = response.data.data;
      localStorage.setItem('token', token);
      return token;
    },

    logout: () => {
      localStorage.removeItem('token');
    },

    getProfile: async () => {
      const response = await this.client.get('/auth/profile');
      return response.data.data;
    },
  };
}

export const apiClient = new ApiClient();
