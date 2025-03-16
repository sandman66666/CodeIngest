import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  useColorModeValue,
  Divider,
  Icon,
} from '@chakra-ui/react';
import { FiGithub, FiLock } from 'react-icons/fi';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Adjust the import path as needed
import { RepositoryIngestionPreview } from './RepositoryIngestionPreview';

interface User {
  id: string;
  githubId: number;
  username: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string;
  accessToken?: string;
}

interface IngestResponse {
  repository: {
    id: string;
    owner: string;
    name: string;
  };
  analysisId: string;
  message: string;
}

export function PrivateRepositoryIngest() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<{
    repository: any;
    analysisId: string;
  } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const toast = useToast();
  const navigate = useNavigate();
  const formBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const { user, isAuthenticated } = useAuth();

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      setError('You must be logged in to access private repositories');
      return;
    }
    
    if (!repoUrl) {
      setError('Repository URL is required');
      return;
    }
    
    // Basic GitHub URL validation
    const githubUrlPattern = /^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/i;
    if (!githubUrlPattern.test(repoUrl)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repository)');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setLogs([]);
    addLog(`Starting private repository ingestion for: ${repoUrl}`);
    
    try {
      addLog('Authenticating with GitHub...');
      const response = await axios.post('http://localhost:3000/api/private-repositories', 
        { url: repoUrl },
        { 
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}` 
          } 
        }
      );
      
      addLog(`API response received: ${JSON.stringify(response.data)}`);
      setIngestionResult({
        repository: response.data.repository,
        analysisId: response.data.analysisId
      });
      
      const repoData = response.data.repository;
      toast({
        title: 'Private Repository Ingested',
        description: `Successfully ingested ${repoData.owner}/${repoData.name}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      if (response.data.repository) {
        addLog(`Repository ingestion complete. Repository ID: ${response.data.repository.id}`);
        
        if (response.data.analysisId) {
          addLog(`Analysis started with ID: ${response.data.analysisId}`);
          addLog('Analysis results will be available shortly...');
        }
      }
      
      setSuccess(true);
      // Clear form
      setRepoUrl('');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to ingest private repository';
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
      
      toast({
        title: 'Ingestion Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleProceedToAnalysis = () => {
    // The navigation to repository details is handled in the RepositoryIngestionPreview component
    setSuccess(true);
    setIngestionResult(null);
  };

  const handleViewRepository = () => {
    if (ingestionResult?.repository) {
      navigate(`/repository/${ingestionResult.repository.id}`);
    }
  };

  // If not authenticated, show a message to log in
  if (!isAuthenticated) {
    return (
      <Box 
        p={6} 
        borderWidth="1px" 
        borderRadius="lg" 
        borderColor={borderColor}
        bg={formBg}
        boxShadow="md"
        width="100%"
      >
        <VStack spacing={4} align="stretch">
          <Alert status="warning">
            <AlertIcon />
            <Box>
              <AlertTitle>Authentication Required</AlertTitle>
              <AlertDescription>
                You must be logged in with GitHub to access private repositories.
              </AlertDescription>
            </Box>
          </Alert>
          <Button
            colorScheme="blue"
            onClick={() => navigate('/login')}
          >
            Log in with GitHub
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box width="100%">
      {!success && !ingestionResult && (
        <Box 
          p={6} 
          borderWidth="1px" 
          borderRadius="lg" 
          borderColor={borderColor}
          bg={formBg}
          boxShadow="md"
        >
          <VStack spacing={4} align="stretch">
            <HStack>
              <Icon as={FiLock} color="purple.500" boxSize={5} />
              <Text fontSize="xl" fontWeight="bold">
                Analyze Private GitHub Repository
              </Text>
            </HStack>
            
            <Text color="gray.500">
              You're signed in as <strong>{user && user.username}</strong>. You can now analyze private repositories you have access to.
            </Text>
            
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>GitHub Authentication Active</AlertTitle>
                <AlertDescription>
                  Your GitHub authentication token will be used to access the repository.
                  Only repositories you have permission to view will be accessible.
                </AlertDescription>
              </Box>
            </Alert>
            
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertTitle mr={2}>Error:</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <CloseButton 
                  position="absolute" 
                  right="8px" 
                  top="8px" 
                  onClick={() => setError(null)}
                />
              </Alert>
            )}
            
            <form onSubmit={handleSubmit}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>GitHub Repository URL</FormLabel>
                  <Input 
                    placeholder="https://github.com/username/repository" 
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </FormControl>
                
                <Button 
                  leftIcon={<FiGithub />}
                  colorScheme="purple" 
                  type="submit"
                  isLoading={isLoading}
                  loadingText="Ingesting"
                  width="full"
                >
                  Analyze Private Repository
                </Button>
              </VStack>
            </form>
            
            {logs.length > 0 && (
              <Box mt={4} p={4} borderWidth="1px" borderRadius="md" bg="gray.50" color="gray.800">
                <Text fontWeight="bold" mb={2}>Process Log</Text>
                <Box maxH="200px" overflowY="auto" fontFamily="mono" fontSize="sm">
                  {logs.map((log, index) => (
                    <Text key={index}>{log}</Text>
                  ))}
                  {isLoading && <Icon as={FiGithub} size="sm" ml={2} />}
                </Box>
              </Box>
            )}
          </VStack>
        </Box>
      )}
      
      {ingestionResult && (
        <RepositoryIngestionPreview 
          repository={ingestionResult.repository}
          analysisId={ingestionResult.analysisId}
          onProceed={handleProceedToAnalysis}
          isPrivate={true}
        />
      )}
      
      {success && !ingestionResult && (
        <Alert
          status="success"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          height="200px"
          borderRadius="lg"
        >
          <AlertIcon boxSize="40px" mr={0} />
          <AlertTitle mt={4} mb={1} fontSize="lg">
            Private Repository Ingested Successfully!
          </AlertTitle>
          <AlertDescription maxWidth="sm">
            The analysis is now in progress. Check the repository details page for the results.
          </AlertDescription>
          <Button 
            mt={4} 
            colorScheme="purple" 
            onClick={handleViewRepository}
          >
            View Repository Details
          </Button>
          <Button 
            mt={4} 
            colorScheme="purple" 
            onClick={() => {
              setSuccess(false);
            }}
          >
            Analyze Another Repository
          </Button>
        </Alert>
      )}
    </Box>
  );
}

function Heading(props: any) {
  return <Text fontWeight="bold" fontSize="xl" {...props} />;
}
