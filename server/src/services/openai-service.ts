import axios from 'axios';

interface OpenAIAnalysisResult {
  insights: Array<{
    title: string;
    description: string;
    severity: string;
    category: string;
  }>;
}

interface Repository {
  name: string;
  owner: string;
  ingestedContent?: {
    summary?: string;
    tree?: string;
    fullCode?: string;
    fileCount?: number;
    sizeInBytes?: number;
  };
}

/**
 * Analyzes code with OpenAI and returns insights
 * @param apiKey OpenAI API key
 * @param repository Repository object containing name, owner, and ingested content
 * @returns Analysis results
 */
export async function analyzeCodeWithOpenAI(
  apiKey: string,
  repository: Repository
): Promise<OpenAIAnalysisResult> {
  console.log("Sending request to OpenAI API...");
  
  // Ensure the API key is properly formatted
  const formattedApiKey = apiKey.trim();
  console.log("API key format check:", formattedApiKey.substring(0, 10) + "...");
  
  // Format the code to be analyzed
  const repoName = repository.name;
  const repoOwner = repository.owner;
  const codeContent = repository.ingestedContent?.fullCode || '';

  // Create a more detailed prompt for OpenAI
  const prompt = `You are an expert software engineer conducting a thorough code review of a repository.

Repository: ${repoOwner}/${repoName}

Here is the code to analyze:
\`\`\`
${codeContent}
\`\`\`

Perform a comprehensive code review and provide detailed analysis including:
1. Potential bugs and logic errors with specific line references
2. Security vulnerabilities or practices that could lead to security issues
3. Performance bottlenecks and optimization opportunities
4. Architecture and design pattern recommendations
5. Code maintainability issues and refactoring suggestions
6. Best practices violations
7. Readability and documentation improvements

For each issue found:
- Provide a clear title that summarizes the issue
- Give a detailed description explaining the problem and why it matters
- Suggest specific solutions or improvements
- Assign a severity level (high, medium, low) based on its impact
- Categorize the issue as: bug, security, performance, architecture, code_quality, or best_practice

Format your response as a JSON object with the following structure:
{
  "insights": [
    {
      "title": "Issue title",
      "description": "Detailed description with line references and improvement suggestions",
      "severity": "high|medium|low",
      "category": "bug|security|performance|architecture|code_quality|best_practice"
    }
  ]
}

Identify at least 6-8 substantive issues to provide a thorough review. Focus on the most important issues that would have the biggest impact if addressed.`;

  try {
    // Make request to OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "o3-mini-high",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${formattedApiKey}`
        }
      }
    );
    
    console.log("OpenAI API response status:", response.status);
    
    if (response.status === 200) {
      const content = response.data.choices[0].message.content;
      
      try {
        // Extract the JSON part from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonContent = jsonMatch ? jsonMatch[0] : content;
        const parsed = JSON.parse(jsonContent);
        
        // Validate the structure
        if (!parsed.insights || !Array.isArray(parsed.insights)) {
          throw new Error("Invalid response format from OpenAI");
        }
        
        return parsed;
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError);
        console.error("Failed to parse content:", content);
        throw new Error("Failed to parse OpenAI response");
      }
    } else {
      throw new Error(`OpenAI API returned status ${response.status}`);
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    
    if (axios.isAxiosError(error) && error.response) {
      console.error("OpenAI API response status:", error.response.status);
      console.error("OpenAI API response data:", JSON.stringify(error.response.data, null, 2));
      console.error("OpenAI API response headers:", JSON.stringify(error.response.headers, null, 2));
    }
    
    throw error;
  }
}
