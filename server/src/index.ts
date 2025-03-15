import app from './app';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('GitHub OAuth:', process.env.GITHUB_CLIENT_ID ? 'Configured' : 'Not configured');
  console.log('Claude API:', process.env.CLAUDE_API_KEY ? 'Configured' : 'Not configured');
});
