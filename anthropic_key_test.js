// This is a simple test file to validate Anthropic API key authentication
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
require('dotenv').config();

// Get the API key from environment
const apiKey = process.env.ANTHROPIC_API_KEY || '';

if (!apiKey) {
  console.error('No Anthropic API key found in environment variables');
  process.exit(1);
}

// Mask the API key for logging
const maskedKey = apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4);
console.log(`Using API key: ${maskedKey}`);

async function testSDK() {
  console.log('Testing Anthropic SDK...');
  try {
    // Test with SDK
    const anthropic = new Anthropic({
      apiKey: apiKey.trim(),
    });
    
    console.log('SDK initialized successfully');
    console.log('Sending a simple message request...');
    
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 300,
      messages: [
        { role: "user", content: "Hello, world!" }
      ]
    });
    
    console.log('SDK Response received:');
    console.log(JSON.stringify(response, null, 2).substring(0, 500) + '...');
    return true;
  } catch (error) {
    console.error('SDK Test Error:', error.message);
    console.error('SDK Test Error Details:', error.response?.data || error);
    return false;
  }
}

async function testDirectAPI() {
  console.log('\nTesting Direct API with axios...');
  try {
    // Test with direct API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 300,
        messages: [
          { role: "user", content: "Hello, world!" }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey.trim()
        }
      }
    );
    
    console.log('Direct API Response received:');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    return true;
  } catch (error) {
    console.error('Direct API Test Error:', error.message);
    console.error('Direct API Test Error Details:', error.response?.data || error);
    return false;
  }
}

async function testAuthorizationHeader() {
  console.log('\nTesting Direct API with Authorization header...');
  try {
    // Test with Authorization header
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 300,
        messages: [
          { role: "user", content: "Hello, world!" }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'Authorization': `Bearer ${apiKey.trim()}`
        }
      }
    );
    
    console.log('Authorization Header Response received:');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    return true;
  } catch (error) {
    console.error('Authorization Header Test Error:', error.message);
    console.error('Authorization Header Test Error Details:', error.response?.data || error);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('Starting tests...');
  
  // Test SDK
  const sdkSuccess = await testSDK();
  
  // Test Direct API with x-api-key
  const directSuccess = await testDirectAPI();
  
  // Test Direct API with Authorization header
  const authHeaderSuccess = await testAuthorizationHeader();
  
  console.log('\n===== RESULTS =====');
  console.log(`SDK Test: ${sdkSuccess ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Direct API Test: ${directSuccess ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Authorization Header Test: ${authHeaderSuccess ? 'SUCCESS' : 'FAILED'}`);
}

// Run tests
runTests().catch(err => {
  console.error('Test execution error:', err);
});
