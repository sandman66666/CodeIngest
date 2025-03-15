import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  githubId: z.number(),
  username: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url(),
  name: z.string().optional(),
  accessToken: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  token: z.string(), // JWT token
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const GithubAuthSchema = z.object({
  code: z.string(),
  state: z.string(),
});
export type GithubAuth = z.infer<typeof GithubAuthSchema>;
