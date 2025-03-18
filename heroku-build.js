const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Heroku build process...');

// Build the client (frontend)
console.log('Building client...');
try {
  // First install client dependencies
  console.log('Installing client dependencies...');
  execSync('cd client && npm install', { stdio: 'inherit' });
  
  // Then build the client
  console.log('Building client application...');
  execSync('cd client && npm run build', { stdio: 'inherit' });
  console.log('Client build completed successfully');
  
  // Copy the client build to the root directory for serving
  const clientDistDir = path.join(__dirname, 'client', 'dist');
  const publicDir = path.join(__dirname, 'public');
  
  // Create public directory if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Copy all files from client/dist to public
  copyDirectory(clientDistDir, publicDir);
  console.log('Client build files copied to public directory');
  
} catch (error) {
  console.error('Client build failed:', error);
  process.exit(1);
}

console.log('Heroku build completed successfully');

// Helper function to recursively copy a directory
function copyDirectory(source, destination) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Get all files and subdirectories in the source directory
  if (fs.existsSync(source)) {
    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectories
        copyDirectory(sourcePath, destinationPath);
      } else {
        // Copy files
        fs.copyFileSync(sourcePath, destinationPath);
      }
    }
  } else {
    console.warn(`Source directory ${source} does not exist`);
  }
}
