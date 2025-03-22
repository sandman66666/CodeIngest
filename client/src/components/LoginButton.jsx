import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import githubIcon from '/github.svg';

const LoginButton = () => {
  const { isAuthenticated, user, loginWithGitHub, logout } = useAuth();

  return (
    <div className="login-button-container">
      {isAuthenticated ? (
        <div className="user-info">
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
          onClick={loginWithGitHub} 
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
