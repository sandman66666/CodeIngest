export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Insight {
  type: string;
  content: string;
  path?: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface Vulnerability {
  type: string;
  description: string;
  path?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}

export interface Specifications {
  overview?: string;
  architecture?: string;
  dependencies?: string;
  setup?: string;
}

export interface Analysis {
  id: string;
  _id: string;
  userId: string;
  repositoryId: string;
  status: AnalysisStatus;
  insights: Insight[];
  vulnerabilities: Vulnerability[];
  specifications: Specifications;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisResponse {
  data: Analysis[];
  total: number;
  page: number;
  limit: number;
}
