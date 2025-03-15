import { z } from 'zod';

export const AnalysisStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const RepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  url: z.string().url(),
  description: z.string().optional(),
  branch: z.string(),
  private: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Repository = z.infer<typeof RepositorySchema>;

export const AnalysisResultSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  status: AnalysisStatusSchema,
  insights: z.array(z.object({
    type: z.string(),
    content: z.string(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    path: z.string().optional(),
  })),
  vulnerabilities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    path: z.string(),
    line: z.number().optional(),
    recommendation: z.string(),
  })),
  specifications: z.object({
    overview: z.string(),
    architecture: z.string(),
    components: z.array(z.object({
      name: z.string(),
      description: z.string(),
      dependencies: z.array(z.string()),
    })),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
