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
        
        const response = await axios.get('/auth/user');
        
        if (response.data.isAuthenticated) {
          setUser(response.data.user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
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
    window.location.href = '/auth/github';
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
