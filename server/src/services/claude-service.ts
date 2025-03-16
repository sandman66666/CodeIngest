import axios from 'axios';

interface AnalysisResult {
  overview: string;
  components: {
    name: string;
    description: string;
    responsibilities: string[];
  }[];
  insights: {
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    category: string;
  }[];
}

export async function analyzeCodeWithClaude(
  apiKey: string,
  codeContent: string,
  repositoryName: string
): Promise<AnalysisResult> {
  try {
    // Truncate code if it's too large (Claude has token limits)
    const truncatedCode = codeContent.length > 100000 
      ? codeContent.substring(0, 100000) + "\n\n[Code truncated due to size limits]" 
      : codeContent;
    
    // Prepare the prompt
    const prompt = `You are an expert code analyst. Analyze the following code from repository "${repositoryName}":

\`\`\`
${truncatedCode}
\`\`\`

Please provide a structured analysis with the following:
1. A brief overview of what this codebase does
2. Identification of main components
3. Key insights, architectural patterns, potential issues or recommendations

Format your response as JSON with the following structure:
{
  "overview": "Brief overview of what the code does",
  "components": [
    {
      "name": "Component name",
      "description": "What this component does",
      "responsibilities": ["Responsibility 1", "Responsibility 2"]
    }
  ],
  "insights": [
    {
      "id": "unique-id",
      "title": "Title of insight",
      "description": "Detailed description",
      "severity": "low|medium|high",
      "category": "architecture|performance|security|maintainability"
    }
  ]
}`;

    console.log("Sending request to Claude API...");
    
    // Ensure the API key is properly formatted
    const formattedApiKey = apiKey.trim();
    console.log("API key format check:", formattedApiKey.substring(0, 10) + "...");
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': formattedApiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    console.log("Received response from Claude API", response.status);

    // Extract the content from Claude's response
    const content = response.data.content[0].text;
    
    // Find the JSON in the response (Claude might wrap it with explanation)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
    }
    
    const jsonContent = jsonMatch[0];
    const analysisResult = JSON.parse(jsonContent);
    
    // Add IDs to insights if not present
    if (analysisResult.insights) {
      analysisResult.insights = analysisResult.insights.map((insight: any, index: number) => ({
        ...insight,
        id: insight.id || `insight-${index + 1}`
      }));
    }
    
    return analysisResult;
  } catch (error: any) {
    console.error('Error analyzing code with Claude:', error.message);
    if (error.response) {
      console.error('Claude API response status:', error.response.status);
      console.error('Claude API response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Return a fallback result
    return {
      overview: "Analysis failed due to an error with Claude API.",
      components: [],
      insights: [
        {
          id: "error-1",
          title: "Analysis Error",
          description: "Failed to analyze code with Claude API. Please try again later.",
          severity: "high" as 'high',
          category: "error"
        }
      ]
    };
  }
}
