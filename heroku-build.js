const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Heroku build process...');
console.log('Current directory: ' + __dirname);
console.log('Directory contents: ' + fs.readdirSync(__dirname).join(', '));

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
  
  console.log('Client dist directory: ' + clientDistDir);
  console.log('Client dist contents: ' + (fs.existsSync(clientDistDir) ? fs.readdirSync(clientDistDir).join(', ') : 'Directory not found'));
  
  // Create public directory if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    console.log('Creating public directory: ' + publicDir);
    fs.mkdirSync(publicDir, { recursive: true });
  } else {
    console.log('Public directory exists: ' + publicDir);
    console.log('Public directory contents: ' + fs.readdirSync(publicDir).join(', '));
  }
  
  // Copy all files from client/dist to public
  console.log('Copying client build files to public directory...');
  copyDirectory(clientDistDir, publicDir);
  console.log('Client build files copied to public directory');
  console.log('Public directory contents after copy: ' + fs.readdirSync(publicDir).join(', '));
  
} catch (error) {
  console.error('Client build failed:', error);
  process.exit(1);
}

// We're using the simplified server (server-heroku.js) directly
console.log('Verifying server-heroku.js file...');
try {
  const serverFile = path.join(__dirname, 'server-heroku.js');
  if (fs.existsSync(serverFile)) {
    console.log('server-heroku.js file exists');
    
    // Create logs directory for the server
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      console.log('Creating logs directory: ' + logsDir);
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    console.log('Server setup completed successfully');
  } else {
    console.error('ERROR: server-heroku.js file not found!');
    process.exit(1);
  }
} catch (error) {
  console.error('Server verification failed:', error);
  process.exit(1);
}

console.log('Heroku build completed successfully');


// Helper function to recursively copy a directory
function copyDirectory(source, destination) {
  // Get all files and directories in the source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  // Create the destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  // Copy each entry
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively copy directories
      copyDirectory(srcPath, destPath);
    } else {
      // Copy files
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }
  }
}
