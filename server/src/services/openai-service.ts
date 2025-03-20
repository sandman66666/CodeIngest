import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Redefine Repository interface since the types import is not working
interface Repository {
  id: string;
  name: string;
  owner: string;
  description?: string;
  ingestedContent?: {
    summary?: string;
    tree?: string;
    fullCode?: string;
    fileCount?: number;
    sizeInBytes?: number;
  };
}

export class OpenAIService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('OpenAI API key is not set. Code analysis will not work properly.');
    }
  }

  async analyzeCode(content: string, fileContext: {
    repoName: string;
    owner: string;
    path: string;
    language?: string;
  }): Promise<{
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
  }> {
    try {
      // Call OpenAI API
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a code analysis assistant that provides insights and identifies vulnerabilities.`
            },
            {
              role: 'user',
              content: `Analyze this ${fileContext.language || ''} code from the file ${fileContext.path} in repository ${fileContext.owner}/${fileContext.repoName}:

${content}

Provide analysis in JSON format with these two arrays:
1. "insights": Array of objects with "type", "content", "severity" (info, warning, error)
2. "vulnerabilities": Array of objects with "type", "description", "severity" (low, medium, high, critical), "recommendation"
`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Extract JSON from response
      const analysisText = response.data.choices[0].message.content;
      let analysisData: any;
      
      try {
        // Try to parse JSON from the response
        analysisData = JSON.parse(analysisText);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', parseError);
        // Return empty results if parsing fails
        return { insights: [], vulnerabilities: [] };
      }

      // Format and return the analysis results
      return {
        insights: Array.isArray(analysisData.insights) ? analysisData.insights : [],
        vulnerabilities: Array.isArray(analysisData.vulnerabilities) ? analysisData.vulnerabilities : []
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to analyze code with OpenAI');
    }
  }

  async generateSpecification(
    files: Array<{ path: string; content: string }>,
    repoContext: {
      repoName: string;
      owner: string;
      description?: string;
    }
  ) {
    try {
      // Prepare content for analysis
      const fileContents = files.map(
        (file) => `File: ${file.path}\n${file.content.substring(0, 2000)}...`
      ).join('\n\n');

      // Call OpenAI API for project specification generation
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a software architecture expert who can analyze code repositories and generate specifications.'
            },
            {
              role: 'user',
              content: `Generate a specification for the repository ${repoContext.owner}/${repoContext.repoName}.
              
Description: ${repoContext.description || 'No description provided'}

Here are key files from the repository:
${fileContents}

Provide a specification with the following structure:
1. "overview": General description of the project
2. "architecture": Technical architecture description
3. "components": Array of key components, each with "name", "description", and "dependencies"
`
            }
          ],
          temperature: 0.5,
          max_tokens: 2500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Extract response and parse
      const specificationText = response.data.choices[0].message.content;
      let specificationData: any;
      
      try {
        // Try to parse if it's JSON, otherwise use the raw text
        specificationData = JSON.parse(specificationText);
      } catch (parseError) {
        // If not valid JSON, create a structured object from the text
        specificationData = {
          overview: specificationText.split('architecture:')[0] || specificationText,
          architecture: (specificationText.split('architecture:')[1] || '').split('components:')[0] || '',
          components: []
        };
      }

      return specificationData;
    } catch (error) {
      console.error('OpenAI API Error during specification generation:', error);
      throw new Error('Failed to generate project specifications with OpenAI');
    }
  }

  /**
   * Adapts the OpenAI API for code analysis to match the format expected by existing application
   */
  async analyzeCodeWithOpenAI(
    apiKey: string,
    repository: Repository,
    modelOverride?: string
  ): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> {
    try {
      if (apiKey) {
        this.apiKey = apiKey;
      }
      
      // Get repository content and handle token limit
      const fullCode = repository.ingestedContent?.fullCode || 'No code available';
      
      // Much stricter limit - approximately 30K tokens (rough estimate)
      // Assuming ~4 chars per token on average
      const MAX_CHARS = 120000; // Reduced from 600000
      
      // Get size diagnostics
      const codeSize = fullCode.length;
      const sizeKB = Math.round(codeSize / 1024); 
      const sizeMB = (sizeKB / 1024).toFixed(2);
      
      console.log(`[INFO] Repository code size: ${sizeMB} MB (${sizeKB} KB, ${codeSize} bytes)`);
      
      // If code is too large or we were instructed to force chunking via the sizeInBytes field
      const forceChunking = repository.ingestedContent?.sizeInBytes && repository.ingestedContent.sizeInBytes > 500000;
      
      if (codeSize > MAX_CHARS || forceChunking) {
        console.log(`[INFO] Large codebase detected: ${sizeMB} MB. Processing in chunks.`);
        return await this.analyzeCodeInChunks(fullCode, repository, modelOverride);
      }
      
      // For smaller codebases, process normally
      console.log(`[INFO] Code size: ${sizeMB} MB, within token limit for direct processing`);
      
      // Call OpenAI API - use gpt-3.5-turbo for better rate limits
      console.log(`[INFO] Using model: ${modelOverride || 'gpt-3.5-turbo'} for direct analysis`);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: modelOverride || 'gpt-3.5-turbo',  // Using a smaller model for better rate limits
          messages: [
            {
              role: 'system',
              content: `You are a code analysis assistant that provides insights about code quality, architecture, and potential issues.`
            },
            {
              role: 'user',
              content: `Analyze this code from repository ${repository.owner}/${repository.name}:

${fullCode}

Provide analysis in JSON format with an array called "insights" containing objects with these fields:
- "title": Brief title of the issue
- "description": Detailed explanation
- "severity": "low", "medium", or "high"
- "category": One of these: "bug", "security", "performance", "architecture", "best_practice", "code_quality"

Identify at least 5-7 important insights.`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Extract JSON from response
      const analysisText = response.data.choices[0].message.content;
      let analysisData: any = {};
      
      try {
        // Find JSON in the response 
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('[ERROR] Failed to parse OpenAI response as JSON:', parseError);
        
        // Fallback: Create mock insights if parsing fails
        return {
          insights: [
            {
              title: 'Analysis Error',
              description: 'Failed to parse analysis results from OpenAI. The response format was unexpected.',
              severity: 'medium',
              category: 'code_quality'
            },
            {
              title: 'Try Again Later',
              description: 'The OpenAI API response could not be processed. Consider trying again later.',
              severity: 'low',
              category: 'best_practice'
            }
          ]
        };
      }

      // Ensure we have an insights array
      if (!analysisData.insights || !Array.isArray(analysisData.insights)) {
        console.warn('[WARN] No insights array in OpenAI response, creating empty array');
        analysisData.insights = [];
      }
      
      return {
        insights: analysisData.insights.map((insight: any) => ({
          title: insight.title || 'Untitled Insight',
          description: insight.description || 'No description provided',
          severity: insight.severity || 'medium',
          category: insight.category || 'code_quality'
        }))
      };
    } catch (error: any) {
      console.error('[ERROR] OpenAI API Error:', error);
      
      if (error.response) {
        console.error('[ERROR] Status:', error.response.status);
        console.error('[ERROR] Data:', error.response.data);
      }
      
      // Provide descriptive error for common API issues
      if (error.response?.status === 401) {
        throw new Error('Authentication error: Invalid OpenAI API key');
      } else if (error.response?.status === 429) {
        console.log('[INFO] Rate limit exceeded. Attempting fallback to chunking...');
        
        try {
          // If we hit a rate limit, force chunking for this repository
          return await this.analyzeCodeInChunks(repository.ingestedContent?.fullCode || '', repository, modelOverride);
        } catch (fallbackError) {
          console.error('[ERROR] Chunking fallback failed:', fallbackError);
          throw new Error('Rate limit exceeded: Too many requests or token limit exceeded. Chunking fallback also failed.');
        }
      } else {
        throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
      }
    }
  }
  
  /**
   * Process large codebases by breaking them into manageable chunks
   * and aggregating the results
   */
  private async analyzeCodeInChunks(
    fullCode: string, 
    repository: Repository,
    modelOverride?: string
  ): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> {
    try {
      console.log(`[INFO] Breaking down large codebase for ${repository.owner}/${repository.name} into chunks for analysis`);
      
      // Size diagnostics
      const codeSize = fullCode.length;
      const sizeKB = Math.round(codeSize / 1024);
      const sizeMB = (sizeKB / 1024).toFixed(2);
      console.log(`[INFO] Total code size: ${sizeMB} MB (${sizeKB} KB)`);
      
      // Define chunk size - aim for ~20K tokens per chunk (80K chars)
      const CHUNK_SIZE = 80000;
      
      // Get total number of chunks needed
      const totalChunks = Math.ceil(fullCode.length / CHUNK_SIZE);
      console.log(`[INFO] Splitting into ${totalChunks} chunks for separate analysis`);
      
      // Initialize an array to hold all insights
      const allInsights: Array<{ title: string; description: string; severity: string; category: string }> = [];
      
      // Process each chunk
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fullCode.length);
        const chunk = fullCode.substring(start, end);
        
        console.log(`[INFO] Processing chunk ${i+1}/${totalChunks}: ${Math.round(chunk.length / 1024)} KB`);
        console.log(`[INFO] Using model: ${modelOverride || 'gpt-3.5-turbo'} for chunk analysis`);
        
        try {
          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: modelOverride || 'gpt-3.5-turbo',
              messages: [
                {
                  role: 'system',
                  content: `You are a code analysis assistant analyzing a portion (chunk ${i+1} of ${totalChunks}) of a repository.`
                },
                {
                  role: 'user',
                  content: `This is chunk ${i+1} of ${totalChunks} from repository ${repository.owner}/${repository.name}:

${chunk}

Analyze this code chunk. Focus on issues, bugs, and architectural insights you can find in this chunk only.
Provide analysis in JSON format with an array called "insights" containing objects with these fields:
- "title": Brief title of the issue
- "description": Detailed explanation
- "severity": "low", "medium", or "high"
- "category": One of these: "bug", "security", "performance", "architecture", "best_practice", "code_quality"

Return exactly 3-5 insights for this chunk. Focus on the most important findings only.`
                }
              ],
              temperature: 0.2,
              max_tokens: 1000
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
              }
            }
          );

          const analysisText = response.data.choices[0].message.content;
          
          try {
            // Parse insights from this chunk
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const chunkData = JSON.parse(jsonMatch[0]);
              
              // Add chunk number to insights for debugging
              const chunkInsights = (chunkData.insights || []).map((insight: any) => ({
                title: insight.title || `Insight from chunk ${i+1}`,
                description: insight.description || 'No description provided',
                severity: insight.severity || 'medium',
                category: insight.category || 'code_quality'
              }));
              
              allInsights.push(...chunkInsights);
              console.log(`[INFO] Added ${chunkInsights.length} insights from chunk ${i+1}`);
            }
          } catch (parseError) {
            console.error(`[ERROR] Failed to parse response from chunk ${i+1}:`, parseError);
          }
        } catch (chunkError: any) {
          console.error(`[ERROR] Failed to analyze chunk ${i+1}:`, chunkError.message);
          
          // If we hit a rate limit, wait and continue
          if (chunkError.response?.status === 429) {
            console.log(`[WARN] Rate limit hit during chunk ${i+1}, waiting for 20 seconds before continuing...`);
            await new Promise(resolve => setTimeout(resolve, 20000));
          }
        }
      }
      
      console.log(`[INFO] Completed analysis of all ${totalChunks} chunks, collected ${allInsights.length} insights`);
      
      // Consolidate similar insights
      const consolidatedInsights = this.consolidateInsights(allInsights);
      console.log(`[INFO] Consolidated to ${consolidatedInsights.length} unique insights`);
      
      return {
        insights: consolidatedInsights.map(insight => ({
          ...insight,
          id: uuidv4()
        }))
      };
    } catch (error) {
      console.error('[ERROR] Failed during chunked analysis:', error);
      throw new Error('Error during chunked code analysis: ' + (error as Error).message);
    }
  }
  
  /**
   * Consolidate insights from multiple chunks by removing duplicates
   * and merging similar insights
   */
  private consolidateInsights(
    allInsights: Array<{ title: string; description: string; severity: string; category: string }>
  ): Array<{ title: string; description: string; severity: string; category: string }> {
    // If we have few insights, no need to consolidate
    if (allInsights.length <= 5) {
      return allInsights;
    }
    
    console.log(`[INFO] Consolidating ${allInsights.length} insights to remove duplicates`);
    
    // Helper function to check if two insights are similar
    const areSimilar = (a: any, b: any): boolean => {
      // If titles are very similar
      const titleSimilarity = this.calculateSimilarity(a.title.toLowerCase(), b.title.toLowerCase());
      if (titleSimilarity > 0.8) {
        return true;
      }
      
      // If descriptions are very similar
      const descSimilarity = this.calculateSimilarity(
        a.description.toLowerCase().substring(0, 100), 
        b.description.toLowerCase().substring(0, 100)
      );
      
      return descSimilarity > 0.7;
    };
    
    // Group similar insights
    const groups: Array<Array<{ title: string; description: string; severity: string; category: string }>> = [];
    
    // Process each insight
    for (const insight of allInsights) {
      // Check if it belongs to an existing group
      let foundGroup = false;
      
      for (const group of groups) {
        // Compare with first item in the group (representative)
        if (areSimilar(insight, group[0])) {
          group.push(insight);
          foundGroup = true;
          break;
        }
      }
      
      // If no similar group found, create a new one
      if (!foundGroup) {
        groups.push([insight]);
      }
    }
    
    console.log(`[INFO] Grouped into ${groups.length} distinct insight groups`);
    
    // Choose the best representative from each group
    // Prefer insights with more details (longer descriptions)
    return groups.map(group => {
      // Sort by description length, most detailed first
      group.sort((a, b) => b.description.length - a.description.length);
      
      // Take the most detailed insight as representative 
      return {
        title: group[0].title,
        description: group[0].description,
        severity: group[0].severity,
        category: group[0].category
      };
    });
  }
  
  /**
   * Calculate simple string similarity score between 0 and 1
   * Higher values mean more similar
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;
    
    // Use Levenshtein distance for similarity
    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);
    
    // Convert distance to similarity score (1 = identical, 0 = completely different)
    return 1 - (distance / maxLength);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   * (number of single-character edits required to change one string into the other)
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Analyze code and return structured results for the existing application
   * This method provides compatibility with the previous Claude implementation
   */
  async analyzeCodeStructured(codeContent: string): Promise<any> {
    try {
      // Call OpenAI API
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a code analysis assistant that provides structured insights about code quality, architecture, and potential issues.`
            },
            {
              role: 'user',
              content: `Analyze this code:

${codeContent.length > 100000 ? codeContent.substring(0, 100000) + '\n\n[Content truncated due to length]' : codeContent}

Provide analysis as a JSON array where each object has:
- "id": A unique identifier (UUID format)
- "title": A concise description of the insight
- "description": Detailed explanation
- "severity": "low", "medium", or "high"
- "category": One of: "bug", "security", "performance", "architecture", "best_practice", "code_quality"

Return only valid JSON with no additional text or markdown.`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Extract JSON from response
      const analysisText = response.data.choices[0].message.content;
      let analysisData = [];
      
      try {
        // Try to parse the response as JSON
        const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the entire response if it's a JSON object
          const fullJsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (fullJsonMatch) {
            const parsed = JSON.parse(fullJsonMatch[0]);
            if (Array.isArray(parsed)) {
              analysisData = parsed;
            } else if (parsed.insights && Array.isArray(parsed.insights)) {
              analysisData = parsed.insights;
            }
          }
        }
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', parseError);
        // Return empty array if parsing fails
        return [];
      }

      // Ensure each insight has an ID
      return analysisData.map((insight: any) => ({
        id: insight.id || uuidv4(),
        title: insight.title || 'Untitled Insight',
        description: insight.description || 'No description provided',
        severity: insight.severity || 'medium',
        category: insight.category || 'code_quality'
      }));
    } catch (error) {
      console.error('OpenAI API Error during structured analysis:', error);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      throw new Error('Failed to analyze code with OpenAI');
    }
  }
}

