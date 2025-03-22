import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import githubIcon from '../assets/github-mark.svg';

const LoginButton = () => {
  const { isAuthenticated, user, loginWithGitHub, logout, loading } = useAuth();

  if (loading) {
    return (
      <button className="auth-button loading" disabled>
        <span className="spinner"></span>
      </button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="auth-container">
        <span className="user-info">
          <span className="username">{user.displayName}</span>
        </span>
        <button onClick={logout} className="auth-button logout-button">
          Logout
        </button>
      </div>
    );
  }

  return (
    <button onClick={loginWithGitHub} className="auth-button login-button">
      <img src={githubIcon} alt="GitHub Logo" className="github-icon" />
      <span>Login with GitHub</span>
    </button>
  );
};

export default LoginButton;
