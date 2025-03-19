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
      
      // Limit code size to approximately 150K tokens (rough estimate)
      // Assuming ~4 chars per token on average
      const MAX_CHARS = 600000;
      const truncatedCode = fullCode.length > MAX_CHARS 
        ? fullCode.substring(0, MAX_CHARS) + `\n\n... [Content truncated: ${((fullCode.length - MAX_CHARS) / 1000).toFixed(0)}K characters removed due to token limit] ...\n`
        : fullCode;
      
      console.log(`Code size: Original ${(fullCode.length / 1000).toFixed(0)}K chars, Truncated to ${(truncatedCode.length / 1000).toFixed(0)}K chars`);
      
      // Call OpenAI API
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',  // Using a smaller model for faster response
          messages: [
            {
              role: 'system',
              content: `You are a code analysis assistant that provides insights about code quality, architecture, and potential issues.`
            },
            {
              role: 'user',
              content: `Analyze this code from repository ${repository.owner}/${repository.name}:

${truncatedCode}

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
        throw new Error('Rate limit exceeded: Too many requests to the OpenAI API');
      } else {
        throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
      }
    }
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
