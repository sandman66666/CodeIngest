import { ApiError } from '../middleware/error.middleware';

export class ClaudeService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
  }

  async analyzeCodeStructured(content: string): Promise<{
    insights: string[];
    vulnerabilities: string[];
    bestPractices: string[];
    specifications: string[];
  }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Analyze this code and provide structured insights in the following categories:
1. Best Practices: Identify code quality and maintainability aspects
2. Security: Find potential security vulnerabilities and risks
3. Architecture: Evaluate design patterns and architectural decisions
4. Specifications: Generate clear specifications for the code

Please provide the analysis in a clear, structured format.

Code to analyze:
${content}`,
          }],
        }),
      });

      if (!response.ok) {
        throw new ApiError(response.status === 401 ? 401 : 500, 'Failed to analyze code with Claude');
      }

      const result = await response.json();
      const analysis = result.content[0].text;

      return {
        insights: this.extractSection(analysis, 'Best Practices'),
        vulnerabilities: this.extractSection(analysis, 'Security'),
        bestPractices: this.extractSection(analysis, 'Architecture'),
        specifications: this.extractSection(analysis, 'Specifications'),
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to analyze code');
    }
  }

  private extractSection(text: string, section: string): string[] {
    const sectionRegex = new RegExp(`${section}:([\\s\\S]*?)(?=\\n\\d\\.\\s|$)`);
    const match = text.match(sectionRegex);
    if (!match) return [];
    
    return match[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}

export const claudeService = new ClaudeService();
