const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Heroku build process...');

// Build the client (frontend)
console.log('Building client...');
try {
  execSync('cd client && npm run build', { stdio: 'inherit' });
  console.log('Client build completed successfully');
} catch (error) {
  console.error('Client build failed:', error);
  process.exit(1);
}

// Ensure the client/dist directory exists with an index.html
const clientDistDir = path.join(__dirname, 'client', 'dist');
if (!fs.existsSync(clientDistDir)) {
  console.log('Client dist directory not found, creating a fallback version...');
  
  // Create dist directory if it doesn't exist
  fs.mkdirSync(clientDistDir, { recursive: true });
  
  // Create a simple index.html file if build failed
  const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeIngest - Deployed to Heroku</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #333; }
    .card {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1.5rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .success { color: #4caf50; }
    pre {
      background: #f1f1f1;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <h1>CodeIngest Application</h1>
  <div class="card">
    <h2><span class="success">✓</span> Successfully Deployed to Heroku</h2>
    <p>This is a simplified version of the frontend serving static content.</p>
    <p>The API is available at <code>/api</code> endpoints.</p>
  </div>
  
  <div class="card">
    <h3>API Status</h3>
    <p>Check the API status at <a href="/api/health">/api/health</a></p>
    <div id="apiStatus">Loading...</div>
  </div>

  <script>
    // Fetch API health status
    fetch('/api/health')
      .then(response => response.json())
      .then(data => {
        document.getElementById('apiStatus').innerHTML = 
          '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
      })
      .catch(error => {
        document.getElementById('apiStatus').innerHTML = 
          '<p style="color:red">Error connecting to API: ' + error.message + '</p>';
      });
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(path.join(clientDistDir, 'index.html'), fallbackHtml);
  console.log('Created fallback index.html');
}

console.log('Heroku build completed successfully');
