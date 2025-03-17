import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Redefine Repository interface since the types import is not working
interface Repository {
  id: string;
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

const validateApiKey = (apiKey: string): string => {
  return apiKey.trim();
};

/**
 * Analyzes code with OpenAI and returns insights
 * @param apiKey OpenAI API key
 * @param repository Repository object containing code to analyze
 * @returns Analysis results
 */
export const analyzeCodeWithOpenAI = async (
  apiKey: string,
  repository: Repository
): Promise<{ insights: Array<{ title: string; description: string; severity: string; category: string }> }> => {
  // Validate the API key format
  const formattedApiKey = validateApiKey(apiKey);

  console.log("API key format check:", formattedApiKey.substring(0, 8) + "...");
  
  // Create a detailed prompt for code analysis
  const prompt = `
  Please analyze the following code from repository ${repository.name} by ${repository.owner} and provide a detailed code review. 
  Focus on identifying potential bugs, security vulnerabilities, performance issues, architecture improvements, and best practices.
  
  Here is the code to analyze:
  \`\`\`
  ${repository.ingestedContent?.fullCode || 'No code available'}
  \`\`\`
  `;
  
  try {
    // Set the API key for the OpenAI client
    process.env.OPENAI_API_KEY = formattedApiKey;
    
    console.log("Sending request to OpenAI API with model: o3-mini");
    
    // Define the schema for the structured output
    const schema = z.object({
      insights: z.array(
        z.object({
          title: z.string().describe("Brief title of the issue"),
          description: z.string().describe("Detailed explanation of the issue"),
          severity: z.enum(["low", "medium", "high"]).describe("The severity level of the issue"),
          category: z.enum([
            "bug", 
            "security", 
            "performance", 
            "architecture", 
            "best_practice", 
            "code_quality"
          ]).describe("The category of the issue")
        })
      )
    });

    // Generate structured analysis using o3-mini model
    const { object } = await generateObject({
      model: openai('o3-mini'),
      schema,
      prompt,
      system: "You are a code analysis assistant specialized in finding bugs, security issues, and suggesting improvements. Always provide at least 4-6 substantive insights for any code you review.",
      providerOptions: {
        openai: { reasoningEffort: 'high' },
      },
    });
    
    console.log("OpenAI API response received successfully");
    
    return object;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
};
