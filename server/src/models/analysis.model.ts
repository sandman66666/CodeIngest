import { Schema, model, Document } from 'mongoose';

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface IAnalysis {
  userId: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  status: AnalysisStatus;
  insights: Array<{
    type: string;
    content: string;
    path?: string;
    severity?: 'info' | 'warning' | 'error';
  }>;
  vulnerabilities: Array<{
    type: string;
    description: string;
    path?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation?: string;
  }>;
  specifications: {
    overview?: string;
    architecture?: string;
    dependencies?: string;
    setup?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisDocument extends IAnalysis, Document {}

const analysisSchema = new Schema<AnalysisDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      required: true,
    },
    insights: [
      {
        type: {
          type: String,
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        path: String,
        severity: {
          type: String,
          enum: ['info', 'warning', 'error'],
        },
      },
    ],
    vulnerabilities: [
      {
        type: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        path: String,
        severity: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          required: true,
        },
        recommendation: String,
      },
    ],
    specifications: {
      overview: String,
      architecture: String,
      dependencies: String,
      setup: String,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for frequently queried fields
analysisSchema.index({ userId: 1, repositoryId: 1 });
analysisSchema.index({ status: 1 });
analysisSchema.index({ createdAt: -1 });

export const Analysis = model<AnalysisDocument>('Analysis', analysisSchema);
