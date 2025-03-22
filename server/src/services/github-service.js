// GitHub service for interacting with the GitHub API
const axios = require('axios');

const githubApi = {
  async getRepoDetails(owner, repo, token = null) {
    try {
      const headers = {};
      
      // Add authentication if token is provided
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Add User-Agent header to prevent GitHub API from rejecting the request
      headers['User-Agent'] = 'CodeIngest-App';
      
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      
      const response = await axios.get(url, { headers });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch repository details: ${error.message}`);
    }
  },
  
  async getRepoTree(owner, repo, branch = 'main', token = null) {
    try {
      const headers = {};
      
      // Add authentication if token is provided
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Add User-Agent header to prevent GitHub API from rejecting the request
      headers['User-Agent'] = 'CodeIngest-App';
      
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      
      const response = await axios.get(url, { headers });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch repository tree: ${error.message}`);
    }
  },
  
  async getFileContent(owner, repo, path, branch = 'main', token = null) {
    try {
      const headers = {};
      
      // Add authentication if token is provided
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Add User-Agent header to prevent GitHub API from rejecting the request
      headers['User-Agent'] = 'CodeIngest-App';
      
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      
      const response = await axios.get(url, { headers });
      
      // GitHub API returns the content as base64 encoded
      if (response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString();
      }
      return null;
    } catch (error) {
      return null; // Silently fail if we can't get content for a file
    }
  },
  
  // Filter files based on include/exclude patterns
  matchesPattern(path, pattern) {
    // Convert glob pattern to regex
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    return regex.test(path);
  },
  
  // Helper to determine if a file is a business logic or platform code file
  isBusinessLogicOrPlatformCode(path, fileExtension) {
    // Define patterns for business logic and platform code files
    const businessLogicPatterns = [
      /\/(controllers|services|models|utils|helpers|core|lib|api)\//i,
      /\.(controller|service|model|util|helper|api)\.[jt]sx?$/i
    ];

    const platformCodePatterns = [
      /\/src\/[^\/]+\.[jt]sx?$/i, // Root source files
      /\/app\/[^\/]+\.[jt]sx?$/i, // App directory root files
      /\/pages\/[^\/]+\.[jt]sx?$/i, // Pages directory files
      /\/components\/[^\/]+\/index\.[jt]sx?$/i, // Component index files
      /\/hooks\/[^\/]+\.[jt]sx?$/i, // React hooks
      /\/context\/[^\/]+\.[jt]sx?$/i, // Context files
      /\/store\/[^\/]+\.[jt]sx?$/i, // Store files
      /\/reducers\/[^\/]+\.[jt]sx?$/i, // Redux reducers
      /\/actions\/[^\/]+\.[jt]sx?$/i // Redux actions
    ];

    // Skip node_modules, build directories, and test files
    if (
      path.includes('node_modules/') ||
      path.includes('/build/') ||
      path.includes('/dist/') ||
      path.includes('.test.') ||
      path.includes('.spec.')
    ) {
      return false;
    }

    // Check for code file extensions
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.php', '.go', '.java', '.cs'];
    if (!codeExtensions.includes(fileExtension)) {
      return false;
    }

    // Check if the file matches any business logic or platform code pattern
    return businessLogicPatterns.some(pattern => pattern.test(path)) ||
           platformCodePatterns.some(pattern => pattern.test(path));
  },
  
  // Generate a directory tree representation
  generateTreeView(files) {
    const tree = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // This is a file
          current[part] = null;
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    });
    
    // Convert the tree object to string representation
    const stringifyTree = (node, prefix = '') => {
      if (!node) return '';
      
      let result = '';
      const entries = Object.entries(node);
      entries.forEach(([key, value], index) => {
        const isLast = index === entries.length - 1;
        const currentPrefix = prefix + (isLast ? '- ' : '- ');
        result += `${prefix}${isLast ? '- ' : '- '}${key}\n`;
        
        if (value !== null) {
          result += stringifyTree(value, prefix + (isLast ? '  ' : '  '));
        }
      });
      
      return result;
    };
    
    return stringifyTree(tree);
  }
};

module.exports = githubApi;
