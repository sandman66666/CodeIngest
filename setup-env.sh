#!/bin/bash

# Create server .env file with placeholder values
cat > ./server/.env << EOL
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/codeinsight
REDIS_URL=redis://localhost:6379

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=placeholder_github_id
GITHUB_CLIENT_SECRET=placeholder_github_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Claude AI Configuration
ANTHROPIC_API_KEY=placeholder_anthropic_key
CLAUDE_API_KEY=placeholder_claude_key

# JWT Configuration
JWT_SECRET=temporary_dev_jwt_secret_at_least_32_chars_long
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOL

# Create client .env file
cat > ./client/.env.development << EOL
# API Configuration
REACT_APP_API_URL=http://localhost:3000/api

# GitHub OAuth Configuration
REACT_APP_GITHUB_CLIENT_ID=placeholder_github_id
EOL

echo "Environment files created with placeholder values"
echo "Please update with your actual credentials before running in production"
