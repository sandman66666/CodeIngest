import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Create the auth context
const AuthContext = createContext(null);

// Hook for easy access to auth context
export const useAuth = () => useContext(AuthContext);

// Provider component that wraps app and makes auth object available to any child component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Configure axios to send cookies with requests
        axios.defaults.withCredentials = true;
        
        console.log('Checking authentication status...');
        const response = await axios.get('/auth/user');
        console.log('Auth response:', response.data);
        
        if (response.data.isAuthenticated) {
          console.log('User is authenticated:', response.data.user);
          setUser(response.data.user);
          setIsAuthenticated(true);
        } else {
          console.log('User is not authenticated');
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Function to handle logout
  const logout = async () => {
    try {
      await axios.get('/auth/logout');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Login via GitHub OAuth (redirects to GitHub)
  const loginWithGitHub = () => {
    // Use the full URL to ensure we match exactly what's registered in GitHub
    if (window.location.hostname === 'localhost') {
      window.location.href = 'http://localhost:3000/auth/github';
    } else {
      // Use absolute URL in production to ensure callback matches exactly
      window.location.href = 'https://codanalyzer-49ec21ea6aca.herokuapp.com/auth/github';
    }
  };

  // Value object that will be passed to consumers
  const value = {
    user,
    isAuthenticated,
    loading,
    loginWithGitHub,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
