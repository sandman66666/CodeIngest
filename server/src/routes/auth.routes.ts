import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// In-memory storage for user sessions
const userSessions = new Map<string, any>();

router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  // Get the origin from the request to determine callback URL dynamically
  const origin = req.headers.origin || process.env.REACT_APP_CLIENT_URL;
  const redirectUri = process.env.GITHUB_CALLBACK_URL || `${origin}/api/auth/github/callback`;
  const scope = 'repo read:user user:email';
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(githubAuthUrl);
});

router.get('/github/callback', async (req, res) => {
  const { code } = req.query as { code: string };
  // Get client URL from environment or request origin, with localhost fallback only for development
  const clientUrl = process.env.REACT_APP_CLIENT_URL || req.headers.origin || 'http://localhost:3001';
  
  if (!code) {
    return res.redirect(`${clientUrl}/login?error=missing_code`);
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
      return res.redirect(`${clientUrl}/login?error=${tokenData.error}`);
    }

    // Get user data from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    if (userResponse.status !== 200) {
      return res.redirect(`${clientUrl}/login?error=github_api_error`);
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

    // Redirect back to the client with the token
    return res.redirect(`${clientUrl}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Authentication error:', error);
    return res.redirect(`${clientUrl}/login?error=server_error`);
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
    const sessionId = decoded.sessionId;
    
    const userData = userSessions.get(sessionId);
    if (!userData) {
      throw new ApiError(401, 'Invalid session');
    }
    
    return res.json({
      status: 'success',
      data: {
        id: userData.id,
        login: userData.username,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatarUrl,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Invalid token');
    }
    throw error;
  }
});

export const authRouter = router;
