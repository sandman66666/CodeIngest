import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';

interface User {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType {
  user: User | null;
  error: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  handleAuthCallback: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Clear any mock auth settings that might be stored
      localStorage.removeItem('useMockAuth');
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Only attempt API call if we have a token
      try {
        const response = await fetch('/api/auth/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        const data = await response.json();
        setState(prev => ({
          ...prev,
          user: data.data,
          error: null,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Authentication check failed:', error);
        localStorage.removeItem('token');
        setState(prev => ({
          ...prev,
          user: null,
          error: null,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setState(prev => ({
        ...prev,
        user: null,
        error: 'Authentication failed',
        isLoading: false,
      }));
      localStorage.removeItem('token');
      toast({
        title: 'Authentication Error',
        description: 'Please log in again',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const login = () => {
    // Get the current base URL for the app, both in development and production
    const baseUrl = window.location.origin;
    const authUrl = `${baseUrl}/api/auth/github`;
    
    // Log the redirection for debugging
    console.log(`Redirecting to GitHub auth URL: ${authUrl}`);
    
    // Redirect to GitHub auth
    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('useMockAuth');
      setState(prev => ({
        ...prev,
        user: null,
        error: null,
      }));
      navigate('/login');
      toast({
        title: 'Logged out successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: 'Logout Error',
        description: 'Failed to log out properly',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleAuthCallback = async (token: string) => {
    try {
      localStorage.setItem('token', token);
      
      const response = await fetch('/api/auth/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get user profile');
      }
      
      const data = await response.json();
      setState(prev => ({
        ...prev,
        user: data.data,
        error: null,
        isLoading: false,
      }));
      
      return;
    } catch (error) {
      console.error('Error in auth callback:', error);
      localStorage.removeItem('token');
      throw error;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        ...state,
        isAuthenticated: !!state.user,
        login, 
        logout,
        handleAuthCallback
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
