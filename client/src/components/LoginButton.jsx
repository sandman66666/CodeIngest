import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import githubIcon from '/github.svg';
import './LoginButton.css';

const LoginButton = () => {
  const { isAuthenticated, user, logout } = useAuth();

  // Instead of using the JavaScript login method, we'll use a direct link
  // This provides a more reliable OAuth flow, especially on Heroku
  const handleLogin = () => {
    // Redirect to the GitHub auth endpoint
    window.location.href = '/auth/github';
  };

  return (
    <div className="login-button-container">
      {isAuthenticated ? (
        <div className="user-info">
          {user.avatar && (
            <img 
              src={user.avatar} 
              alt={`${user.displayName}'s avatar`} 
              className="user-avatar" 
            />
          )}
          <span>Signed in as <strong>{user.displayName}</strong></span>
          <button 
            onClick={logout} 
            className="button button-secondary"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button 
          onClick={handleLogin} 
          className="button button-github"
        >
          <img src={githubIcon} alt="GitHub logo" className="github-icon" />
          Sign in with GitHub
        </button>
      )}
    </div>
  );
};

export default LoginButton;
