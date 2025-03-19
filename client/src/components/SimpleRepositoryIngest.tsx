import { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  Code,
  Heading,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
} from '@chakra-ui/react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface IngestResponse {
  repository: {
    id: string;
    owner: string;
    name: string;
  };
  analysisId?: string;
  message?: string;
}

export function SimpleRepositoryIngest() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<IngestResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const toast = useToast();
  const navigate = useNavigate();

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repoUrl) {
      setError('Repository URL is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setLogs([]);
    addLog(`Starting repository ingestion for: ${repoUrl}`);
    
    try {
      // Send the full URL to the API
      addLog('Sending request to API with full GitHub URL...');
      const response = await axios.post<IngestResponse>('/api/public-repositories', {
        url: repoUrl
      });
      
      addLog(`API response received: ${JSON.stringify(response.data)}`);
      setSuccess(response.data);
      
      const repoData = response.data.repository;
      toast({
        title: 'Repository Ingested',
        description: `Successfully added ${repoData.owner}/${repoData.name} to your repositories`,
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
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to ingest repository';
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

  const handleViewRepository = () => {
    if (success?.repository) {
      navigate(`/repository/${success.repository.owner}/${success.repository.name}`);
    }
  };

  return (
    <Box>
      <Heading size="md" mb={4}>Add Repository by URL</Heading>
      
      <Box as="form" onSubmit={handleSubmit} mb={6}>
        <VStack spacing={4} align="flex-start">
          <FormControl isRequired>
            <FormLabel>GitHub Repository URL</FormLabel>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              isDisabled={isLoading}
            />
          </FormControl>
          
          <Button
            type="submit"
            colorScheme="blue"
            isLoading={isLoading}
            loadingText="Ingesting..."
          >
            Ingest Repository
          </Button>
        </VStack>
      </Box>
      
      {logs.length > 0 && (
        <Box mt={4} p={4} borderWidth="1px" borderRadius="md" bg="gray.50" color="gray.800">
          <Heading size="sm" mb={2}>Process Log</Heading>
          <Box maxH="200px" overflowY="auto" fontFamily="mono" fontSize="sm">
            {logs.map((log, index) => (
              <Text key={index}>{log}</Text>
            ))}
            {isLoading && <Spinner size="sm" ml={2} />}
          </Box>
        </Box>
      )}
      
      {error && (
        <Alert status="error" mt={4}>
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Box mt={4}>
          <Alert status="success">
            <AlertIcon />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>Repository has been added successfully</AlertDescription>
          </Alert>
          
          <Box mt={4} p={4} borderWidth="1px" borderRadius="md">
            <Heading size="sm" mb={2}>Repository Details</Heading>
            <Code p={2} display="block" whiteSpace="pre" borderRadius="md">
              {JSON.stringify(success, null, 2)}
            </Code>
            
            <Divider my={4} />
            
            <Button 
              colorScheme="teal" 
              onClick={handleViewRepository}
            >
              View Repository
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
