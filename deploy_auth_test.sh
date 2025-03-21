#!/bin/bash
# Deploy the authentication test script to Heroku

# Add and commit changes
git add anthropic_auth_test.js
git commit -m "Add Anthropic authentication test script"

# Push to Heroku
git push heroku anthropic-update:master

# Run the test script on Heroku
heroku run node anthropic_auth_test.js -a codanalyzer
