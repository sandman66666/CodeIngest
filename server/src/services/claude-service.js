// Service for integrating with Claude AI
const axios = require('axios');

/**
 * Analyze code with Claude AI
 * @param {string} code - The code to analyze
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Array>} - Analysis results
 */
async function analyzeCodeWithClaude(code, apiKey) {
  try {
    // Make request to Anthropic using axios directly
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-sonnet-20240229', // Using Claude 3 Sonnet
      messages: [
        {
          role: 'user',
          content: `Analyze the following code and provide insightful feedback,
suggestions for improvements, and identify potential bugs or vulnerabilities.
Focus on the most important aspects of the code. Your response should be structured in JSON format with the following fields:
[
  {
    "id": "unique-insight-id",
    "title": "Concise insight title",
    "description": "Detailed explanation of the insight",
    "severity": "high|medium|low",
    "category": "bug|security|performance|best_practice|code_quality"
  }
]

The code to analyze is:

${code}`
        }
      ],
      max_tokens: 4000,
      temperature: 0.7,
      system: "You are a code analysis assistant. Respond only with JSON."
    }, {
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey.trim(),
        'Content-Type': 'application/json'
      }
    });

    // Parse the response and extract results
    const content = response.data.content[0].text;
    const results = JSON.parse(content);
    
    return results;
  } catch (error) {
    console.error('Error analyzing code with Claude:', error);
    
    let errorMessage = 'Failed to analyze code with Claude';
    
    if (error.response && error.response.status === 401) {
      errorMessage = 'Invalid Anthropic API key. Please provide a valid key.';
    } else if (error.response && error.response.status === 429) {
      errorMessage = 'Anthropic API rate limit exceeded';
    } else if (error.message.includes('content size too large')) {
      errorMessage = 'Code content too large for analysis';
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Extract core algorithms and key elements from code
 * @param {string} code - The code to extract from
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<string>} - Extracted code
 */
async function extractCodeElements(code, apiKey) {
  try {
    // Make request to Anthropic using axios directly
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-sonnet-20240229', // Using Claude 3 Sonnet
      messages: [
        {
          role: 'user',
          content: `Extract the code of the core algorithms and key elements from the provided code.
Focus on the most important parts that represent the core functionality, assuming this code will be used as a reference with an AI bot.
Provide just enough code for AI to understand the logic and structure of the application.

Here's the code to analyze:

${code}`
        }
      ],
      max_tokens: 4000,
      temperature: 0.3,
      system: "You are a code extraction assistant. Extract and return only the most important code that represents the core functionality."
    }, {
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey.trim(),
        'Content-Type': 'application/json'
      }
    });

    // Parse the response
    const content = response.data.content[0].text;
    
    return content;
  } catch (error) {
    console.error('Error extracting code elements with Claude:', error);
    
    let errorMessage = 'Failed to extract code elements with Claude';
    
    if (error.response && error.response.status === 401) {
      errorMessage = 'Invalid Anthropic API key. Please provide a valid key.';
    } else if (error.response && error.response.status === 429) {
      errorMessage = 'Anthropic API rate limit exceeded';
    } else if (error.message.includes('content size too large')) {
      errorMessage = 'Code content too large for extraction';
    }
    
    throw new Error(errorMessage);
  }
}

module.exports = {
  analyzeCodeWithClaude,
  extractCodeElements
};
