# GitHub OAuth Setup Instructions

## 1. Update Server Environment (.env file)

Replace the contents of `/server/.env` with the following, using your GitHub credentials:

```
# Server Configuration
PORT=3030
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/codeinsight

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=Ov23li8iXRzrnU6OV2Ya
GITHUB_CLIENT_SECRET=8a90bc07534609020fbe78187d47bf8d486912bd
GITHUB_CALLBACK_URL=http://localhost:3030/api/auth/github/callback

# Claude AI Configuration
CLAUDE_API_KEY=your_claude_api_key

# JWT Configuration
JWT_SECRET=use_a_secure_random_string_at_least_32_chars
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## 2. Update Client Environment

Update `/client/.env.development` with your GitHub client ID:

```
# API Configuration
REACT_APP_API_URL=http://localhost:3030/api

# GitHub OAuth Configuration
REACT_APP_GITHUB_CLIENT_ID=Ov23li8iXRzrnU6OV2Ya
```

Make sure to replace `your_claude_api_key` and `use_a_secure_random_string_at_least_32_chars` with the actual values from your Claude AI application and a secure random string respectively.
