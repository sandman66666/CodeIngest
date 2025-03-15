import { Schema, model, Document } from 'mongoose';

interface IUser {
  githubId: number;
  username: string;
  email: string;
  name?: string;
  avatarUrl: string;
  accessToken: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extend the IUser type with mongoose Document
export interface UserDocument extends IUser, Document {}

const userSchema = new Schema<UserDocument>(
  {
    githubId: {
      type: Number,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
    },
    avatarUrl: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
      select: false, // Don't include in query results by default
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.__v;
        delete ret.accessToken;
        return ret;
      },
    },
  }
);

// Create indexes for frequently queried fields
userSchema.index({ githubId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

export const User = model<UserDocument>('User', userSchema);
