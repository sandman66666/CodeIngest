import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SmartCodeExtractor from './SmartCodeExtractor';

const RepositoryModal = ({ repository, onClose }) => {
  const [activeTab, setActiveTab] = useState('structure');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullRepo, setFullRepo] = useState(null);
  const [loadingAdditionalFiles, setLoadingAdditionalFiles] = useState(false);

  useEffect(() => {
    // If we don't have the full repository data, fetch it
    if (!repository.ingestedContent) {
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
    if (fullRepo?.ingestedContent?.allFilesIncluded) {
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
        </div>
        
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          
          {!fullRepo.ingestedContent?.allFilesIncluded && (
            <div className="alert" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
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
            <div className="tree-view">
              {fullRepo.ingestedContent?.tree || 'No folder structure available'}
            </div>
          </div>
          
          <div className={`tab-content ${activeTab === 'code' ? 'active' : ''}`}>
            <div className="code-view">
              <pre>{fullRepo.ingestedContent?.fullCode || 'No code content available'}</pre>
            </div>
          </div>
          
          <div className={`tab-content ${activeTab === 'readme' ? 'active' : ''}`}>
            <div className="readme-view">
              {fullRepo.ingestedContent?.readme ? (
                <pre>{fullRepo.ingestedContent.readme}</pre>
              ) : (
                <p>No README file found in this repository.</p>
              )}
            </div>
          </div>
          
          <div className={`tab-content ${activeTab === 'extractor' ? 'active' : ''}`}>
            <SmartCodeExtractor
              repositoryId={fullRepo.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepositoryModal;
