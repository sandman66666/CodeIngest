// Common types and utilities shared between client and server

// Repository structure type
const RepositoryTypes = {
  STATUS: {
    PENDING: 'pending',
    INGESTED: 'ingested',
    FAILED: 'failed'
  }
};

// Analysis structure type
const AnalysisTypes = {
  STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },
  SEVERITY: {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  },
  CATEGORY: {
    BUG: 'bug',
    SECURITY: 'security',
    PERFORMANCE: 'performance',
    BEST_PRACTICE: 'best_practice',
    CODE_QUALITY: 'code_quality'
  }
};

// Function to validate a GitHub URL
function validateGitHubUrl(url) {
  const githubUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = url.match(githubUrlPattern);
  
  if (!match) {
    return { valid: false, message: 'Invalid GitHub URL format. Expected format: https://github.com/owner/repository' };
  }
  
  const owner = match[1];
  const repo = match[2].replace('.git', ''); // Remove .git if present
  
  return { valid: true, owner, repo };
}

module.exports = {
  RepositoryTypes,
  AnalysisTypes,
  validateGitHubUrl
};
