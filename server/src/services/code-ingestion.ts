import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import glob from 'glob';

const execPromise = promisify(exec);

// Common file patterns to ignore
const DEFAULT_EXCLUDE_PATTERNS = [
  '.git/**',
  'node_modules/**',
  'dist/**',
  'build/**',
  '.vscode/**',
  '.idea/**',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.png',
  '**/*.gif',
  '**/*.svg',
  '**/*.ico',
  '**/*.pdf',
  '**/*.zip',
  '**/*.gz',
  '**/*.tar',
  '**/*.mp3',
  '**/*.mp4',
  '**/*.mov',
  '**/*.avi'
];

// Common file patterns to include
const DEFAULT_INCLUDE_PATTERNS = [
  '**/*.js',
  '**/*.jsx',
  '**/*.ts',
  '**/*.tsx',
  '**/*.py',
  '**/*.java',
  '**/*.c',
  '**/*.cpp',
  '**/*.h',
  '**/*.hpp',
  '**/*.cs',
  '**/*.go',
  '**/*.rb',
  '**/*.php',
  '**/*.html',
  '**/*.css',
  '**/*.scss',
  '**/*.md',
  '**/*.json',
  '**/*.yml',
  '**/*.yaml',
  'README*',
  'LICENSE*'
];

interface IngestionOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSizeBytes?: number;
  branch?: string;
}

export interface IngestionResult {
  summary: string;
  tree: string;
  content: string;
  filePaths: string[];
  fileCount: number;
  totalSizeBytes: number;
}

/**
 * Main function to ingest a repository from GitHub and prepare it for analysis
 */
export async function ingestRepository(
  repoUrl: string, 
  authToken?: string, 
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  console.log(`Starting ingestion for: ${repoUrl}`);
  
  // Parse GitHub repository information
  const { owner, name } = parseGitHubUrl(repoUrl);
  
  try {
    // For Heroku deployment, use GitHub API instead of cloning
    if (process.env.NODE_ENV === 'production' || process.env.USE_GITHUB_API === 'true') {
      console.log(`Using GitHub API for repository ingestion: ${owner}/${name}`);
      return await ingestRepositoryUsingGithubApi(owner, name, authToken, options);
    }
    
    // Local development can use git clone approach
    // Create a temporary directory for cloning
    const tempDir = path.join(os.tmpdir(), `codeingest-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    console.log(`Created temporary directory: ${tempDir}`);
    
    try {
      // Verify repository access before cloning
      const repoInfo = await getRepoInfo(owner, name, authToken);
      if (!repoInfo) {
        throw new Error('Repository not found or not accessible');
      }
      
      console.log(`Verified repository access for ${owner}/${name}`);
      
      // Clone the repository
      const cloneResult = await cloneRepository(
        repoUrl, 
        tempDir, 
        authToken, 
        options.branch
      );
      
      console.log(`Repository cloned: ${cloneResult}`);
      
      // Process the repository and generate the content
      const result = await processRepository(
        tempDir, 
        options.includePatterns || DEFAULT_INCLUDE_PATTERNS, 
        options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS,
        options.maxFileSizeBytes || 10 * 1024 * 1024 // Default 10MB per file
      );
      
      result.summary = `# Repository: ${owner}/${name}\n\n` +
        `${repoInfo.description ? '## Description\n' + repoInfo.description + '\n\n' : ''}` + 
        `- **Language**: ${repoInfo.language || 'Not specified'}\n` +
        `- **Stars**: ${repoInfo.stargazers_count}\n` +
        `- **Forks**: ${repoInfo.forks_count}\n` +
        `- **Last Updated**: ${new Date(repoInfo.updated_at).toLocaleDateString()}\n` +
        `- **Total Files**: ${result.fileCount}\n` +
        `- **Size**: ${formatBytes(result.totalSizeBytes)}\n\n` + 
        result.summary;
      
      return result;
    } finally {
      // Clean up temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary directory: ${tempDir}`);
      } catch (error) {
        console.error(`Error cleaning up directory ${tempDir}:`, error);
      }
    }
  } catch (error: any) {
    console.error('Error during repository ingestion:', error);
    throw new Error(`Repository ingestion failed: ${error.message}`);
  }
}

