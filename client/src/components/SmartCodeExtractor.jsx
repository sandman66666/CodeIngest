import React, { useState, useRef } from 'react';
import axios from 'axios';

const SmartCodeExtractor = ({ 
  repositoryId, 
  onCopy 
}) => {
  const [extractedCode, setExtractedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef(null);
  const copyButtonRef = useRef(null);

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

  // Helper function to copy selected text only
  const copySelectedText = () => {
    const selection = window.getSelection();
    if (selection.toString().trim() === '') {
      onCopy('', 'No text selected', false);
      return;
    }
    
    onCopy(selection.toString(), 'Selected extractor content');
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
          <div className="section-title">
            <h3>Extracted Code Patterns</h3>
            <button 
              ref={copyButtonRef}
              className="copy-button" 
              onClick={() => onCopy(extractedCode, 'Smart extractor content', copyButtonRef)}
              title="Copy to clipboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
          </div>
          <div className="content-container">
            <div 
              className="code-view" 
              ref={codeRef}
              onDoubleClick={() => window.getSelection().toString() !== '' && 
                onCopy(window.getSelection().toString(), 'Selected extractor code')}
            >
              <pre>{extractedCode}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartCodeExtractor;
