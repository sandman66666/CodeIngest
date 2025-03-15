import { Schema, model, Document, Types } from 'mongoose';

interface IRepository {
  userId: Types.ObjectId;
  name: string;
  owner: string;
  url: string;
  branch: string;
  private: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryDocument extends IRepository, Document {}

const repositorySchema = new Schema<RepositoryDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    owner: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      required: true,
      default: 'main',
    },
    private: {
      type: Boolean,
      required: true,
      default: false,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Create a compound index for owner and name to ensure uniqueness
repositorySchema.index({ owner: 1, name: 1 }, { unique: true });

export const Repository = model<RepositoryDocument>('Repository', repositorySchema);
