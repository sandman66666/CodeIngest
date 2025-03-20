const axios = require('axios');

async function testAnthropicAuth() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  console.log(`Using API key: ${apiKey ? apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4) : 'not set'}`);
  
  try {
    // Test with x-api-key header
    console.log("\nTesting with x-api-key header:");
    await axios.post('https://api.anthropic.com/v1/messages', {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 10,
      messages: [
        { role: "user", content: "Hello" }
      ]
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    console.log("SUCCESS with x-api-key header");
  } catch (error) {
    console.error("ERROR with x-api-key header:", error.response?.status, error.response?.data);
  }
  
  try {
    // Test with Authorization header
    console.log("\nTesting with Authorization Bearer header:");
    await axios.post('https://api.anthropic.com/v1/messages', {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 10,
      messages: [
        { role: "user", content: "Hello" }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    console.log("SUCCESS with Authorization Bearer header");
  } catch (error) {
    console.error("ERROR with Authorization Bearer header:", error.response?.status, error.response?.data);
  }
}

testAnthropicAuth();
