// Routes for repository ingestion and management
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { ingestRepository, getAdditionalFiles, generateDigestForFiles } = require('../services/code-ingestion');
const { analyzeCodeWithClaude, extractCodeElements } = require('../services/claude-service');
const { validateGitHubUrl } = require('common');

// In-memory store for repositories and analyses
const store = {
  repositories: [],
  analyses: [],
  extractions: [],
  
  getRepositoryById(id) {
    return this.repositories.find(repo => repo.id === id);
  },
  
  addRepository(repository) {
    this.repositories.push(repository);
    return repository;
  },
  
  getAnalysisById(id) {
    return this.analyses.find(analysis => analysis.id === id);
  },
  
  addAnalysis(analysis) {
    this.analyses.push(analysis);
    return analysis;
  },
  
  updateAnalysis(id, updates) {
    const index = this.analyses.findIndex(analysis => analysis.id === id);
    if (index !== -1) {
      this.analyses[index] = { ...this.analyses[index], ...updates };
      return this.analyses[index];
    }
    return null;
  },
  
  getExtractionById(id) {
    return this.extractions.find(extraction => extraction.id === id);
  },
  
  addExtraction(extraction) {
    this.extractions.push(extraction);
    return extraction;
  },
  
  updateExtraction(id, updates) {
    const index = this.extractions.findIndex(extraction => extraction.id === id);
    if (index !== -1) {
      this.extractions[index] = { ...this.extractions[index], ...updates };
      return this.extractions[index];
    }
    return null;
  }
};

// Ingest a public GitHub repository
router.post('/public-repositories', async (req, res) => {
  try {
    const { url, includeAllFiles = false } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'GitHub repository URL is required' });
    }
    
    // Validate GitHub URL
    const validation = validateGitHubUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }
    
    const repoOwner = validation.owner;
    const repoName = validation.repo;
    
    try {
      // Perform ingestion process
      console.log(`Starting ingestion process for ${repoOwner}/${repoName}`);
      console.log(`Including all files: ${includeAllFiles}`);
      
      const ingestionResult = await ingestRepository(url, includeAllFiles);
      
      console.log(`Completed ingestion for ${repoOwner}/${repoName} with ${ingestionResult.fileCount} files`);
      
      // Create repository object
      const repository = {
        id: uuidv4(),
        owner: repoOwner,
        name: repoName,
        url: url,
        createdAt: new Date().toISOString(),
        status: 'ingested',
        ingestedContent: {
          summary: ingestionResult.summary,
          tree: ingestionResult.tree,
          fullCode: ingestionResult.content,
          fileCount: ingestionResult.fileCount,
          sizeInBytes: ingestionResult.totalSizeBytes,
          readme: ingestionResult.readme,
          businessLogicFiles: ingestionResult.businessLogicFiles,
          otherFiles: ingestionResult.otherFiles,
          allFilesIncluded: ingestionResult.allFilesIncluded,
          allFiles: ingestionResult.allFiles
        }
      };
      
      // Add to store
      store.addRepository(repository);
      
      return res.status(201).json({ repository });
    } catch (error) {
      console.error('Error during repository ingestion:', error);
      return res.status(500).json({ error: `An error occurred during repository ingestion: ${error.message}` });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get repository details
router.get('/repositories/:id', (req, res) => {
  const { id } = req.params;
  const repository = store.getRepositoryById(id);
  
  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }
  
  return res.json({ repository });
});

// List all repositories
router.get('/repositories', (req, res) => {
  // Map to return just the summary information without the full code content
  const repositories = store.repositories.map(repo => ({
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    url: repo.url,
    createdAt: repo.createdAt,
    status: repo.status,
    summary: repo.ingestedContent.summary,
    fileCount: repo.ingestedContent.fileCount,
    sizeInBytes: repo.ingestedContent.sizeInBytes,
    allFilesIncluded: repo.ingestedContent.allFilesIncluded
  }));
  
  return res.json({ repositories });
});

