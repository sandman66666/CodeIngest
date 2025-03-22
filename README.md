# CodeIngest - GitHub Code Ingestion App

CodeIngest is a web application that ingests public GitHub repositories, extracts their code, and provides tools for code analysis. It includes a smart code extractor powered by Claude AI that identifies core algorithms and key elements from the repository code.

## Features

- Ingest public GitHub repositories
- Focus on business logic and platform code files by default
- Option to include all files in the repository
- View repository structure in three tabs:
  - Folder Structure
  - Core Code
  - README
- Smart Code Extractor powered by Claude AI to extract key elements
- Modern UI with responsive design

## Project Structure

This project is set up as a monorepo with three workspaces:

1. `client` - Frontend React application (Vite) running on port 3001
2. `server` - Backend Node.js/Express application running on port 3000
3. `common` - Shared code and utilities

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- npm (v8+)

### Installation

1. Clone the repository
2. Install dependencies for all workspaces:

```bash
npm run install:all
```

### Running the Application

You can run the application in different modes:

- Start both client and server concurrently:
```bash
npm run dev
```

- Start only the frontend:
```bash
npm run client
```

- Start only the backend:
```bash
npm run server
```

## Using the Application

1. Open your browser and go to `http://localhost:3001`
2. Enter a public GitHub repository URL in the form
3. Choose whether to include all files or just business logic and platform code
4. Click "Ingest Repository" to start the ingestion process
5. Once ingestion is complete, you can view the repository's structure, code, and README
6. Use the Smart Code Extractor (requires a Claude API key) to extract key elements from the code

## Smart Code Extractor

The Smart Code Extractor uses Claude AI to analyze the repository code and extract the core algorithms and key elements. This feature requires an Anthropic API key which you can get from [Anthropic](https://www.anthropic.com/).

## Technologies Used

- **Frontend**: React, Vite, Axios
- **Backend**: Node.js, Express
- **APIs**: GitHub API, Claude API (Anthropic)

## Environment Status

- Environment: development
- GitHub OAuth: Not configured
- Claude API: Not configured
