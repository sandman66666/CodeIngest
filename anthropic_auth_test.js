// Test file to validate Anthropic authentication

const Anthropic = require('@anthropic-ai/sdk');

// Create a simple test to check authentication
async function testAnthropicAuth() {
  try {
    console.log('Starting Anthropic authentication test');
    
    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('No ANTHROPIC_API_KEY found in environment variables');
      return;
    }
    
    console.log(`API key format check: starts with sk-ant-: ${apiKey.startsWith('sk-ant-')}`);
    
    // Create Anthropic client with detailed logging
    console.log('Creating Anthropic client');
    const anthropic = new Anthropic({
      apiKey: apiKey.trim(),
    });
    
    console.log('Anthropic client created successfully');
    console.log('Client configuration:', anthropic);
    
    // Use a simple message test
    console.log('Sending test message request');
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Say hello' 
        }
      ]
    });
    
    console.log('Message response received:', message);
    console.log('Authentication test successful!');
  } catch (error) {
    console.error('Authentication test failed with error:', error);
    
    // Additional error details
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAnthropicAuth();
