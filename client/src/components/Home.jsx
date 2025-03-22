import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RepositoryModal from './RepositoryModal';

const Home = () => {
  const [url, setUrl] = useState('');
  const [includeAllFiles, setIncludeAllFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch repositories on component mount
  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const response = await axios.get('/api/repositories');
        setRepositories(response.data.repositories || []);
      } catch (error) {
        console.error('Error fetching repositories:', error);
      }
    };

    fetchRepositories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!url) {
      setError('GitHub repository URL is required');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post('/api/public-repositories', { 
        url,
        includeAllFiles
      });
      
      // Add the new repository to the list
      setRepositories(prev => [response.data.repository, ...prev]);
      
      // Select the new repository and show modal
      setSelectedRepo(response.data.repository);
      setShowModal(true);
      
      // Reset form
      setUrl('');
      setIncludeAllFiles(false);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to ingest repository');
    } finally {
      setLoading(false);
    }
  };

  const handleRepositoryClick = async (repo) => {
    try {
      const response = await axios.get(`/api/repositories/${repo.id}`);
      setSelectedRepo(response.data.repository);
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching repository details:', error);
      setError('Failed to load repository details');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <h1>GitHub Code Ingestion</h1>
      
      <div className="card">
        <h2>Ingest a New Repository</h2>
        <p>Enter a public GitHub repository URL to ingest its code for analysis.</p>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="repoUrl">GitHub Repository URL</label>
            <input
              type="text"
              id="repoUrl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              disabled={loading}
            />
          </div>
          
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="includeAllFiles"
              checked={includeAllFiles}
              onChange={(e) => setIncludeAllFiles(e.target.checked)}
              disabled={loading}
            />
            <label htmlFor="includeAllFiles">
              Include all files (By default, only business logic and platform code is ingested)
            </label>
          </div>
          
          <button 
            type="submit" 
            className="button button-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span>Ingesting...</span>
              </>
            ) : 'Ingest Repository'}
          </button>
        </form>
      </div>
      
      {repositories.length > 0 && (
        <div>
          <h2>Your Repositories</h2>
          
          <div className="repository-list">
            {repositories.map(repo => (
              <div 
                key={repo.id} 
                className="card repository-card"
                onClick={() => handleRepositoryClick(repo)}
              >
                <h3>{repo.owner}/{repo.name}</h3>
                <div className="repository-meta">
                  <span>{repo.summary?.language || 'Unknown'}</span>
                  <span>{repo.fileCount} files</span>
                  <span>{formatFileSize(repo.sizeInBytes || 0)}</span>
                  <span>Added {formatDate(repo.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {showModal && selectedRepo && (
        <RepositoryModal
          repository={selectedRepo}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default Home;
