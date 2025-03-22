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
        Extract the most important and reusable code patterns from this repository. 
        This provides actual code snippets that can be directly used as a reference for AI 
        to build similar functionality, including data structures, key functions, 
        algorithms, and interfaces.
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
        ) : 'Extract Reusable Code Patterns'}
      </button>
      
      {extractedCode && (
        <div className="extracted-code">
          <h3>Extracted Code Patterns</h3>
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
