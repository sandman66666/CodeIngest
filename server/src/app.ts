import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { repoRouter } from './routes/repo.routes';
import { analysisRouter } from './routes/analysis.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { authLimiter } from './middleware/rate-limit.middleware';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Routes with rate limiting
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/repos', repoRouter);
app.use('/api/analysis', analysisRouter);

// Error handling
app.use(errorMiddleware);

// Export app for testing
export default app;
