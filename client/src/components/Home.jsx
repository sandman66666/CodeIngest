import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import RepositoryModal from './RepositoryModal';
import LoginButton from './LoginButton';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { isAuthenticated, user } = useAuth();
  const [url, setUrl] = useState('');
  const [privateUrl, setPrivateUrl] = useState('');
  const [privateToken, setPrivateToken] = useState('');
  const [includeAllFiles, setIncludeAllFiles] = useState(false);
  const [includeAllFilesPrivate, setIncludeAllFilesPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPrivate, setLoadingPrivate] = useState(false);
  const [error, setError] = useState('');
  const [errorPrivate, setErrorPrivate] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [userRepositories, setUserRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ingested');
  const [githubRepos, setGithubRepos] = useState([]);
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [loadingGithubRepos, setLoadingGithubRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

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

    // Set GitHub tab as active by default when user is authenticated
    if (isAuthenticated && !activeTab) {
      setActiveTab('github');
    }
    
    fetchRepositories();
  }, [isAuthenticated]);

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
    
    if (!url) {
      setError('Please enter a repository URL');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Choose endpoint based on authentication status
      const endpoint = isAuthenticated 
        ? '/api/private-repositories' 
        : '/api/public-repositories';
      
      console.log(`Using endpoint: ${endpoint} for URL: ${url} (isAuthenticated: ${isAuthenticated})`);
      
      const response = await axios.post(endpoint, {
        url,
        includeAllFiles
      });
      
      const repository = response.data.repository;
      
      // Add the new repository to the list
      setRepositories(prevRepositories => [repository, ...prevRepositories]);
      
      // Clear the form
      setUrl('');
      setActiveTab('ingested');
      
      // Select the new repository and show modal
      setSelectedRepo(repository);
      setShowModal(true);
    } catch (error) {
      console.error('Repository ingestion error:', error);
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
      // Get the URL from the repo object - ensure we have a URL to use
      const repoUrl = repo.url || repo.html_url || `https://github.com/${repo.fullName || repo.full_name}`;
      
      // Use authenticated endpoint for user's repositories
      const endpoint = '/api/private-repositories';
      console.log(`Using endpoint: ${endpoint} for GitHub repository: ${repoUrl} (isAuthenticated: ${isAuthenticated})`);
      
      const response = await axios.post(endpoint, { 
        url: repoUrl,
        repoFullName: repo.fullName || repo.full_name,
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
      console.error('GitHub repository ingestion error:', error);
      setError(error.response?.data?.error || 'Failed to ingest repository');
    } finally {
      setLoading(false);
    }
  };

  // Function to load GitHub repositories
  const loadGithubRepositories = async () => {
    if (!isAuthenticated) {
      setError('Please sign in with GitHub to browse your repositories');
      return;
    }
    
    setLoadingGithubRepos(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/user/repositories');
      setGithubRepos(response.data.repositories);
      setShowBrowseModal(true);
    } catch (error) {
      console.error('Error loading GitHub repositories:', error);
      setError(error.response?.data?.error || 'Failed to load your GitHub repositories');
    } finally {
      setLoadingGithubRepos(false);
    }
  };

  // Handle selecting a repository from the browse modal
  const handleRepositorySelect = (repo) => {
    setShowBrowseModal(false);
    ingestGithubRepository(repo);
  };

  const ingestGithubRepository = async (repo) => {
    setError('');
    setLoading(true);
    
    try {
      // Get the URL from the repo object - ensure we have a URL to use
      const repoUrl = repo.url || repo.html_url || `https://github.com/${repo.fullName || repo.full_name}`;
      
      // Use authenticated endpoint for user's repositories
      const endpoint = '/api/private-repositories';
      console.log(`Using endpoint: ${endpoint} for GitHub repository: ${repoUrl} (isAuthenticated: ${isAuthenticated})`);
      
      const response = await axios.post(endpoint, { 
        url: repoUrl,
        repoFullName: repo.fullName || repo.full_name,
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
      console.error('GitHub repository ingestion error:', error);
      setError(error.response?.data?.error || 'Failed to ingest repository');
    } finally {
      setLoading(false);
    }
  };

  // Function to search GitHub repositories
  const searchRepositories = async () => {
    if (!isAuthenticated) {
      setError('Please sign in with GitHub to search your repositories');
      return;
    }
    
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      return;
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/search/repositories', {
        params: { query: searchQuery }
      });
      
      setSearchResults(response.data);
      setActiveTab('search');
    } catch (error) {
      console.error('Error searching repositories:', error);
      setError(error.response?.data?.error || 'Failed to search repositories');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    searchRepositories();
  };

  // Function to handle private repository URL submission
  const handlePrivateSubmit = async (e) => {
    e.preventDefault();
    
    if (!privateUrl) {
      setErrorPrivate('Please enter a repository URL');
      return;
    }
    
    if (!isAuthenticated && !privateToken) {
      setErrorPrivate('You must be signed in or provide a personal access token to ingest private repositories');
      return;
    }
    
    setLoadingPrivate(true);
    setErrorPrivate(null);
    
    try {
      const endpoint = '/api/private-repositories';
      
      console.log(`Using private endpoint: ${endpoint} for URL: ${privateUrl}`);
      
      const response = await axios.post(endpoint, {
        url: privateUrl,
        includeAllFiles: includeAllFilesPrivate,
        personalAccessToken: privateToken // Send token if provided
      });
      
      const repository = response.data.repository;
      
      // Add the new repository to the list
      setRepositories(prevRepositories => [repository, ...prevRepositories]);
      
      // Clear the form
      setPrivateUrl('');
      setPrivateToken('');
      setActiveTab('ingested');
      
      // Select the new repository and show modal
      setSelectedRepo(repository);
      setShowModal(true);
    } catch (error) {
      console.error('Private repository ingestion error:', error);
      setErrorPrivate(error.response?.data?.error || 'Failed to ingest private repository');
    } finally {
      setLoadingPrivate(false);
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
        <h2>Ingest a Public Repository</h2>
        <p>Enter a GitHub repository URL to ingest its code for analysis.</p>
        {!isAuthenticated && (
          <p className="auth-note">
            <i>Note: Sign in with GitHub to access your private repositories.</i>
          </p>
        )}
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="repoUrl">Public Repository URL</label>
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
            ) : 'Ingest Public Repository'}
          </button>
          
          <button 
            type="button" 
            className="button button-secondary"
            disabled={loading || loadingGithubRepos}
            onClick={loadGithubRepositories}
          >
            {loadingGithubRepos ? (
              <>
                <span className="spinner"></span>
                <span>Loading...</span>
              </>
            ) : 'Browse My Repositories'}
          </button>
        </form>
      </div>
      
      {isAuthenticated && (
        <div className="card">
          <h2>Ingest a Private Repository</h2>
          <p>Enter a GitHub private repository URL to ingest its code for analysis.</p>
          <p className="auth-note">
            You're signed in as <strong>{user.displayName}</strong> and can access your private repositories.
          </p>
          
          {errorPrivate && <div className="alert alert-error">{errorPrivate}</div>}
          
          <form onSubmit={handlePrivateSubmit}>
            <div className="input-group">
              <label htmlFor="privateRepoUrl">Private Repository URL</label>
              <input
                type="text"
                id="privateRepoUrl"
                value={privateUrl}
                onChange={(e) => setPrivateUrl(e.target.value)}
                placeholder="https://github.com/username/private-repository"
                disabled={loadingPrivate}
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="privateToken">
                {isAuthenticated 
                  ? 'Personal Access Token (Optional)' 
                  : 'Personal Access Token (Required for private repos)'}
              </label>
              <input
                type="password"
                id="privateToken"
                value={privateToken}
                onChange={(e) => setPrivateToken(e.target.value)}
                placeholder={isAuthenticated 
                  ? "Optional: Only needed if OAuth permissions aren't working" 
                  : "Enter your GitHub personal access token"}
                disabled={loadingPrivate}
              />
              <small className="helper-text">
                {isAuthenticated 
                  ? "You're already authenticated with GitHub OAuth. This field is only needed if you experience permission issues." 
                  : "Personal access token with 'repo' scope is required for private repositories."} 
                <a 
                  href="https://github.com/settings/tokens/new" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Create a token
                </a>
              </small>
            </div>
            
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="includeAllFilesPrivate"
                checked={includeAllFilesPrivate}
                onChange={(e) => setIncludeAllFilesPrivate(e.target.checked)}
                disabled={loadingPrivate}
              />
              <label htmlFor="includeAllFilesPrivate">
                Include all files (By default, only business logic and platform code is ingested)
              </label>
            </div>
            
            <button 
              type="submit" 
              className="button button-primary"
              disabled={loadingPrivate}
            >
              {loadingPrivate ? (
                <>
                  <span className="spinner"></span>
                  <span>Ingesting...</span>
                </>
              ) : 'Ingest Private Repository'}
            </button>
          </form>
        </div>
      )}
      
      <div className="card">
        <h2>Search Repositories</h2>
        <form onSubmit={handleSearchSubmit}>
          <div className="input-group">
            <label htmlFor="searchQuery">Search Repositories</label>
            <input
              type="text"
              id="searchQuery"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for repositories"
              disabled={isSearching}
            />
          </div>
          <button 
            type="submit" 
            className="button button-primary"
            disabled={isSearching}
          >
            {isSearching ? (
              <>
                <span className="spinner"></span>
                <span>Searching...</span>
              </>
            ) : 'Search'}
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
          {isAuthenticated && (
            <button 
              className={`tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Search Results
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
        
        {/* Search results tab */}
        {activeTab === 'search' && (
          <div>
            {searchResults.length > 0 ? (
              <div className="repository-list">
                {searchResults.map(repo => (
                  <div 
                    key={repo.id} 
                    className="card repository-card"
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
                <p>No search results found.</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Repository details modal */}
      {showModal && selectedRepo && (
        <RepositoryModal 
          repository={selectedRepo} 
          onClose={() => setShowModal(false)} 
        />
      )}
      
      {/* Browse Repositories Modal */}
      {showBrowseModal && (
        <div className="modal-overlay">
          <div className="modal browse-modal">
            <div className="modal-header">
              <h2>Your GitHub Repositories</h2>
              <button className="close-button" onClick={() => setShowBrowseModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {githubRepos.length > 0 ? (
                <div className="repository-list">
                  {githubRepos.map(repo => (
                    <div 
                      key={repo.id} 
                      className="card repository-card"
                      onClick={() => handleRepositorySelect(repo)}
                    >
                      <div className="repository-info">
                        <h3>{repo.name}</h3>
                        <p className="description">{repo.description || 'No description'}</p>
                        <div className="repository-meta">
                          <span>{repo.language || 'Unknown'}</span>
                          <span>★ {repo.stars}</span>
                          <span>{repo.isPrivate ? '🔒 Private' : '🌐 Public'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No repositories found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
