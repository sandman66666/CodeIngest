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
  
  // Copy the client build to the public directory for serving
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

// Build the server (backend)
console.log('Building server...');
try {
  // First install server dependencies
  console.log('Installing server dependencies...');
  execSync('cd server && npm install', { stdio: 'inherit' });
  
  // Then build the server using the simplified configuration
  console.log('Building server application with simplified configuration...');
  execSync('cd server && npm run build-simple', { stdio: 'inherit' });
  
  // Verify that the build output exists
  const indexSimplePath = path.join(__dirname, 'server', 'dist', 'index-simple.js');
  if (fs.existsSync(indexSimplePath)) {
    console.log(`Successfully built index-simple.js at: ${indexSimplePath}`);
    // Show the directory contents for debugging
    console.log('Contents of the dist directory:');
    const distDir = path.join(__dirname, 'server', 'dist');
    const files = fs.readdirSync(distDir);
    files.forEach(file => {
      console.log(`- ${file}`);
    });
  } else {
    console.error('ERROR: index-simple.js was not generated at the expected path!');
    process.exit(1);
  }
  
  console.log('Server build completed successfully');
  
} catch (error) {
  console.error('Server build failed:', error);
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
