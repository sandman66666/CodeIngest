import React, { useState } from 'react';
import axios from 'axios';

const SmartCodeExtractor = ({ repositoryId }) => {
  const [extractedCode, setExtractedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`/api/extract/${repositoryId}`);
      setExtractedCode(response.data.extractedCode);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extract code elements');
      console.error('Details:', err.response?.data?.details);
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
