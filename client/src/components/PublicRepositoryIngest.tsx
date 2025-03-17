import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Input,
  Text,
  Heading,
  VStack,
  useToast,
  FormControl,
  FormLabel,
  FormHelperText,
  Divider,
  Badge,
  HStack,
  Spinner,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
} from '@chakra-ui/react';
import { RepositoryIngestionPreview } from './Repository/RepositoryIngestionPreview';
import CodeViewModal from './CodeViewModal';

export function PublicRepositoryIngest() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<{
    repository: any;
    analysisId: string;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const toast = useToast();
  const formBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleModalOpen = () => setModalOpen(true);
  const handleModalClose = () => setModalOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    try {
      const response = await axios.post('http://localhost:3030/api/public-repositories', {
        url: repoUrl
      });

      const handleSuccess = (result: any) => {
        setIngestionResult(result);
        setIsLoading(false);
        console.log('Ingestion success result:', result);  // Debug log to see structure
        
        // Show success message
        toast({
          title: 'Repository Ingested',
          description: `Successfully ingested ${result.repository.owner}/${result.repository.name}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      };

      handleSuccess({
        repository: response.data.repository,
        analysisId: response.data.analysisId
      });

      setSuccess(true);
      // Clear form
      setRepoUrl('');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to ingest repository';
      setError(errorMessage);

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

  const handleStartAnalysis = async () => {
    if (!ingestionResult || !ingestionResult.repository) return;
    
    try {
      setIsLoading(true);
      setAnalysisStarted(true);
      
      // Use OpenAI API key from environment variable in production
      // For development, the key should be configured on the server-side
      const response = await axios.post(`http://localhost:3030/api/analysis/${ingestionResult.repository.id}`, {
        apiKey: '' // Empty string will make the server use its environment variable
      });
      
      setAnalysisId(response.data.analysisId);
      
      toast({
        title: 'Analysis started',
        description: 'The analysis has been started and will be available soon.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      
      // Wait a moment to show the user that the analysis has started
      setTimeout(() => {
        // Navigate to analysis page
        window.location.href = `/analysis/${response.data.analysisId}`;
      }, 1500);
      
    } catch (error: any) {
      setAnalysisStarted(false);
      const errorMessage = error.response?.data?.error || 'Failed to start analysis';
      
      toast({
        title: 'Analysis Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getFileTreeData = (ingestedContent: any) => {
    if (!ingestedContent) return [];
    
    // Try different possible locations for the tree data
    if (Array.isArray(ingestedContent.tree)) {
      return ingestedContent.tree;
    } else if (Array.isArray(ingestedContent.fileTree)) {
      return ingestedContent.fileTree;
    } else if (ingestedContent.tree && typeof ingestedContent.tree === 'object') {
      return [ingestedContent.tree]; // Wrap single object in array
    } else if (ingestedContent.fileStructure) {
      return ingestedContent.fileStructure;
    }
    
    return []; // Default to empty array if no tree data found
  };

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
            <Text fontSize="xl" fontWeight="bold">
              Analyze Public GitHub Repository
            </Text>

            <Text color="gray.500">
              Enter the URL of a public GitHub repository to analyze
            </Text>

            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>No Sign-in Required</AlertTitle>
                <AlertDescription>
                  Public repositories can be analyzed without GitHub authentication.
                  For private repositories, you'll need to sign in with GitHub.
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
      )}

      {ingestionResult && (
        <Box>
          <Box sx={{ p: 2, my: 2 }}>
            <Text fontSize="xl" fontWeight="bold">
              Repository Information
            </Text>
            <Text>Owner: {ingestionResult.repository.owner}</Text>
            <Text>Name: {ingestionResult.repository.name}</Text>
            <Text>Files: {ingestionResult.repository.ingestedContent?.fileCount || 0}</Text>
            <Text>Size: {(ingestionResult.repository.ingestedContent?.sizeInBytes / 1024 / 1024).toFixed(2)} MB</Text>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="solid"
                colorScheme="purple"
                mr={2}
                onClick={handleModalOpen}
              >
                View Code
              </Button>
              <Button
                variant="solid"
                colorScheme="teal"
                onClick={handleStartAnalysis}
                isLoading={isLoading}
                loadingText="Starting Analysis"
                isDisabled={analysisStarted}
              >
                {analysisStarted ? "Analysis In Progress..." : "Analyze Code"}
              </Button>
            </Box>

            {/* Code View Modal */}
            <CodeViewModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              codeContent={ingestionResult?.repository?.ingestedContent?.fullCode || ''}
              repositoryName={ingestionResult?.repository ? `${ingestionResult.repository.owner}/${ingestionResult.repository.name}` : ''}
              fileTree={getFileTreeData(ingestionResult?.repository?.ingestedContent)}
              summary={ingestionResult?.repository?.ingestedContent?.summary || ''}
            />
          </Box>
          {analysisStarted && analysisId && (
            <Box mt={4}>
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>Analysis in progress</AlertTitle>
                  <AlertDescription>
                    Your code is being analyzed using Claude API. This may take a few moments.
                    <Button 
                      as="a" 
                      href={`/analysis/${analysisId}`} 
                      size="sm" 
                      ml={4} 
                      colorScheme="blue"
                    >
                      View Status
                    </Button>
                  </AlertDescription>
                </Box>
              </Alert>
            </Box>
          )}
        </Box>
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
            Repository Ingested Successfully!
          </AlertTitle>
          <AlertDescription maxWidth="sm">
            The analysis is now in progress. Check the repository details page for the results.
          </AlertDescription>
          <Button
            mt={4}
            colorScheme="blue"
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
