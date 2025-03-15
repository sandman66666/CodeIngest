import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  Flex,
  Divider,
  Heading,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  useColorModeValue,
} from '@chakra-ui/react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface IngestResponse {
  repository: {
    id: string;
    owner: string;
    name: string;
  };
  analysisId: string;
  message: string;
}

export function PublicRepositoryIngest() {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<IngestResponse | null>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const formBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!owner || !repo) {
      setError('Repository owner and name are required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post<IngestResponse>('http://localhost:3030/api/public-repositories', {
        owner,
        name: repo
      });
      
      setSuccess(response.data);
      toast({
        title: 'Repository ingested successfully',
        description: `${owner}/${repo} has been added and analysis has started.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Clear form
      setOwner('');
      setRepo('');
    } catch (err) {
      const errorMessage = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to ingest repository. Please try again.';
      
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const viewRepository = () => {
    if (success) {
      // Note: This is a mock navigation since we're not fully implementing the repository view
      // In a real app, we would navigate to the repository page
      toast({
        title: 'Viewing Repository',
        description: `Navigating to ${success.repository.owner}/${success.repository.name}`,
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    }
  };

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
        <Heading size="md">Try without logging in</Heading>
        <Text color="gray.500">
          Analyze any public GitHub repository instantly
        </Text>
        
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
        
        {success && (
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Repository Ingested!</AlertTitle>
              <AlertDescription display="block">
                Analysis of {success.repository.owner}/{success.repository.name} is in progress.
              </AlertDescription>
            </Box>
            <Button 
              size="sm" 
              colorScheme="green" 
              onClick={viewRepository}
            >
              View Details
            </Button>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Repository Owner</FormLabel>
              <Input 
                placeholder="e.g., facebook" 
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </FormControl>
            
            <FormControl isRequired>
              <FormLabel>Repository Name</FormLabel>
              <Input 
                placeholder="e.g., react" 
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </FormControl>
            
            <Button 
              colorScheme="blue" 
              type="submit"
              isLoading={isLoading}
              loadingText="Ingesting"
              width="full"
            >
              Analyze Repository
            </Button>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
}
