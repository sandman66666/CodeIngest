# CodeInsight

CodeInsight is a web application that enhances code understanding by leveraging AI to analyze GitHub repositories. It provides intelligent code analysis, vulnerability scanning, and interactive visualizations.

## Features

- GitHub repository analysis with AI-powered insights
- Security vulnerability scanning
- Interactive code visualization dashboard
- User management with GitHub authentication
- Shareable analysis reports

## Tech Stack

- Frontend: React + TypeScript
- Backend: Node.js + TypeScript
- Database: MongoDB + Redis
- AI: Claude API
- Authentication: GitHub OAuth

## Project Structure

```
codeinsight/
├── client/      # React frontend
├── server/      # Node.js backend
├── common/      # Shared code
└── docker/      # Docker configuration
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create .env files in client/ and server/ directories
cp client/.env.example client/.env
cp server/.env.example server/.env
```

3. Start development servers:
```bash
npm run dev
```

## Development Guidelines

- Follow TypeScript best practices and maintain strict type safety
- Write unit tests for all new components
- Document API endpoints and component interfaces
- Handle errors gracefully with proper error boundaries
- Follow security best practices for API keys and authentication
- Keep components modular and reusable

## Security

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Implement proper input validation
- Follow OAuth security best practices
- Regular security audits with vulnerability scanning

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## License

MIT
