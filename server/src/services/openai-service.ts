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
    repository: Repository
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
      
      // If code is too large, process it in chunks
      if (fullCode.length > MAX_CHARS) {
        console.log(`Large codebase detected: ${(fullCode.length / 1000).toFixed(0)}K chars. Processing in chunks.`);
        return await this.analyzeCodeInChunks(fullCode, repository);
      }
      
      // For smaller codebases, process normally
      console.log(`Code size: ${(fullCode.length / 1000).toFixed(0)}K chars, within limit`);
      
      // Call OpenAI API - use gpt-3.5-turbo for better rate limits
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',  // Using a smaller model for better rate limits
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
        console.error('Failed to parse OpenAI response as JSON:', parseError);
        
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
        console.warn('No insights array in OpenAI response, creating empty array');
        analysisData.insights = [];
      }
      
      return {
        insights: analysisData.insights.map((insight: any) => ({
          id: uuidv4(), // Add IDs to match expected format
          title: insight.title || 'Untitled Insight',
          description: insight.description || 'No description provided',
          severity: insight.severity || 'medium',
          category: insight.category || 'code_quality'
        }))
      };
    } catch (error: any) {
      console.error('OpenAI API Error:', error);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      
      // Provide descriptive error for common API issues
      if (error.response?.status === 401) {
        throw new Error('Authentication error: Invalid OpenAI API key');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded: Too many requests or token limit exceeded. Try with a smaller repository.');
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
    repository: Repository
  ): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> {
    const CHUNK_SIZE = 100000; // ~25K tokens per chunk
    const allInsights: Array<{ title: string; description: string; severity: string; category: string }> = [];
    
    // Split by file boundaries if possible (using file separator patterns)
    const fileSeparators = [
      /\n={20,}\nFile: .+\n={20,}\n/g,  // Standard file separator
      /\n-{20,}\nFile: .+\n-{20,}\n/g,   // Alternative separator
      /\n\/\/ FILE: .+\n/g,               // Comment separator
      /\n\/\* FILE: .+ \*\/\n/g           // Block comment separator
    ];
    
    let fileChunks: string[] = [];
    
    // Try to split by file separators
    for (const separator of fileSeparators) {
      const parts = fullCode.split(separator);
      if (parts.length > 1) {
        console.log(`Split code into ${parts.length} file chunks`);
        fileChunks = parts;
        break;
      }
    }
    
    // If no file separators found, split by character count
    if (fileChunks.length === 0) {
      console.log('No file separators found, splitting by character count');
      fileChunks = [];
      let i = 0;
      while (i < fullCode.length) {
        // Find a reasonable breakpoint (newline) near the chunk size
        let endIndex = Math.min(i + CHUNK_SIZE, fullCode.length);
        if (endIndex < fullCode.length) {
          const nextNewline = fullCode.indexOf('\n', endIndex);
          if (nextNewline !== -1 && nextNewline - endIndex < 1000) {
            endIndex = nextNewline;
          }
        }
        fileChunks.push(fullCode.substring(i, endIndex));
        i = endIndex;
      }
      console.log(`Split code into ${fileChunks.length} character chunks`);
    }
    
    // Process each chunk with a delay to avoid rate limits
    console.log(`Processing ${fileChunks.length} chunks`);
    for (let i = 0; i < fileChunks.length; i++) {
      try {
        console.log(`Processing chunk ${i+1}/${fileChunks.length}`);
        
        // Add context about which part of the code this is
        const chunkPrefix = `CHUNK ${i+1} OF ${fileChunks.length} FROM REPOSITORY ${repository.owner}/${repository.name}\n\n`;
        const chunkContent = chunkPrefix + fileChunks[i];
        
        // Call OpenAI API for this chunk
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are analyzing a PORTION of a larger codebase. Focus on code quality and architecture insights for just this section.`
              },
              {
                role: 'user',
                content: `Analyze this code chunk (${i+1} of ${fileChunks.length}) from repository ${repository.owner}/${repository.name}:

${chunkContent}

Provide 2-3 insights in JSON format with an array called "insights" containing objects with:
- "title": Brief title of the issue
- "description": Detailed explanation
- "severity": "low", "medium", or "high"
- "category": One of: "bug", "security", "performance", "architecture", "best_practice", "code_quality"

Return valid JSON only.`
              }
            ],
            temperature: 0.3,
            max_tokens: 1000
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );
        
        // Parse response
        const analysisText = response.data.choices[0].message.content;
        let chunkInsights: any[] = [];
        
        try {
          // Extract JSON from the response
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysisData = JSON.parse(jsonMatch[0]);
            if (analysisData.insights && Array.isArray(analysisData.insights)) {
              chunkInsights = analysisData.insights;
            }
          }
        } catch (parseError) {
          console.warn(`Failed to parse chunk ${i+1} response:`, parseError);
          // Continue to next chunk if this one fails
          continue;
        }
        
        // Add these insights to the overall collection
        chunkInsights.forEach(insight => {
          allInsights.push({
            title: `[Part ${i+1}] ${insight.title || 'Untitled Insight'}`,
            description: insight.description || 'No description provided',
            severity: insight.severity || 'medium',
            category: insight.category || 'code_quality'
          });
        });
        
        // Add delay between chunks to avoid rate limits (if not the last chunk)
        if (i < fileChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`Error processing chunk ${i+1}:`, error);
        
        // If we hit a rate limit, stop processing more chunks
        if (error.response?.status === 429) {
          allInsights.push({
            title: 'Rate Limit Exceeded',
            description: 'Analysis was stopped because the OpenAI API rate limit was reached. Only partial results are available.',
            severity: 'high',
            category: 'best_practice'
          });
          break;
        }
        
        // For other errors, continue with next chunk
        continue;
      }
    }
    
    // Consolidate insights - remove duplicates
    const consolidatedInsights = this.consolidateInsights(allInsights);
    
    // Add IDs to finalized insights
    return {
      insights: consolidatedInsights.map(insight => ({
        ...insight,
        id: uuidv4()
      }))
    };
  }
  
  /**
   * Consolidate insights from multiple chunks by removing duplicates
   * and merging similar insights
   */
  private consolidateInsights(
    allInsights: Array<{ title: string; description: string; severity: string; category: string }>
  ): Array<{ title: string; description: string; severity: string; category: string }> {
    // Map to track unique insights by normalized title
    const uniqueInsights = new Map<string, { title: string; description: string; severity: string; category: string }>();
    
    // Process each insight
    allInsights.forEach(insight => {
      // Normalize the title (remove [Part X] prefix, lowercase, etc.)
      const normalizedTitle = insight.title.replace(/\[Part \d+\]\s+/, '').toLowerCase().trim();
      
      // Check if we already have a similar insight
      if (uniqueInsights.has(normalizedTitle)) {
        // Combine if the descriptions differ significantly
        const existing = uniqueInsights.get(normalizedTitle)!;
        
        // Choose the higher severity
        const severityMap: { [key: string]: number } = { 'low': 1, 'medium': 2, 'high': 3 };
        const existingSeverity = severityMap[existing.severity] || 1;
        const newSeverity = severityMap[insight.severity] || 1;
        
        if (newSeverity > existingSeverity) {
          existing.severity = insight.severity;
        }
      } else {
        // Create a clean version of the insight without chunk numbers
        const cleanTitle = insight.title.replace(/\[Part \d+\]\s+/, '');
        uniqueInsights.set(normalizedTitle, {
          ...insight,
          title: cleanTitle
        });
      }
    });
    
    // Convert back to array and limit to most important insights
    const result = Array.from(uniqueInsights.values());
    
    // Sort by severity (high to low)
    return result.sort((a, b) => {
      const severityMap: { [key: string]: number } = { 'low': 1, 'medium': 2, 'high': 3 };
      return (severityMap[b.severity] || 0) - (severityMap[a.severity] || 0);
    });
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
  repository: Repository
): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> => {
  return openAIService.analyzeCodeWithOpenAI(apiKey, repository);
};
