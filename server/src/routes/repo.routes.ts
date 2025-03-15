import { Router } from 'express';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Get user's repositories from GitHub
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to fetch repositories');
    }

    const repos = await response.json();
    const repoList = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      stars: repo.stargazers_count,
      language: repo.language,
    }));

    res.json({
      status: 'success',
      data: repoList,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to fetch repositories');
  }
});

router.get('/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Get repository details from GitHub
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to fetch repository');
    }

    const repoData = await response.json();
    const repository = {
      id: repoData.id,
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description,
      private: repoData.private,
      url: repoData.html_url,
      defaultBranch: repoData.default_branch,
      stars: repoData.stargazers_count,
      language: repoData.language,
      size: repoData.size,
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
    };

    res.json({
      status: 'success',
      data: repository,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to fetch repository');
  }
});

router.get('/:owner/:repo/contents', async (req, res) => {
  const { owner, repo } = req.params;
  const { path = '' } = req.query;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Get repository contents from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
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
    res.json({
      status: 'success',
      data: Array.isArray(contents)
        ? contents.map((item: any) => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
            url: item.html_url,
            downloadUrl: item.download_url,
          }))
        : {
            name: contents.name,
            path: contents.path,
            type: contents.type,
            size: contents.size,
            url: contents.html_url,
            downloadUrl: contents.download_url,
            content: contents.content
              ? Buffer.from(contents.content, 'base64').toString('utf-8')
              : null,
          },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to fetch repository contents');
  }
});

export const repoRouter = router;
