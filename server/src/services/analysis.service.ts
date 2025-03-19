import { Analysis } from '../models/analysis.model';
import { RepositoryService } from './repository.service';
import { analyzeCodeWithOpenAI } from './openai-service';
import logger from '../config/logger';

// Custom API exception class
class ApiException extends Error {
  statusCode: number;
  
  constructor(type: string, message: string) {
    super(message);
    this.name = 'ApiException';
    
    // Map error types to status codes
    switch(type) {
      case 'NOT_FOUND': 
        this.statusCode = 404;
        break;
      case 'UNAUTHORIZED':
        this.statusCode = 401;
        break;
      case 'FORBIDDEN':
        this.statusCode = 403;
        break;
      case 'INTERNAL_SERVER_ERROR':
      default:
        this.statusCode = 500;
        break;
    }
  }
}

export class AnalysisService {
  private repositoryService: RepositoryService;

  constructor() {
    this.repositoryService = new RepositoryService();
  }

  async startAnalysis(userId: string, repoId: string) {
    try {
      // Get repository details
      const repository = await this.repositoryService.getRepository(userId, repoId);

      // Create initial analysis record
      const analysis = await Analysis.create({
        userId,
        repositoryId: repoId,
        status: 'pending',
        specifications: {
          overview: '',
          architecture: '',
          components: [],
        },
      });

      // Start analysis process asynchronously
      this.processAnalysis(analysis._id.toString(), userId, repository).catch(
        (error) => {
          logger.error('Analysis processing error:', error);
        }
      );

      return analysis;
    } catch (error) {
      logger.error('Failed to start analysis:', error);
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to start analysis'
      );
    }
  }

  private async processAnalysis(analysisId: string, userId: string, repository: any) {
    try {
      // Update status to processing
      await Analysis.findByIdAndUpdate(analysisId, {
        status: 'processing',
      });

      // Get repository content
      const files = await this.getRepositoryFiles(userId, repository._id);
      
      // Check if there's an OpenAI API key in environment variables
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found in environment variables');
      }

      // Prepare repository data for OpenAI analysis
      const repoData = {
        id: repository._id.toString(),
        name: repository.name,
        owner: repository.owner,
        ingestedContent: {
          fullCode: files.map(file => `File: ${file.path}\n\n${file.content}`).join('\n\n'),
          fileCount: files.length,
          sizeInBytes: files.reduce((total, file) => total + file.content.length, 0)
        }
      };

      // Generate analysis using OpenAI
      const analysisResults = await analyzeCodeWithOpenAI(apiKey, repoData);

      // Update analysis with results
      await Analysis.findByIdAndUpdate(analysisId, {
        status: 'completed',
        insights: analysisResults.insights,
        specifications: {
          overview: 'Generated with OpenAI analysis',
          architecture: '',
          components: [],
        },
      });
    } catch (error) {
      logger.error('Analysis processing failed:', error);
      await Analysis.findByIdAndUpdate(analysisId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async getRepositoryFiles(userId: string, repoId: string) {
    const MAX_FILE_SIZE = 100 * 1024; // 100KB
    const files: Array<{ path: string; content: string }> = [];

    async function processContent(content: any) {
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'file' && item.size <= MAX_FILE_SIZE) {
            const fileContent = await this.repositoryService.listRepositoryContent(
              userId,
              repoId,
              item.path
            );
            if ('content' in fileContent) {
              files.push({
                path: item.path,
                content: fileContent.content,
              });
            }
          } else if (item.type === 'dir') {
            const dirContent = await this.repositoryService.listRepositoryContent(
              userId,
              repoId,
              item.path
            );
            await processContent.call(this, dirContent);
          }
        }
      }
    }

    const rootContent = await this.repositoryService.listRepositoryContent(
      userId,
      repoId
    );
    await processContent.call(this, rootContent);

    return files;
  }

  async getAnalysis(userId: string, analysisId: string) {
    try {
      const analysis = await Analysis.findOne({
        _id: analysisId,
        userId,
      });

      if (!analysis) {
        throw new ApiException('NOT_FOUND', 'Analysis not found');
      }

      return analysis;
    } catch (error) {
      logger.error('Failed to get analysis:', error);
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to fetch analysis'
      );
    }
  }

  async listAnalyses(userId: string, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const [analyses, total] = await Promise.all([
        Analysis.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Analysis.countDocuments({ userId }),
      ]);

      return {
        analyses,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to list analyses:', error);
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to fetch analyses'
      );
    }
  }

  async deleteAnalysis(userId: string, analysisId: string) {
    try {
      const result = await Analysis.deleteOne({
        _id: analysisId,
        userId,
      });

      if (result.deletedCount === 0) {
        throw new ApiException('NOT_FOUND', 'Analysis not found');
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete analysis:', error);
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Failed to delete analysis'
      );
    }
  }
}
