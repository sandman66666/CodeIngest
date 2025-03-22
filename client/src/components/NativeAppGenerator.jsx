import React, { useState, useEffect } from 'react';
import axios from 'axios';

const NativeAppGenerator = ({ repositoryId, hasGeneratedApp, swiftCode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState(swiftCode || '');
  const [status, setStatus] = useState(hasGeneratedApp ? 'completed' : 'not_started');
  const [polling, setPolling] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Check status if already in progress
  useEffect(() => {
    if (status === 'pending') {
      setPolling(true);
    }
  }, [status]);

  // Poll for status updates
  useEffect(() => {
    let intervalId;
    
    if (polling) {
      checkStatus();
      
      // Check status every 5 seconds
      intervalId = setInterval(checkStatus, 5000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [polling, repositoryId]);

  const checkStatus = async () => {
    try {
      const response = await axios.get(`/api/generate-native-app/${repositoryId}/status`);
      const { status, swiftCode, error: statusError } = response.data;
      
      setStatus(status);
      
      if (status === 'completed' && swiftCode) {
        setGeneratedCode(swiftCode);
        setPolling(false);
      } else if (status === 'error') {
        setError(statusError || 'Failed to generate Swift code');
        setPolling(false);
        setLoading(false);
      } else if (status !== 'pending') {
        setPolling(false);
      }
    } catch (err) {
      console.error('Error checking status:', err);
      // Don't stop polling on a single error
    }
  };

  const handleGenerateApp = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`/api/generate-native-app/${repositoryId}`);
      setStatus('pending');
      setPolling(true);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to start native app generation';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleDownloadProject = async () => {
    try {
      setDownloading(true);
      
      // Use window.location to trigger a file download
      window.location.href = `/api/generate-native-app/${repositoryId}/download`;
      
      // Reset downloading state after 3 seconds (enough time for download to start)
      setTimeout(() => {
        setDownloading(false);
      }, 3000);
    } catch (err) {
      console.error('Error downloading project:', err);
      setError('Failed to download Xcode project');
      setDownloading(false);
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
      
      {status === 'not_started' && (
        <button 
          onClick={handleGenerateApp} 
          disabled={loading}
          className="button button-primary"
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              <span>Starting Generation...</span>
            </>
          ) : 'Build Native iPhone App'}
        </button>
      )}
      
      {status === 'pending' && (
        <div className="generation-status">
          <div className="spinner"></div>
          <p>Generating iOS app code... This may take a few minutes.</p>
          <p className="hint">The page will automatically update when complete.</p>
        </div>
      )}
      
      {generatedCode && status === 'completed' && (
        <div className="generated-code">
          <h3>Generated Swift Code</h3>
          <div className="code-view">
            <pre>{generatedCode}</pre>
          </div>
          
          <div className="button-group">
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedCode);
                alert('Swift code copied to clipboard!');
              }}
              className="button button-outline copy-button"
            >
              Copy to Clipboard
            </button>
            
            <button
              onClick={handleDownloadProject}
              disabled={downloading}
              className="button button-primary download-button"
            >
              {downloading ? (
                <>
                  <span className="spinner"></span>
                  <span>Preparing Download...</span>
                </>
              ) : 'Download Xcode Project'}
            </button>
          </div>
          
          <div className="xcode-instructions">
            <h4>Opening in Xcode</h4>
            <ol>
              <li>Download and extract the zip file</li>
              <li>Launch Xcode</li>
              <li>Select "Open a project or file"</li>
              <li>Navigate to the extracted folder</li>
              <li>Open the .xcodeproj file</li>
              <li>Build and run the app!</li>
            </ol>
            <p className="note">
              Note: You may need to update the Bundle Identifier and set up your development team before building.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NativeAppGenerator;
