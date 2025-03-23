// Service for ingesting and processing code from repositories
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const githubApi = require('./github-service');
const { validateGitHubUrl } = require('common');

// Function to ingest code from a GitHub repository URL
async function ingestRepository(url, includeAllFiles = false) {
  try {
    // Parse owner and name from GitHub URL
    const validation = validateGitHubUrl(url);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    const repoOwner = validation.owner;
    const repoName = validation.repo;
    
    // Check if the repository exists on GitHub
    let githubResponse;
    try {
      githubResponse = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
        headers: { 'User-Agent': 'CodeIngest-App' }
      });
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Repository not found on GitHub');
      } else if (error.response?.status === 403) {
        throw new Error('Rate limit exceeded or access forbidden. Try again later.');
      } else {
        throw error;
      }
    }
    
    const repoData = githubResponse.data;
    
    // Check if the repository is private
    if (repoData.private) {
      throw new Error('This is a private repository. Only public repositories are supported.');
    }
    
    // Fetch repository details and tree
    const repoDetails = await githubApi.getRepoDetails(repoOwner, repoName);
    const branch = repoDetails.default_branch || 'main';
    const repoTree = await githubApi.getRepoTree(repoOwner, repoName, branch);
    
    if (!repoTree || !repoTree.tree) {
      throw new Error('Failed to fetch repository content');
    }
    
    // Filter and categorize files
    const MAX_FILE_SIZE_KB = 500; // Don't fetch files larger than 500KB
    const EXCLUDED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.tar', '.gz', '.pdf'];
    
    // First, categorize all files
    const allFiles = repoTree.tree
      .filter(item => {
        // Only include blob files (not directories)
        if (item.type !== 'blob') return false;
        
        // Check file size (in KB)
        const sizeKB = (item.size || 0) / 1024;
        if (sizeKB > MAX_FILE_SIZE_KB) return false;
        
        // Check file extension
        const extension = item.path.includes('.') ?
          item.path.substring(item.path.lastIndexOf('.')).toLowerCase() : '';
        return !EXCLUDED_EXTENSIONS.includes(extension);
      })
      .map(item => ({
        ...item,
        extension: item.path.includes('.') ? 
          item.path.substring(item.path.lastIndexOf('.')).toLowerCase() : '',
        isBusinessLogic: githubApi.isBusinessLogicOrPlatformCode(
          item.path, 
          item.path.includes('.') ? item.path.substring(item.path.lastIndexOf('.')).toLowerCase() : ''
        )
      }));
    
    // Split into business logic files and other files
    const businessLogicFiles = allFiles.filter(file => file.isBusinessLogic);
    const otherFiles = allFiles.filter(file => !file.isBusinessLogic);
    
    // Decide which files to fetch based on includeAllFiles flag
    const filesToFetch = includeAllFiles ? allFiles : businessLogicFiles;
    
    // Find README file
    const readmeFile = allFiles.find(file => 
      file.path.toLowerCase() === 'readme.md' || 
      file.path.toLowerCase() === 'readme.markdown' || 
      file.path.toLowerCase() === 'readme'
    );
    
    // Fetch content for each file
    const fileContents = [];
    const consolidatedCode = [];
    let totalSizeBytes = 0;
    let readmeContent = null;
    
    // First, fetch README if it exists
    if (readmeFile) {
      try {
        readmeContent = await githubApi.getFileContent(repoOwner, repoName, readmeFile.path, branch);
      } catch (error) {
        console.error(`Error fetching README: ${error.message}`);
      }
    }
    
    // Then fetch chosen code files
    for (const file of filesToFetch) {
      try {
        // Get file content from GitHub
        const fileContent = await githubApi.getFileContent(repoOwner, repoName, file.path, branch);
        
        if (fileContent) {
          fileContents.push({
            path: file.path,
            content: fileContent,
            isBusinessLogic: file.isBusinessLogic
          });
          
          consolidatedCode.push(
            `// *************************************************`,
            `// File: ${file.path}`,
            `// *************************************************`,
            ``,
            fileContent,
            ``,
            ``
          );
          
          totalSizeBytes += (fileContent.length || 0);
        }
      } catch (error) {
        // Continue with other files even if one fails
        console.error(`Error fetching content for ${file.path}:`, error.message);
      }
    }
    
    const fullCode = consolidatedCode.join('\n');
    
    // Generate tree display
    const treeDisplay = githubApi.generateTreeView(allFiles);
    
    // Return the results
    return {
      summary: {
        repository: `${repoOwner}/${repoName}`,
        description: repoDetails.description || 'None',
        language: repoDetails.language || 'Unknown',
        totalFiles: repoTree.tree.filter(item => item.type === 'blob').length,
        fetchedFiles: fileContents.length,
        businessLogicCount: businessLogicFiles.length,
        otherFilesCount: otherFiles.length
      },
      tree: treeDisplay,
      content: fullCode,
      fileCount: fileContents.length,
      totalSizeBytes,
      files: fileContents,
      readme: readmeContent,
      businessLogicFiles: businessLogicFiles.map(f => f.path),
      otherFiles: otherFiles.map(f => f.path),
      allFilesIncluded: includeAllFiles,
      // Add all files information for selectable tree
      allFiles: allFiles.map(file => ({
        path: file.path,
        type: file.type,
        size: file.size,
        isBusinessLogic: file.isBusinessLogic
      }))
    };
  } catch (error) {
    console.error('Error during repository ingestion:', error);
    throw error;
  }
}

// Function to generate a digest for selected files
async function generateDigestForFiles(repoOwner, repoName, branch, filePaths) {
  try {
    const consolidatedCode = [];
    
    for (const path of filePaths) {
      try {
        // Get file content from GitHub
        const fileContent = await githubApi.getFileContent(repoOwner, repoName, path, branch);
        
        if (fileContent) {
          consolidatedCode.push(
            `// *************************************************`,
            `// File: ${path}`,
            `// *************************************************`,
            ``,
            fileContent,
            ``,
            ``
          );
        }
      } catch (error) {
        console.error(`Error fetching content for ${path}:`, error.message);
        // Continue with other files even if one fails
      }
    }
    
    return consolidatedCode.join('\n');
  } catch (error) {
    console.error('Error generating digest:', error);
    throw error;
  }
}

// Function to get additional files that weren't included in the initial ingestion
async function getAdditionalFiles(repoOwner, repoName, branch, filePaths) {
  try {
    const fileContents = [];
    const consolidatedCode = [];
    let totalSizeBytes = 0;
    
    for (const path of filePaths) {
      try {
        // Get file content from GitHub
        const fileContent = await githubApi.getFileContent(repoOwner, repoName, path, branch);
        
        if (fileContent) {
          fileContents.push({
            path: path,
            content: fileContent,
            isBusinessLogic: false
          });
          
          consolidatedCode.push(
            `// *************************************************`,
            `// File: ${path}`,
            `// *************************************************`,
            ``,
            fileContent,
            ``,
            ``
          );
          
          totalSizeBytes += (fileContent.length || 0);
        }
      } catch (error) {
        console.error(`Error fetching content for ${path}:`, error.message);
      }
    }
    
    const additionalCode = consolidatedCode.join('\n');
    
    return {
      content: additionalCode,
      fileCount: fileContents.length,
      totalSizeBytes,
      files: fileContents
    };
  } catch (error) {
    console.error('Error fetching additional files:', error);
    throw error;
  }
}

module.exports = { 
  ingestRepository,
  getAdditionalFiles,
  generateDigestForFiles
};
