import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// In-memory storage for user sessions
const userSessions = new Map<string, any>();

router.get('/github', (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;
  const scope = 'repo read:user user:email';
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(githubAuthUrl);
});

router.post('/github/callback', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    throw new ApiError(400, 'Authorization code is required');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      throw new ApiError(401, tokenData.error_description || 'Failed to get access token');
    }

    // Get user data from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    if (userResponse.status !== 200) {
      throw new ApiError(401, 'Failed to get user data from GitHub');
    }

    // Create session
    const sessionId = Math.random().toString(36).substring(2);
    userSessions.set(sessionId, {
      id: userData.id,
      username: userData.login,
      email: userData.email,
      name: userData.name,
      avatarUrl: userData.avatar_url,
      accessToken: tokenData.access_token,
    });

    // Create JWT
    const token = jwt.sign(
      { sessionId },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.json({
      status: 'success',
      data: {
        token,
        user: {
          id: userData.id,
          username: userData.login,
          name: userData.name,
          avatarUrl: userData.avatar_url,
        },
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Authentication failed');
  }
});

router.get('/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { sessionId: string };
    const userData = userSessions.get(decoded.sessionId);
    
    if (!userData) {
      throw new ApiError(401, 'Invalid session');
    }

    res.json({
      status: 'success',
      data: {
        id: userData.id,
        username: userData.username,
        name: userData.name,
        avatarUrl: userData.avatarUrl,
      },
    });
  } catch (error) {
    throw new ApiError(401, 'Invalid token');
  }
});

export const authRouter = router;
