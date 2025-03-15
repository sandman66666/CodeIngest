import { ApiException } from '@codeinsight/common';
import { AnalysisModel } from '../models/analysis.model';
import { RepositoryService } from './repository.service';
import { ClaudeService } from './claude.service';
import logger from '../config/logger';

export class AnalysisService {
  private repositoryService: RepositoryService;
  private claudeService: ClaudeService;

  constructor() {
    this.repositoryService = new RepositoryService();
    this.claudeService = new ClaudeService();
  }

  async startAnalysis(userId: string, repoId: string) {
    try {
      // Get repository details
      const repository = await this.repositoryService.getRepository(userId, repoId);

      // Create initial analysis record
      const analysis = await AnalysisModel.create({
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
      await AnalysisModel.findByIdAndUpdate(analysisId, {
        status: 'processing',
      });

      // Get repository content
      const files = await this.getRepositoryFiles(userId, repository._id);

      // Generate project specification
      const specifications = await this.claudeService.generateSpecification(
        files,
        {
          repoName: repository.name,
          owner: repository.owner,
          description: repository.description,
        }
      );

      // Analyze each file
      const analysisResults = await Promise.all(
        files.map((file) =>
          this.claudeService.analyzeCode(file.content, {
            repoName: repository.name,
            owner: repository.owner,
            path: file.path,
            language: this.detectLanguage(file.path),
          })
        )
      );

      // Combine all insights and vulnerabilities
      const combinedResults = analysisResults.reduce(
        (acc, result) => ({
          insights: [...acc.insights, ...result.insights],
          vulnerabilities: [...acc.vulnerabilities, ...result.vulnerabilities],
        }),
        { insights: [], vulnerabilities: [] }
      );

      // Update analysis with results
      await AnalysisModel.findByIdAndUpdate(analysisId, {
        status: 'completed',
        insights: combinedResults.insights,
        vulnerabilities: combinedResults.vulnerabilities,
        specifications,
      });
    } catch (error) {
      logger.error('Analysis processing failed:', error);
      await AnalysisModel.findByIdAndUpdate(analysisId, {
        status: 'failed',
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

  private detectLanguage(filePath: string): string | undefined {
    const extensions: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.yaml': 'YAML',
      '.yml': 'YAML',
    };

    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return extensions[ext];
  }

  async getAnalysis(userId: string, analysisId: string) {
    try {
      const analysis = await AnalysisModel.findOne({
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
        AnalysisModel.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        AnalysisModel.countDocuments({ userId }),
      ]);

      return {
        analyses,
        pagination: {
          page,
          limit,
          total,
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
      const result = await AnalysisModel.deleteOne({
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
