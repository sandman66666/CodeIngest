import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RepositoryModal from './RepositoryModal';
import LoginButton from './LoginButton';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { isAuthenticated, user } = useAuth();
  const [url, setUrl] = useState('');
  const [includeAllFiles, setIncludeAllFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [userRepositories, setUserRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ingested');

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

  // Fetch user's GitHub repositories when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const fetchUserRepositories = async () => {
        try {
          const response = await axios.get('/api/user/repositories');
          setUserRepositories(response.data.repositories || []);
        } catch (error) {
          console.error('Error fetching user repositories:', error);
        }
      };

      fetchUserRepositories();
    }
  }, [isAuthenticated]);

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

  const handleGitHubRepoIngest = async (repo) => {
    setError('');
    setLoading(true);
    
    try {
      const repoUrl = `https://github.com/${repo.fullName}`;
      const response = await axios.post('/api/public-repositories', { 
        url: repoUrl,
        includeAllFiles
      });
      
      // Add the new repository to the list
      setRepositories(prev => [response.data.repository, ...prev]);
      
      // Select the new repository and show modal
      setSelectedRepo(response.data.repository);
      setShowModal(true);
      
      // Switch to ingested tab
      setActiveTab('ingested');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to ingest repository');
    } finally {
      setLoading(false);
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
      <div className="header-container">
        <h1>GitHub Code Ingestion</h1>
        <div className="auth-section">
          <LoginButton />
        </div>
      </div>
      
      <div className="card">
        <h2>Ingest a New Repository</h2>
        <p>Enter a GitHub repository URL to ingest its code for analysis.</p>
        {isAuthenticated && (
          <p className="auth-note">
            You're signed in as <strong>{user.displayName}</strong> and can access your private repositories.
          </p>
        )}
        {!isAuthenticated && (
          <p className="auth-note">
            <i>Note: Sign in with GitHub to access your private repositories.</i>
          </p>
        )}
        
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
      
      {/* Tabs for repository lists */}
      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'ingested' ? 'active' : ''}`}
            onClick={() => setActiveTab('ingested')}
          >
            Ingested Repositories
          </button>
          {isAuthenticated && (
            <button 
              className={`tab ${activeTab === 'github' ? 'active' : ''}`}
              onClick={() => setActiveTab('github')}
            >
              Your GitHub Repositories
            </button>
          )}
        </div>
      
        {/* Ingested repositories tab */}
        {activeTab === 'ingested' && (
          <div>
            {repositories.length > 0 ? (
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
                      {repo.summary?.isPrivate && <span className="private-tag">Private</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No repositories have been ingested yet. Use the form above to ingest a repository.</p>
              </div>
            )}
          </div>
        )}
        
        {/* GitHub repositories tab */}
        {activeTab === 'github' && (
          <div>
            {userRepositories.length > 0 ? (
              <div className="repository-list">
                {userRepositories.map(repo => (
                  <div 
                    key={repo.id} 
                    className="card repository-card github-repo-card"
                  >
                    <h3>{repo.fullName}</h3>
                    <div className="repository-meta">
                      <span>{repo.language || 'Unknown'}</span>
                      <span>⭐ {repo.stars}</span>
                      <span>Updated {formatDate(repo.updatedAt)}</span>
                      {repo.isPrivate && <span className="private-tag">Private</span>}
                    </div>
                    <p className="repo-description">{repo.description || 'No description'}</p>
                    <button 
                      onClick={() => handleGitHubRepoIngest(repo)}
                      className="button button-small"
                    >
                      Ingest This Repository
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No GitHub repositories found. If you just logged in, please wait a moment...</p>
              </div>
            )}
          </div>
        )}
      </div>
      
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