/**
 * Ingest a repository using GitHub API directly (for Heroku)
 */
async function ingestRepositoryUsingGithubApi(
  owner: string,
  repo: string,
  authToken?: string,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  try {
    // Get repository info
    const repoInfo = await getRepoInfo(owner, repo, authToken);
    
    // Get repository tree
    const branch = options.branch || repoInfo.default_branch;
    const treeData = await getRepositoryTree(owner, repo, branch, authToken);
    
    // Filter and fetch file contents based on include/exclude patterns
    const includePatterns = options.includePatterns || DEFAULT_INCLUDE_PATTERNS;
    const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS;
    const maxFileSize = options.maxFileSizeBytes || 1024 * 1024; // 1MB default for API
    
    const fileList = treeData.filter(item => {
      // Only include files, not directories
      if (item.type !== 'blob') return false;
      
      // Skip files that are too large
      if (item.size > maxFileSize) return false;
      
      const filePath = item.path;
      
      // Check if file matches exclude patterns
      for (const pattern of excludePatterns) {
        if (matchGlobPattern(filePath, pattern)) return false;
      }
      
      // Check if file matches include patterns
      for (const pattern of includePatterns) {
        if (matchGlobPattern(filePath, pattern)) return true;
      }
      
      return false;
    });
    
    console.log(`Found ${fileList.length} files to process after filtering`);
    
    // Generate file tree representation
    const tree = generateTreeStructure(fileList.map(f => f.path));
    
    // Fetch contents for files (in parallel, with rate limiting)
    const batchSize = 5; // Process 5 files at a time to avoid rate limits
    let totalSizeBytes = 0;
    let fullContent = '';
    const filePaths: string[] = [];
    
    for (let i = 0; i < fileList.length; i += batchSize) {
      const batch = fileList.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async file => {
        try {
          const content = await getFileContent(owner, repo, file.path, branch, authToken);
          totalSizeBytes += Buffer.from(content).length;
          
          // Add file header and content to the full content
          fullContent += `\n\n// File: ${file.path}\n`;
          fullContent += content;
          
          filePaths.push(file.path);
          return true;
        } catch (error) {
          console.error(`Error fetching content for ${file.path}:`, error);
          return false;
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate summary
    const summary = `# Repository: ${owner}/${repo}\n\n` +
      `${repoInfo.description ? '## Description\n' + repoInfo.description + '\n\n' : ''}` + 
      `- **Language**: ${repoInfo.language || 'Not specified'}\n` +
      `- **Stars**: ${repoInfo.stargazers_count}\n` +
      `- **Forks**: ${repoInfo.forks_count}\n` +
      `- **Last Updated**: ${new Date(repoInfo.updated_at).toLocaleDateString()}\n` +
      `- **Total Files**: ${filePaths.length}\n` +
      `- **Size**: ${formatBytes(totalSizeBytes)}\n\n`;
    
    return {
      summary,
      tree,
      content: fullContent,
      filePaths,
      fileCount: filePaths.length,
      totalSizeBytes
    };
  } catch (error: any) {
    console.error('Error during GitHub API repository ingestion:', error);
    throw new Error(`GitHub API repository ingestion failed: ${error.message}`);
  }
}

/**
 * Check if a filepath matches a glob pattern
 */
function matchGlobPattern(filePath: string, pattern: string): boolean {
  // Simple glob matching logic
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\*\*/g, '.*');
    
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

/**
 * Parse a GitHub URL to extract owner and repository name
 */
export function parseGitHubUrl(url: string): { owner: string, name: string } {
  const githubUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = url.match(githubUrlPattern);
  
  if (!match) {
    throw new Error('Invalid GitHub URL format. Expected format: https://github.com/owner/repository');
  }
  
  const owner = match[1];
  const name = match[2].replace('.git', ''); // Remove .git if present
  
  return { owner, name };
}

/**
 * Get repository information from GitHub API
 */
async function getRepoInfo(owner: string, name: string, token?: string): Promise<any> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await axios.get(`https://api.github.com/repos/${owner}/${name}`, { headers });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Repository not found');
    } else if (error.response?.status === 403) {
      throw new Error('Repository access denied - it might be private and requires authentication');
    }
    throw new Error(`Failed to get repository info: ${error.message}`);
  }
}

