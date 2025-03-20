const { Client } = require('@anthropic-ai/sdk');

async function testAnthropicClient() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log(`Using API key: ${apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'not set'}`);
    
    const client = new Client({
      apiKey: apiKey,
    });
    
    console.log("Created Anthropic client, attempting to send a message...");
    
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 100,
      messages: [
        { role: "user", content: "Hello, how are you?" }
      ]
    });
    
    console.log("Success! Response:", response.content[0].text.substring(0, 100) + "...");
  } catch (error) {
    console.error("Error testing Anthropic client:", error.message);
    if (error.response) {
      console.error("Status:", error.status);
      console.error("Data:", error.error);
    }
  }
}

testAnthropicClient();
