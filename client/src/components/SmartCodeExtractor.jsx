import React, { useState } from 'react';
import axios from 'axios';

const SmartCodeExtractor = ({ repositoryId }) => {
  const [extractedCode, setExtractedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [apiKey, setApiKey] = useState('');

  const handleExtract = async () => {
    if (!apiKey) {
      setError('Claude API key is required for extraction');
      setShowApiKeyInput(true);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`/api/extract/${repositoryId}`, { 
        apiKey
      });
      
      setExtractedCode(response.data.extractedCode);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extract code elements');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="code-extractor">
      <h2>Smart Code Extractor</h2>
      <p>
        Extract the core algorithms and key elements from the code based on the assumption 
        that the code will be used as reference with an AI bot. This provides just enough 
        for AI to understand the logic and the app.
      </p>
      
      {error && <div className="alert alert-error">{error}</div>}
      
      <div className="api-key-input">
        <label htmlFor="claude-api-key">Claude API Key</label>
        <input
          id="claude-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-api..."
          className="input-field"
        />
        <div className="input-help" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
          Your API key is used only for this request and is not stored on the server.
        </div>
      </div>
      
      <button 
        onClick={handleExtract} 
        disabled={loading}
        className="button button-primary"
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            <span>Extracting...</span>
          </>
        ) : 'Extract Key Code Elements'}
      </button>
      
      {extractedCode && (
        <div className="extracted-code">
          <h3>Extracted Core Code</h3>
          <div className="code-view">
            <pre>{extractedCode}</pre>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(extractedCode);
              alert('Code copied to clipboard!');
            }}
            className="button button-outline copy-button"
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartCodeExtractor;