/**
 * Get repository tree from GitHub API
 */
async function getRepositoryTree(owner: string, repo: string, branch: string, token?: string): Promise<any[]> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Get the latest commit for the branch
    const commitResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`, 
      { headers }
    );
    
    const treeSha = commitResponse.data.commit.tree.sha;
    
    // Get the full recursive tree
    const treeResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
      { headers }
    );
    
    if (treeResponse.data.truncated) {
      console.warn('Repository tree is truncated due to size limitations');
    }
    
    return treeResponse.data.tree;
  } catch (error: any) {
    throw new Error(`Failed to get repository tree: ${error.message}`);
  }
}

/**
 * Get file content from GitHub API
 */
async function getFileContent(owner: string, repo: string, path: string, branch: string, token?: string): Promise<string> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.raw'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers }
    );
    
    // If the response is raw content, return it directly
    if (typeof response.data === 'string') {
      return response.data;
    }
    
    // If the response is an object with content, decode it
    if (response.data.content && response.data.encoding === 'base64') {
      return Buffer.from(response.data.content, 'base64').toString('utf8');
    }
    
    throw new Error('Unexpected content format from GitHub API');
  } catch (error: any) {
    throw new Error(`Failed to get file content: ${error.message}`);
  }
}

/**
 * Generate tree structure from file paths
 */
function generateTreeStructure(filePaths: string[]): string {
  const treeLines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);
  
  // Group files by directories
  const dirMap: Record<string, string[]> = {};
  
  for (const filePath of filePaths) {
    const parts = filePath.split('/');
    const fileName = parts.pop() || '';
    const dirPath = parts.join('/');
    
    if (!dirMap[dirPath]) {
      dirMap[dirPath] = [];
    }
    
    dirMap[dirPath].push(fileName);
  }
  
  // Sort directories for consistent output
  const sortedDirs = Object.keys(dirMap).sort();
  
  // Generate tree lines
  for (const dir of sortedDirs) {
    if (!dir) {
      // Root directory files
      for (const file of dirMap[dir].sort()) {
        treeLines.push(`- ${file}`);
      }
    } else {
      // Subdirectory
      const level = dir.split('/').length;
      treeLines.push(`${indent(level - 1)}- ${dir.split('/').pop()}/`);
      
      for (const file of dirMap[dir].sort()) {
        treeLines.push(`${indent(level)}  - ${file}`);
      }
    }
  }
  
  return treeLines.join('\n');
}

/**
 * Clone a GitHub repository
 */
async function cloneRepository(
  repoUrl: string, 
  destination: string, 
  token?: string,
  branch?: string
): Promise<string> {
  let cloneCommand = `git clone --depth 1`;
  
  // If branch is specified, add it to the clone command
  if (branch) {
    cloneCommand += ` --branch ${branch}`;
  }
  
  // Add credentials if token is provided
  if (token) {
    const url = new URL(repoUrl);
    repoUrl = `https://${token}@${url.host}${url.pathname}`;
  }
  
  // Add the repository URL and destination
  cloneCommand += ` ${repoUrl} ${destination}`;
  
  // Execute the clone command
  const { stdout, stderr } = await execPromise(cloneCommand);
  
  if (stderr && !stderr.includes('Cloning into')) {
    console.warn('Clone stderr:', stderr);
  }
  
  return stdout || 'Clone completed successfully';
}

/**
 * Process the repository and extract content
 */
