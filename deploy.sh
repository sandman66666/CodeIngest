#!/bin/bash
# Force git to see the changes and deploy to Heroku

# Make a copy of the modified file with a new name
cp server-heroku.js server-heroku.js.bak

# Modify the original file to force git to see a change
echo "// Modified for Heroku deployment $(date)" >> server-heroku.js

# Add and commit changes
git add server-heroku.js
git commit -m "Fix Anthropic API response parsing"

# Deploy to Heroku
git push heroku anthropic-update:master -f

# Restore the backup
mv server-heroku.js.bak server-heroku.js
