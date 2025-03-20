import Anthropic from '@anthropic-ai/sdk';

// Redefine Repository interface for internal use
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

/**
 * AnthropicService - Service for analyzing code using Anthropic's Claude API
 * Claude has a much larger context window (up to 100K tokens) which makes it
 * ideal for analyzing large codebases without needing to chunk the input
 */
class AnthropicService {
  private anthropic: Anthropic;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[WARN] Anthropic API key is not set. Code analysis will not work properly.');
    }
    
    this.anthropic = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  /**
   * Analyze a repository using Anthropic's Claude API
   * Claude has much higher token limits than GPT models, making it better
   * suited for large codebases
   */
  async analyzeRepository(
    apiKey: string | undefined,
    repository: Repository,
    config: { model?: string } = {}
  ): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> {
    try {
      // Use provided API key if available
      if (apiKey) {
        this.apiKey = apiKey;
        this.anthropic = new Anthropic({
          apiKey
        });
      }
      
      // Ensure we have code to analyze
      const fullCode = repository.ingestedContent?.fullCode;
      if (!fullCode) {
        throw new Error('No code content available for analysis');
      }
      
      // Get size diagnostics
      const codeSize = fullCode.length;
      const sizeKB = Math.round(codeSize / 1024);
      const sizeMB = (sizeKB / 1024).toFixed(2);
      
      console.log(`[INFO] Repository code size: ${sizeMB} MB (${sizeKB} KB, ${codeSize} bytes)`);
      
      // Check if the code size is extremely large
      // Claude's context window is large but has limits
      if (codeSize > 500000) {
        console.log(`[WARN] Repository is extremely large (${sizeMB} MB). May need sample-based analysis.`);
      }
      
      // Use the specified model or default to claude-3.5-sonnet
      const model = config.model || 'claude-3-5-sonnet-20240620';
      
      // Create system and user messages for Claude
      console.log(`[INFO] Analyzing repository ${repository.owner}/${repository.name} with Claude model: ${model}`);

      // Use the correct SDK method for Claude API v1
      const prompt = `
Human: You are a code analysis expert analyzing a GitHub repository. Provide detailed, actionable insights about code quality, architecture, potential bugs, security issues, and best practices.

Analyze this code from repository ${repository.owner}/${repository.name}:

${fullCode}

Provide analysis in JSON format with an array called "insights" containing objects with these fields:
- "title": Brief, specific title of the insight
- "description": Detailed explanation with specific examples from the code
- "severity": "low", "medium", or "high"
- "category": One of these: "bug", "security", "performance", "architecture", "best_practice", "code_quality"

Identify 7-10 most important insights. Focus on concrete, actionable issues rather than general observations.
Ensure your response is valid JSON.
`;

      // Call Anthropic API with the correct SDK structure
      const response = await this.anthropic.completions.create({
        model,
        max_tokens_to_sample: 4000,
        temperature: 0.2,
        prompt
      });

      // Extract insights from Claude's response
      const analysisText = response.completion;
      let analysisData: any = {};
      
      try {
        // Find JSON in the response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in Claude response');
        }
      } catch (parseError) {
        console.error('[ERROR] Failed to parse Claude response as JSON:', parseError);
        
        // If we can't parse the response as JSON, try to extract insights manually
        const insights = this.extractInsightsFromText(analysisText);
        if (insights.length > 0) {
          return { insights };
        }
        
        // Fallback to mock insights if all else fails
        return {
          insights: [
            {
              title: 'Analysis Error',
              description: 'Failed to parse analysis results from Claude. The response format was unexpected.',
              severity: 'medium',
              category: 'code_quality'
            },
            {
              title: 'Try Again Later',
              description: 'The Claude API response could not be processed. Consider trying again later.',
              severity: 'low',
              category: 'best_practice'
            }
          ]
        };
      }

      // Ensure we have an insights array
      if (!analysisData.insights || !Array.isArray(analysisData.insights)) {
        console.warn('[WARN] No insights array in Claude response, creating empty array');
        analysisData.insights = [];
      }
      
      // Map insights to expected format
      return {
        insights: analysisData.insights.map((insight: any) => ({
          title: insight.title || 'Untitled Insight',
          description: insight.description || 'No description provided',
          severity: insight.severity || 'medium',
          category: insight.category || 'code_quality'
        }))
      };
    } catch (error: any) {
      console.error('[ERROR] Claude API Error:', error);
      
      if (error.status) {
        console.error('[ERROR] Status:', error.status);
        console.error('[ERROR] Type:', error.type);
        console.error('[ERROR] Message:', error.message);
      }
      
      // Provide descriptive error for common API issues
      if (error.status === 401) {
        throw new Error('Authentication error: Invalid Anthropic API key');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded: Too many requests to Claude API');
      } else if (error.status === 400 && error.message?.includes('token')) {
        throw new Error('Token limit exceeded: Repository too large for Claude');
      } else {
        throw new Error(`Claude API error: ${error.message || 'Unknown error'}`);
      }
    }
  }
  
  /**
   * Extract insights from non-JSON text using regex patterns
   * This is a fallback method if JSON parsing fails
   */
  private extractInsightsFromText(text: string): Array<{ title: string; description: string; severity: string; category: string }> {
    const insights: Array<{ title: string; description: string; severity: string; category: string }> = [];
    
    // Look for insight patterns like:
    // Title: XYZ
    // Description: ABC
    // Severity: High
    // Category: security
    
    const insightBlocks = text.split(/\n\s*\n/);
    
    for (const block of insightBlocks) {
      const titleMatch = block.match(/(?:title|issue|problem):\s*([^\n]+)/i);
      const descMatch = block.match(/(?:description|details):\s*([^\n]+(?:\n(?!\s*(?:severity|category):)[^\n]+)*)/i);
      const severityMatch = block.match(/severity:\s*(low|medium|high)/i);
      const categoryMatch = block.match(/category:\s*(bug|security|performance|architecture|best_practice|code_quality)/i);
      
      if (titleMatch) {
        insights.push({
          title: titleMatch[1].trim(),
          description: descMatch ? descMatch[1].trim() : 'No description provided',
          severity: severityMatch ? severityMatch[1].toLowerCase() : 'medium',
          category: categoryMatch ? categoryMatch[1].toLowerCase() : 'code_quality'
        });
      }
    }
    
    return insights;
  }
}

// Export a singleton instance
export const anthropicService = new AnthropicService();

// For compatibility with existing code
export const analyzeCodeWithAnthropic = async (
  apiKey: string,
  repository: Repository,
  config: { model?: string } = {}
): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> => {
  return anthropicService.analyzeRepository(apiKey, repository, config);
};
