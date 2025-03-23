import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SmartCodeExtractor from './SmartCodeExtractor';
import NativeAppGenerator from './NativeAppGenerator';
import SelectableTreeView from './SelectableTreeView';

import './RepositoryModal.css';

const RepositoryModal = ({ repository, onClose }) => {
  const [activeTab, setActiveTab] = useState('structure');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullRepo, setFullRepo] = useState(null);
  const [loadingAdditionalFiles, setLoadingAdditionalFiles] = useState(false);
  // State for selected files (currently just visual, no functionality)
  const [selectedFiles, setSelectedFiles] = useState([]);
  // State for copy feedback
  const [copyFeedback, setCopyFeedback] = useState({ visible: false, message: '', success: true });
  // Refs for content elements
  const structureRef = useRef(null);
  const codeRef = useRef(null);
  const readmeRef = useRef(null);
  
  // Store copy button refs to animate them
  const copyButtonRefs = {
    structure: useRef(null),
    code: useRef(null),
    readme: useRef(null)
  };
  
  // Helper function to copy text to clipboard
  const copyToClipboard = (text, sourceName, buttonRef) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopyFeedback({ visible: true, message: `${sourceName} copied to clipboard!`, success: true });
        setTimeout(() => setCopyFeedback({ visible: false, message: '', success: true }), 2000);
        
        // Animate the button on successful copy
        if (buttonRef && buttonRef.current) {
          buttonRef.current.classList.add('copy-success');
          setTimeout(() => {
            if (buttonRef.current) {
              buttonRef.current.classList.remove('copy-success');
            }
          }, 1000);
        }
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        setCopyFeedback({ visible: true, message: 'Failed to copy text', success: false });
        setTimeout(() => setCopyFeedback({ visible: false, message: '', success: true }), 2000);
      });
  };

  // Helper function to get file content for selected files
  const getFilteredFiles = () => {
    if (!fullRepo?.files) {
      return [];
    }
    
    // If no files are selected, show all files
    if (!selectedFiles.length) {
      return fullRepo.files;
    }
    
    // Filter the files array to include only selected files
    return fullRepo.files.filter(file => selectedFiles.includes(file.path));
  };

  // Initialize all files as selected
  useEffect(() => {
    if (fullRepo?.files) {
      const allFilePaths = fullRepo.files.map(file => file.path);
      setSelectedFiles(allFilePaths);
    }
  }, [fullRepo?.files]);

  useEffect(() => {
    // If we don't have the full repository data, fetch it
    if (!repository.files) {
      fetchFullRepository();
    } else {
      setFullRepo(repository);
    }
  }, [repository]);

  const fetchFullRepository = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/repositories/${repository.id}`);
      setFullRepo(response.data.repository);
    } catch (error) {
      setError('Failed to load repository details');
      console.error('Error fetching repository:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAdditionalFiles = async () => {
    if (fullRepo?.includesAllFiles) {
      return; // Already have all files
    }

    setLoadingAdditionalFiles(true);
    setError('');

    try {
      const response = await axios.post(`/api/repositories/${repository.id}/additional-files`);
      
      if (response.data.success) {
        // Refetch the repository to get updated content
        await fetchFullRepository();
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to load additional files');
    } finally {
      setLoadingAdditionalFiles(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h2 className="modal-title">Loading Repository...</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto 1rem' }}></div>
            <p>Loading repository data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!fullRepo) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h2 className="modal-title">Error</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="alert alert-error">
              {error || 'Failed to load repository data'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{fullRepo.owner}/{fullRepo.name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'structure' ? 'active' : ''}`}
            onClick={() => setActiveTab('structure')}
          >
            Folder Structure
          </div>
          <div 
            className={`tab ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            Core Code
          </div>
          <div 
            className={`tab ${activeTab === 'readme' ? 'active' : ''}`}
            onClick={() => setActiveTab('readme')}
          >
            README
          </div>
          <div 
            className={`tab ${activeTab === 'extractor' ? 'active' : ''}`}
            onClick={() => setActiveTab('extractor')}
          >
            Smart Extractor
          </div>
          <div 
            className={`tab ${activeTab === 'native-app' ? 'active' : ''}`}
            onClick={() => setActiveTab('native-app')}
          >
            iOS App
          </div>
        </div>
        
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          
          {copyFeedback.visible && (
            <div className={`alert ${copyFeedback.success ? 'alert-success' : 'alert-error'}`} 
                 style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
              {copyFeedback.message}
            </div>
          )}
          
          {!fullRepo.includesAllFiles && (
            <div className="alert alert-info">
              <p>
                Currently viewing only business logic and platform code files. 
                <button 
                  className="button button-outline" 
                  style={{ marginLeft: '0.5rem' }}
                  onClick={handleLoadAdditionalFiles}
                  disabled={loadingAdditionalFiles}
                >
                  {loadingAdditionalFiles ? (
                    <>
                      <span className="spinner"></span>
                      <span>Loading...</span>
                    </>
                  ) : 'Load all files'}
                </button>
              </p>
            </div>
          )}
          
          <div className={`tab-content ${activeTab === 'structure' ? 'active' : ''}`}>
            <div className="section-title">
              <h3>Folder Structure</h3>
              <button 
                ref={copyButtonRefs.structure}
                className="copy-button" 
                onClick={() => copyToClipboard(
                  fullRepo.fileTree || 'No folder structure available', 
                  'Folder structure',
                  copyButtonRefs.structure
                )}
                title="Copy to clipboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
            <div className="content-container">
              <div className="tree-view" ref={structureRef}>
                {fullRepo.fileTree || 'No folder structure available'}
              </div>
            </div>
          </div>
          
          <div className={`tab-content ${activeTab === 'code' ? 'active' : ''}`}>
            <div className="file-selection-container">
              <div className="selection-panel">
                <h3>Select Files</h3>
                <div className="selection-info">
                  {fullRepo?.files && (
                    selectedFiles.length === 0 ? (
                      <span>Showing all files ({fullRepo.files.length})</span>
                    ) : selectedFiles.length === fullRepo.files.length ? (
                      <span>All files selected ({selectedFiles.length})</span>
                    ) : (
                      <>
                        <span>Showing {selectedFiles.length} of {fullRepo.files.length} files</span>
                        <button 
                          onClick={() => {
                            // Select all files when "Show All" is clicked
                            const allFilePaths = fullRepo.files.map(file => file.path);
                            setSelectedFiles(allFilePaths);
                          }}
                          className="button button-small button-outline"
                        >
                          Select All
                        </button>
                      </>
                    )
                  )}
                </div>
                {fullRepo.ingestedContent?.allFiles || fullRepo.files ? (
                  <SelectableTreeView 
                    files={fullRepo.ingestedContent?.allFiles || fullRepo.files.map(file => ({
                      path: file.path,
                      type: 'blob',
                      size: file.size,
                      isBusinessLogic: file.isBusinessLogic
                    }))}
                    selectedFiles={selectedFiles}
                    onFileSelect={setSelectedFiles}
                  />
                ) : (
                  <p>No file information available</p>
                )}
              </div>
              <div className="digest-panel">
                <div className="section-title">
                  <h3>Generated Code Digest</h3>
                  <button 
                    ref={copyButtonRefs.code}
                    className="copy-button" 
                    onClick={() => {
                      const codeContent = fullRepo.files && fullRepo.files.length > 0 
                        ? getFilteredFiles().map(file => `// File: ${file.path}\n${file.content || '(Binary file or content unavailable)'}\n\n`).join('\n')
                        : 'No code content available';
                      copyToClipboard(codeContent, 'Code digest', copyButtonRefs.code);
                    }}
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                </div>
                <div className="content-container">
                  <div className="code-view" ref={codeRef}>
                    <pre>{fullRepo.files && fullRepo.files.length > 0 
                      ? getFilteredFiles().map(file => `// File: ${file.path}\n${file.content || '(Binary file or content unavailable)'}\n\n`).join('\n')
                      : 'No code content available'}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className={`tab-content ${activeTab === 'readme' ? 'active' : ''}`}>
            <div className="section-title">
              <h3>README</h3>
              <button 
                ref={copyButtonRefs.readme}
                className="copy-button" 
                onClick={() => copyToClipboard(
                  fullRepo.readme || 'No README file found in this repository.', 
                  'README',
                  copyButtonRefs.readme
                )}
                title="Copy to clipboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
            <div className="content-container">
              <div className="readme-view" ref={readmeRef}>
                {fullRepo.readme ? (
                  <pre>{fullRepo.readme}</pre>
                ) : (
                  <p>No README file found in this repository.</p>
                )}
              </div>
            </div>
          </div>
          
          <div className={`tab-content ${activeTab === 'extractor' ? 'active' : ''}`}>
            <SmartCodeExtractor
              repositoryId={fullRepo.id}
              onCopy={(text, sourceName, buttonRef) => copyToClipboard(text, sourceName, buttonRef)}
            />
          </div>
          
          <div className={`tab-content ${activeTab === 'native-app' ? 'active' : ''}`}>
            <NativeAppGenerator
              repositoryId={fullRepo.id}
              hasGeneratedApp={!!fullRepo.nativeApp}
              swiftCode={fullRepo.nativeApp?.swiftCode}
              onCopy={(text, sourceName, buttonRef) => copyToClipboard(text, sourceName, buttonRef)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepositoryModal;
