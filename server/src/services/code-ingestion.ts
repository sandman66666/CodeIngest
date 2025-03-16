import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as glob from 'glob';

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
  
  // If token is provided, insert it into the clone URL for private repos
  if (token) {
    // Transform https://github.com/owner/repo to https://token@github.com/owner/repo
    const tokenUrl = repoUrl.replace('https://', `https://${token}@`);
    cloneCommand += ` ${tokenUrl} ${destination}`;
  } else {
    cloneCommand += ` ${repoUrl} ${destination}`;
  }
  
  try {
    const { stdout, stderr } = await execPromise(cloneCommand);
    if (stderr && !stderr.includes('Cloning into')) {
      console.warn('Clone warnings:', stderr);
    }
    return stdout || 'Repository cloned successfully';
  } catch (error: any) {
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

/**
 * Process the repository content
 */
async function processRepository(
  repoPath: string,
  includePatterns: string[],
  excludePatterns: string[],
  maxFileSizeBytes: number
): Promise<IngestionResult> {
  // Get all files matching include patterns
  const filePaths: string[] = [];
  
  for (const pattern of includePatterns) {
    const matches = glob.sync(pattern, { 
      cwd: repoPath, 
      ignore: excludePatterns,
      nodir: true,
      absolute: false
    });
    
    filePaths.push(...matches);
  }
  
  // Remove duplicates
  const uniqueFilePaths = [...new Set(filePaths)];
  
  console.log(`Found ${uniqueFilePaths.length} files to process`);
  
  // Generate directory tree
  const { stdout: tree } = await execPromise(`find ${repoPath} -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | sort`);
  const formattedTree = tree
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.replace(repoPath, ''))
    .filter(line => line)
    .map(line => `- ${line}`)
    .join('\n');
  
  // Process each file
  let totalSizeBytes = 0;
  let contentParts: string[] = [];
  
  for (const relativePath of uniqueFilePaths) {
    const fullPath = path.join(repoPath, relativePath);
    
    try {
      const stats = fs.statSync(fullPath);
      
      // Skip files that are too large
      if (stats.size > maxFileSizeBytes) {
        contentParts.push(`\n\n## ${relativePath}\n\n[File too large - ${formatBytes(stats.size)}]`);
        continue;
      }
      
      totalSizeBytes += stats.size;
      
      // Read file content
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Add file to combined content
      contentParts.push(`\n\n## ${relativePath}\n\n\`\`\`\n${content}\n\`\`\``);
    } catch (error) {
      console.warn(`Error processing file ${relativePath}:`, error);
      contentParts.push(`\n\n## ${relativePath}\n\n[Error reading file]`);
    }
  }
  
  // Create summary
  const summary = `## Repository Structure\n\n${formattedTree}`;
  
  // Combine all content
  const combinedContent = contentParts.join('');
  
  return {
    summary,
    tree: formattedTree,
    content: combinedContent,
    filePaths: uniqueFilePaths,
    fileCount: uniqueFilePaths.length,
    totalSizeBytes
  };
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
