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
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  // Validate the format of the API key
  const key = apiKey.trim();
  
  // Check if key is in the right format for OpenAI (should start with 'sk-')
  if (!key.startsWith('sk-')) {
    console.warn('Warning: The provided API key does not start with "sk-". This may not be a valid OpenAI API key.');
  }
  
  return key;
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
  try {
    const formattedApiKey = validateApiKey(apiKey);
    console.log("API key format check:", formattedApiKey.substring(0, 7) + "...");
    
    // Get repository content and handle token limit
    const fullCode = repository.ingestedContent?.fullCode || 'No code available';
    
    // Limit code size to approximately 150K tokens (rough estimate)
    // Assuming ~4 chars per token on average
    const MAX_CHARS = 600000;
    const truncatedCode = fullCode.length > MAX_CHARS 
      ? fullCode.substring(0, MAX_CHARS) + `\n\n... [Content truncated: ${((fullCode.length - MAX_CHARS) / 1000).toFixed(0)}K characters removed due to token limit] ...\n`
      : fullCode;
    
    console.log(`Code size: Original ${(fullCode.length / 1000).toFixed(0)}K chars, Truncated to ${(truncatedCode.length / 1000).toFixed(0)}K chars`);
    
    // Create a detailed prompt for code analysis
    const prompt = `
    Please analyze the following code from repository ${repository.name} by ${repository.owner} and provide a detailed code review. 
    Focus on identifying potential bugs, security vulnerabilities, performance issues, architecture improvements, and best practices.
    
    Note: The code may be truncated due to token limits. Analyze what you can see and indicate if you believe important parts might be missing.
    
    Here is the code to analyze:
    \`\`\`
    ${truncatedCode}
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
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      
      // Provide more specific error messages based on the error type
      if (error.statusCode === 401) {
        throw new Error("Authentication error: Invalid OpenAI API key. Please provide a valid OpenAI API key that starts with 'sk-'");
      } else if (error.statusCode === 429) {
        throw new Error("Rate limit exceeded: Too many requests to the OpenAI API. Please try again later.");
      } else if (error.statusCode === 400 && error.data?.error?.code === 'context_length_exceeded') {
        throw new Error("Content too large: The repository code exceeds OpenAI's token limit even after truncation.");
      } else {
        throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
      }
    }
  } catch (error: any) {
    console.error("Error in API key validation:", error);
    throw new Error(`API key validation error: ${error.message}`);
  }
};
