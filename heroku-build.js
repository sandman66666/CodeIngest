const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Build the client
console.log('Building client...');
execSync('cd client && npm run build', { stdio: 'inherit' });

// Create a minimal server build that bypasses TypeScript errors
console.log('Creating simplified server build...');

// Ensure the server/dist directory exists
const serverDistDir = path.join(__dirname, 'server', 'dist');
if (!fs.existsSync(serverDistDir)) {
  fs.mkdirSync(serverDistDir, { recursive: true });
}

// Copy the index-simple.ts file to a JavaScript version
const simpleIndexContent = fs.readFileSync(
  path.join(__dirname, 'server', 'src', 'index-simple.ts'),
  'utf8'
);

// Convert TypeScript to JavaScript (very basic conversion)
let jsContent = simpleIndexContent
  .replace(/import\s+{([^}]*)}\s+from\s+['"]([^'"]*)['"]/g, 'const {$1} = require("$2")')
  .replace(/import\s+(\w+)\s+from\s+['"]([^'"]*)['"]/g, 'const $1 = require("$2")')
  .replace(/export\s+/g, '')
  .replace(/:\s*[A-Za-z<>[\]]+/g, '') // Remove type annotations
  .replace(/<[A-Za-z<>[\],\s]+>/g, ''); // Remove generic type parameters

// Write the JavaScript file
fs.writeFileSync(
  path.join(serverDistDir, 'index-simple.js'),
  jsContent
);

// Copy any other needed files
const serviceFiles = [
  'openai-service.ts',
  'in-memory-store.ts',
  'code-ingestion.ts',
];

serviceFiles.forEach(file => {
  const content = fs.readFileSync(
    path.join(__dirname, 'server', 'src', 'services', file),
    'utf8'
  );
  
  // Convert TypeScript to JavaScript (very basic conversion)
  let jsContent = content
    .replace(/import\s+{([^}]*)}\s+from\s+['"]([^'"]*)['"]/g, 'const {$1} = require("$2")')
    .replace(/import\s+(\w+)\s+from\s+['"]([^'"]*)['"]/g, 'const $1 = require("$2")')
    .replace(/export\s+/g, 'module.exports.')
    .replace(/:\s*[A-Za-z<>[\]]+/g, '') // Remove type annotations
    .replace(/<[A-Za-z<>[\],\s]+>/g, ''); // Remove generic type parameters
  
  fs.writeFileSync(
    path.join(serverDistDir, file.replace('.ts', '.js')),
    jsContent
  );
});

console.log('Build completed for Heroku deployment');
