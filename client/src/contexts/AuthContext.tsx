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

interface AuthContextType extends AuthState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for development without requiring GitHub OAuth
const MOCK_USER: User = {
  id: 'mock-user-1',
  login: 'devuser',
  name: 'Development User',
  email: 'dev@example.com',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
};

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
      // For development, check if we have a mock auth flag in localStorage
      const useMockAuth = localStorage.getItem('useMockAuth') === 'true';
      const token = localStorage.getItem('token');
      
      if (useMockAuth) {
        console.log('Using mock authentication');
        setState(prev => ({
          ...prev,
          user: MOCK_USER,
          error: null,
          isLoading: false,
        }));
        return;
      }
      
      if (!token) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Only attempt API call if we have a token and aren't using mock auth
      try {
        const response = await fetch('http://localhost:3030/api/auth/me', {
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
          user: data.user,
          error: null,
          isLoading: false,
        }));
      } catch (error) {
        console.error('API auth check failed, falling back to mock auth:', error);
        // Fall back to mock auth if API call fails
        setState(prev => ({
          ...prev,
          user: MOCK_USER,
          error: null,
          isLoading: false,
        }));
        localStorage.setItem('useMockAuth', 'true');
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
    // For development, use mock authentication
    localStorage.setItem('useMockAuth', 'true');
    setState(prev => ({
      ...prev,
      user: MOCK_USER,
      error: null,
      isLoading: false,
    }));
    navigate('/');
    toast({
      title: 'Logged in successfully',
      description: 'Using mock authentication for development',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
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

  return (
    <AuthContext.Provider 
      value={{ 
        ...state,
        isAuthenticated: !!state.user,
        login, 
        logout 
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
