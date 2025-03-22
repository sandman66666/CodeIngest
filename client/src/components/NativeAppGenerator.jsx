import React, { useState } from 'react';
import axios from 'axios';

const NativeAppGenerator = ({ repositoryId, hasGeneratedApp, swiftCode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState(swiftCode || '');

  const handleGenerateApp = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`/api/generate-native-app/${repositoryId}`);
      setGeneratedCode(response.data.repository.nativeApp.swiftCode);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to generate native app code';
      setError(errorMessage);
      console.error('Error details:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="native-app-generator">
      <h2>Native iOS App Generator</h2>
      <p>
        Convert this web application to a native iOS app using Swift and SwiftUI.
        The generator uses AI to analyze the web app code and create equivalent
        Swift code that implements the same functionality.
      </p>
      
      {error && <div className="alert alert-error">{error}</div>}
      
      {!hasGeneratedApp && !generatedCode && (
        <button 
          onClick={handleGenerateApp} 
          disabled={loading}
          className="button button-primary"
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              <span>Generating iOS App...</span>
            </>
          ) : 'Build Native iPhone App'}
        </button>
      )}
      
      {generatedCode && (
        <div className="generated-code">
          <h3>Generated Swift Code</h3>
          <div className="code-view">
            <pre>{generatedCode}</pre>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(generatedCode);
              alert('Swift code copied to clipboard!');
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

export default NativeAppGenerator;