// Get additional files for a repository
router.post('/repositories/:id/additional-files', async (req, res) => {
  try {
    const { id } = req.params;
    const repository = store.getRepositoryById(id);
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Check if all files are already included
    if (repository.ingestedContent.allFilesIncluded) {
      return res.status(400).json({ error: 'All files are already included' });
    }
    
    // Get the other files that weren't initially ingested
    const otherFiles = repository.ingestedContent.otherFiles || [];
    
    if (otherFiles.length === 0) {
      return res.status(400).json({ error: 'No additional files available' });
    }
    
    try {
      // Fetch additional files
      const additionalFiles = await getAdditionalFiles(
        repository.owner,
        repository.name,
        'main', // We could store the branch in the repository object
        otherFiles
      );
      
      // Update repository with additional files
      repository.ingestedContent.fullCode += '\n\n' + additionalFiles.content;
      repository.ingestedContent.fileCount += additionalFiles.fileCount;
      repository.ingestedContent.sizeInBytes += additionalFiles.totalSizeBytes;
      repository.ingestedContent.allFilesIncluded = true;
      
      return res.json({
        success: true,
        additionalFilesCount: additionalFiles.fileCount,
        totalFileCount: repository.ingestedContent.fileCount
      });
    } catch (error) {
      console.error('Error fetching additional files:', error);
      return res.status(500).json({ error: `Error fetching additional files: ${error.message}` });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze repository code with Claude AI
router.post('/analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey } = req.body;
    
    // Get repository from store
    const repository = store.getRepositoryById(id);
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Create an analysis entry
    const analysisId = uuidv4();
    const analysis = {
      id: analysisId,
      repositoryId: id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      results: []
    };
    
    // Add to store
    store.addAnalysis(analysis);
    
    // Process the analysis asynchronously
    (async () => {
      try {
        // Validate Anthropic API key
        if (!apiKey) {
          updateAnalysisStatus(analysisId, 'failed', 'API key not provided');
          return;
        }
        
        // Extract code content from repository
        const codeContent = repository.ingestedContent?.fullCode || '';
        
        if (!codeContent) {
          const error = new Error('No code content available for analysis');
          updateAnalysisStatus(analysisId, 'failed', error.message);
          return;
        }
        
        try {
          // Analyze code with Claude AI
          const results = await analyzeCodeWithClaude(codeContent, apiKey);
          
          // Update analysis with results
          updateAnalysisStatus(analysisId, 'completed', null, results);
          console.log(`Analysis completed successfully with ${results.length} insights`);
        } catch (apiError) {
          console.error(`Anthropic API error: ${apiError.message}`);
          updateAnalysisStatus(analysisId, 'failed', apiError.message);
        }
      } catch (error) {
        console.error(`Error during analysis: ${error.message}`);
        updateAnalysisStatus(analysisId, 'failed', error.message);
      }
    })();
    
    return res.json({ analysisId });
  } catch (error) {
    console.error(`Unexpected error in /analysis: ${error.message}`);
    return res.status(500).json({ error: 'Failed to process analysis request' });
  }
});

// Extract key elements from code with Claude AI
router.post('/extract/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey } = req.body;
    
    // Get repository from store
    const repository = store.getRepositoryById(id);
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Extract code content from repository
    const codeContent = repository.ingestedContent?.fullCode || '';
    
    if (!codeContent) {
      return res.status(400).json({ error: 'No code content available for extraction' });
    }
    
    try {
      // Extract key elements with Claude AI
      const extractedCode = await extractCodeElements(codeContent, apiKey);
      
      // Store the extraction result
      const extractionId = uuidv4();
      const extraction = {
        id: extractionId,
        repositoryId: id,
        extractedCode,
        createdAt: new Date().toISOString()
      };
      
      store.addExtraction(extraction);
      
      return res.json({ extractionId, extractedCode });
    } catch (apiError) {
      console.error(`Anthropic API error: ${apiError.message}`);
      return res.status(500).json({ error: apiError.message });
    }
  } catch (error) {
    console.error(`Unexpected error in /extract: ${error.message}`);
    return res.status(500).json({ error: 'Failed to process extraction request' });
  }
});

// Get analysis results
router.get('/analysis/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check for analysis in store
    const analysis = store.getAnalysisById(id);
    
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    // Get repository details
    const repository = store.getRepositoryById(analysis.repositoryId);
    
    return res.json({
      analysis,
      repository: repository ? {
        id: repository.id,
        owner: repository.owner,
        name: repository.name
      } : null
    });
  } catch (error) {
    console.error(`Error retrieving analysis: ${error.message}`);
    return res.status(500).json({ error: 'Failed to retrieve analysis results' });
  }
});

// Generate digest for selected files
router.post('/repositories/:id/generate-digest', async (req, res) => {
  try {
    const { id } = req.params;
    const { filePaths } = req.body;
    
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return res.status(400).json({ error: 'File paths must be a non-empty array' });
    }
    
    const repository = store.getRepositoryById(id);
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    try {
      // Generate digest for selected files
      const digest = await generateDigestForFiles(
        repository.owner,
        repository.name,
        'main', // We could store the branch in the repository object
        filePaths
      );
      
      return res.json({ digest });
    } catch (error) {
      console.error('Error generating digest:', error);
      return res.status(500).json({ error: `Error generating digest: ${error.message}` });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get extraction results
router.get('/extract/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check for extraction in store
    const extraction = store.getExtractionById(id);
    
    if (!extraction) {
      return res.status(404).json({ error: 'Extraction not found' });
    }
    
    // Get repository details
    const repository = store.getRepositoryById(extraction.repositoryId);
    
    return res.json({
      extraction,
      repository: repository ? {
        id: repository.id,
        owner: repository.owner,
        name: repository.name
      } : null
    });
  } catch (error) {
    console.error(`Error retrieving extraction: ${error.message}`);
    return res.status(500).json({ error: 'Failed to retrieve extraction results' });
  }
});

// Helper function to update analysis status
function updateAnalysisStatus(id, status, error = null, results = null) {
  const updates = {
    status,
    ...(error && { error }),
    ...(status === 'completed' && { completedAt: new Date().toISOString() }),
    ...(results && { results })
  };
  
  store.updateAnalysis(id, updates);
  
  console.log(`Updated analysis ${id} status to ${status}`);
}

module.exports = router;