// Export a singleton instance
export const openAIService = new OpenAIService();

// For backward compatibility with the existing code
export const analyzeCodeWithOpenAI = async (
  apiKey: string,
  repository: Repository,
  config?: { forceModel?: string; forceChunking?: boolean }
): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> => {
  console.log('[INFO] Using OpenAI API key from environment variable:', apiKey.substring(0, 7) + '...' + apiKey.slice(-4));
  console.log('[INFO] Direct OpenAI API key from environment:', apiKey.substring(0, 7) + '...' + apiKey.slice(-4));
  console.log('[INFO] Sending request to OpenAI API using direct approach');
  
  // Apply configuration overrides if provided
  if (config?.forceChunking) {
    console.log('[INFO] Forced chunking requested by caller');
    // If chunking is forced, we'll adjust the repository to trigger chunking
    repository = {
      ...repository,
      ingestedContent: {
        ...repository.ingestedContent,
        sizeInBytes: 1000000 // Set a large size to trigger chunking
      }
    };
  }
  
  // Prepare model override if specified
  const modelOverride = config?.forceModel;
  if (modelOverride) {
    console.log(`[INFO] Forcing use of model: ${modelOverride}`);
  }
  
  try {
    // Always use the class method with chunking capabilities
    return await openAIService.analyzeCodeWithOpenAI(apiKey, repository, modelOverride);
  } catch (error) {
    console.error('[ERROR] Error in analyzeCodeWithOpenAI standalone function:', error);
    
    // If there's an OpenAI error response, provide detailed logging
    if (error.response) {
      console.error('[ERROR] Status:', error.response.status);
      console.error('[ERROR] Data:', JSON.stringify(error.response.data));
      
      // If it's a token limit error, provide a more helpful error message
      if (error.response.status === 429 && error.response.data?.error?.code === 'rate_limit_exceeded') {
        console.log('[INFO] Token limit exceeded. Attempting fallback to smaller model and chunking...');
        
        // Try again with a modified repository to force chunking
        try {
          // Make a shallow copy to not modify the original
          const modifiedRepo = { 
            ...repository,
            // Simulate a large repository by adjusting fullCode size
            ingestedContent: { 
              ...repository.ingestedContent,
              // If fullCode is huge, we'll trigger the chunking logic
              sizeInBytes: repository.ingestedContent?.sizeInBytes || 1000000 // 1MB will trigger chunking
            }
          };
          
          return await openAIService.analyzeCodeWithOpenAI(apiKey, modifiedRepo);
        } catch (fallbackError) {
          console.error('[ERROR] Fallback attempt also failed:', fallbackError);
          // Return a user-friendly message about the rate limit
          return {
            insights: [
              {
                title: 'Analysis Failed - Repository Too Large',
                description: 'This repository exceeds the OpenAI token limit. Consider analyzing a smaller repository or contact support to increase your token limit.',
                severity: 'high',
                category: 'best_practice'
              }
            ]
          };
        }
      }
    }
    
    // Return a generic error if all else fails
    return {
      insights: [
        {
          title: 'Analysis Error',
          description: 'An error occurred during analysis: ' + (error.message || 'Unknown error'),
          severity: 'high',
          category: 'best_practice'
        }
      ]
    };
  }
};
