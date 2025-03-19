import { Router } from 'express';
import { ApiError } from '../middleware/error.middleware';
import { openAIService } from '../services/openai-service';

const router = Router();

// In-memory storage for analysis results
const analysisResults = new Map<string, any>();

router.post('/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Get repository contents from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to fetch repository contents');
    }

    const contents = await response.json();
    const files = contents.filter((item: any) => item.type === 'file');

    // Analyze each file
    const analysisPromises = files.map(async (file: any) => {
      const fileResponse = await fetch(file.download_url);
      const content = await fileResponse.text();
      return {
        file: file.path,
        analysis: await openAIService.analyzeCodeStructured(content),
      };
    });

    const analysis = await Promise.all(analysisPromises);
    const analysisId = Math.random().toString(36).substring(2);
    
    analysisResults.set(analysisId, {
      id: analysisId,
      repository: `${owner}/${repo}`,
      timestamp: new Date().toISOString(),
      results: analysis,
    });

    res.json({
      status: 'success',
      data: {
        id: analysisId,
        repository: `${owner}/${repo}`,
        results: analysis,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Analysis failed');
  }
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const analysis = analysisResults.get(id);

  if (!analysis) {
    throw new ApiError(404, 'Analysis not found');
  }

  res.json({
    status: 'success',
    data: analysis,
  });
});

router.get('/', (_req, res) => {
  const analyses = Array.from(analysisResults.values());
  res.json({
    status: 'success',
    data: analyses,
  });
});

export const analysisRouter = router;
