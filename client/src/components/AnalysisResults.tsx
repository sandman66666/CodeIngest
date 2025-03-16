import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Heading,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  VStack,
  HStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  List,
  ListItem,
  useColorModeValue,
  Progress,
  Button,
} from '@chakra-ui/react';

interface AnalysisResultsProps {
  analysisId: string;
}

interface Component {
  name: string;
  description: string;
  responsibilities: string[];
}

interface Insight {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
}

interface AnalysisData {
  id: string;
  repositoryId: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
  results: Insight[] | null;
}

interface RepositoryData {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysisId }) => {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [repository, setRepository] = useState<RepositoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.200');

  const fetchAnalysis = useCallback(async () => {
    try {
      const response = await axios.get(`http://localhost:3030/api/analysis/${analysisId}`);
      setAnalysis(response.data.analysis);
      setRepository(response.data.repository);
      setError(null);
      
      // If analysis is still pending, continue polling
      if (response.data.analysis.status === 'pending') {
        setPollingCount(prev => prev + 1);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch analysis results');
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    fetchAnalysis();
    
    // Set up polling if analysis is pending
    const pollingInterval = setInterval(() => {
      if (analysis?.status === 'pending') {
        fetchAnalysis();
      } else {
        clearInterval(pollingInterval);
      }
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(pollingInterval);
  }, [analysisId, fetchAnalysis, analysis?.status]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'green';
      default:
        return 'blue';
    }
  };

  const renderAnalysisStatus = () => {
    if (!analysis) return null;
    
    switch (analysis.status) {
      case 'pending':
        return (
          <Box>
            <Alert status="info" mb={4}>
              <AlertIcon />
              <Box>
                <AlertTitle>Analysis in progress</AlertTitle>
                <AlertDescription>
                  Your code is being analyzed by Claude. This may take a few minutes depending on the size of the repository.
                </AlertDescription>
              </Box>
            </Alert>
            <Box mt={4} mb={6}>
              <Text mb={2} color={textColor} fontSize="sm">Analyzing code... {pollingCount > 2 ? `(This might take a few minutes for larger codebases)` : ''}</Text>
              <Progress size="sm" isIndeterminate colorScheme="blue" borderRadius="md" />
            </Box>
          </Box>
        );
      
      case 'failed':
        return (
          <Alert status="error" mb={6}>
            <AlertIcon />
            <Box>
              <AlertTitle>Analysis failed</AlertTitle>
              <AlertDescription>
                There was an error analyzing your code. Please try again later.
                <Button 
                  ml={4} 
                  size="sm" 
                  colorScheme="red"
                  onClick={() => window.location.href = '/'}
                >
                  Return Home
                </Button>
              </AlertDescription>
            </Box>
          </Alert>
        );
      
      case 'completed':
        return analysis.results && analysis.results.length > 0 ? (
          <Accordion allowMultiple defaultIndex={[0]} mt={6}>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left" fontWeight="bold">
                    Insights
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <VStack spacing={4} align="stretch">
                  {analysis.results.map((insight) => (
                    <Box 
                      key={insight.id} 
                      p={4} 
                      borderWidth="1px" 
                      borderRadius="md" 
                      borderColor={borderColor}
                      bg={bgColor}
                    >
                      <HStack mb={2}>
                        <Heading size="sm" color={textColor}>{insight.title}</Heading>
                        <Badge colorScheme={getSeverityColor(insight.severity)}>
                          {insight.severity}
                        </Badge>
                        <Badge colorScheme="purple">{insight.category}</Badge>
                      </HStack>
                      <Text color={textColor}>{insight.description}</Text>
                    </Box>
                  ))}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        ) : (
          <Alert status="warning" mb={6}>
            <AlertIcon />
            <AlertTitle>No insights found</AlertTitle>
            <AlertDescription>
              The analysis completed, but no insights were found.
            </AlertDescription>
          </Alert>
        );
      
      default:
        return null;
    }
  };

  if (loading && !analysis) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4} color={textColor}>Loading analysis results...</Text>
      </Box>
    );
  }

  if (error && !analysis) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Error!</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analysis) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>Not Found</AlertTitle>
        <AlertDescription>The requested analysis results could not be found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Box>
      <Box bg={bgColor} p={6} borderRadius="lg" borderWidth="1px" borderColor={borderColor} mb={6}>
        <Heading size="lg" mb={2} color={textColor}>
          Analysis Results: {repository?.owner}/{repository?.name}
        </Heading>
        {repository?.description && (
          <Text color="gray.500" mb={4}>
            {repository.description}
          </Text>
        )}

        <HStack spacing={4} mb={4}>
          <Badge colorScheme={analysis.status === 'completed' ? 'green' : analysis.status === 'pending' ? 'yellow' : 'red'}>
            Status: {analysis.status}
          </Badge>
          {repository?.language && (
            <Badge colorScheme="blue">
              Language: {repository.language}
            </Badge>
          )}
          <Badge colorScheme="gray">
            Created: {new Date(analysis.createdAt).toLocaleString()}
          </Badge>
          {analysis.completedAt && (
            <Badge colorScheme="gray">
              Completed: {new Date(analysis.completedAt).toLocaleString()}
            </Badge>
          )}
        </HStack>

        {renderAnalysisStatus()}
      </Box>
      
      <Box textAlign="center" mt={8}>
        <Button 
          colorScheme="blue" 
          variant="outline" 
          onClick={() => window.location.href = '/'}
        >
          Back to Home
        </Button>
      </Box>
    </Box>
  );
};

export default AnalysisResults;