async function processRepository(
  repoPath: string,
  includePatterns: string[],
  excludePatterns: string[],
  maxFileSizeBytes: number
): Promise<IngestionResult> {
  // Get all files in the repository
  const allFilePaths = await globFiles(repoPath, includePatterns, excludePatterns);
  
  let totalSizeBytes = 0;
  let fullCode = '';
  const filePaths: string[] = [];
  
  // Process each file
  for (const filePath of allFilePaths) {
    try {
      const stats = fs.statSync(filePath);
      
      // Skip files that are too large
      if (stats.size > maxFileSizeBytes) {
        console.log(`Skipping large file (${formatBytes(stats.size)}): ${filePath}`);
        continue;
      }
      
      // Read the file content
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Add to total size
      totalSizeBytes += stats.size;
      
      // Get relative path from repository root
      const relativePath = path.relative(repoPath, filePath);
      
      // Add file header and content to the full code
      fullCode += `\n\n// File: ${relativePath}\n`;
      fullCode += content;
      
      // Add to file paths
      filePaths.push(relativePath);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
  
  // Generate directory tree
  const tree = await generateDirectoryTree(repoPath, allFilePaths);
  
  // Generate summary
  const summary = `## Contents Overview

Repository contains ${filePaths.length} files, totaling ${formatBytes(totalSizeBytes)}.

### Key Directories:
${tree.split('\n').slice(0, 20).join('\n')}
${tree.split('\n').length > 20 ? '\n... (truncated)' : ''}
`;
  
  return {
    summary,
    tree,
    content: fullCode,
    filePaths,
    fileCount: filePaths.length,
    totalSizeBytes
  };
}

/**
 * Find files in the repository using glob patterns
 */
async function globFiles(
  repoPath: string,
  includePatterns: string[],
  excludePatterns: string[]
): Promise<string[]> {
  // Create a set to store unique file paths
  const fileSet = new Set<string>();
  
  // Process each include pattern
  for (const pattern of includePatterns) {
    const matches = await glob(pattern, { cwd: repoPath, absolute: true });
    matches.forEach(match => fileSet.add(match));
  }
  
  // Filter out files that match exclude patterns
  const allFiles = Array.from(fileSet);
  const filteredFiles = allFiles.filter(filePath => {
    const relativePath = path.relative(repoPath, filePath);
    
    // Check if file matches any exclude pattern
    for (const pattern of excludePatterns) {
      if (matchGlobPattern(relativePath, pattern)) {
        return false;
      }
    }
    
    return true;
  });
  
  return filteredFiles;
}

/**
 * Generate a directory tree representation
 */
async function generateDirectoryTree(
  repoPath: string,
  filePaths: string[]
): Promise<string> {
  // Generate tree representation
  const treeLines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);
  
  // Convert absolute paths to relative paths
  const relativePaths = filePaths.map(filePath => 
    path.relative(repoPath, filePath)
  );
  
  // Group files by directory
  const dirMap: Record<string, string[]> = {};
  
  for (const filePath of relativePaths) {
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    
    if (!dirMap[dir]) {
      dirMap[dir] = [];
    }
    
    dirMap[dir].push(fileName);
  }
  
  // Generate tree structure
  const processDir = (dirPath: string, level: number) => {
    if (dirPath === '.') {
      // Root directory
      dirMap[dirPath]?.forEach(fileName => {
        treeLines.push(`${indent(level)}- ${fileName}`);
      });
      return;
    }
    
    const parts = dirPath.split(path.sep);
    const dirName = parts[parts.length - 1];
    
    treeLines.push(`${indent(level)}- ${dirName}/`);
    
    // Add files
    dirMap[dirPath]?.forEach(fileName => {
      treeLines.push(`${indent(level + 1)}- ${fileName}`);
    });
  };
  
  // Process root directory first
  if (dirMap['.']) {
    processDir('.', 0);
  }
  
  // Process other directories
  Object.keys(dirMap)
    .filter(dir => dir !== '.')
    .sort()
    .forEach(dir => {
      const level = dir.split(path.sep).length - 1;
      processDir(dir, level);
    });
  
  return treeLines.join('\n');
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
