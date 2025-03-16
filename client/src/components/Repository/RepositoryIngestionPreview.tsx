import React, { useState } from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  Code,
  Spinner,
  Badge,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { FiCopy, FiCheck, FiDownload, FiChevronRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

interface RepositoryData {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  url: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  ingestedContent?: {
    summary: string;
    tree: string;
    fullCode: string;
    fileCount: number;
    sizeInBytes: number;
  };
}

interface RepositoryIngestionPreviewProps {
  repository: RepositoryData;
  analysisId: string;
  onProceed: () => void;
  isPrivate?: boolean;
}

export function RepositoryIngestionPreview({
  repository,
  analysisId,
  onProceed,
  isPrivate = false,
}: RepositoryIngestionPreviewProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const codeBg = useColorModeValue('gray.50', 'gray.700');
  
  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Copy code to clipboard
  const copyToClipboard = () => {
    if (repository.ingestedContent?.fullCode) {
      navigator.clipboard.writeText(repository.ingestedContent.fullCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Download code as text file
  const downloadCode = () => {
    if (repository.ingestedContent?.fullCode) {
      const element = document.createElement('a');
      const file = new Blob([repository.ingestedContent.fullCode], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${repository.owner}-${repository.name}-code.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };
  
  // Proceed to analysis
  const handleProceed = () => {
    setLoading(true);
    setTimeout(() => {
      onProceed();
      navigate(`/repository/${repository.id}`);
    }, 1000);
  };
  
  if (!repository.ingestedContent) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading repository content...</Text>
      </Box>
    );
  }
  
  return (
    <Box 
      width="100%" 
      p={5}
      bg={bgColor}
      borderWidth="1px"
      borderRadius="lg"
      borderColor={borderColor}
      boxShadow="md"
    >
      <VStack spacing={6} align="stretch">
        <HStack justifyContent="space-between" alignItems="center">
          <Box>
            <Heading size="lg">{repository.name}</Heading>
            <Text color="gray.500">{repository.owner} • {repository.language}</Text>
          </Box>
          <HStack>
            <Badge colorScheme="blue">
              {repository.ingestedContent.fileCount} Files
            </Badge>
            <Badge colorScheme="green">
              {formatBytes(repository.ingestedContent.sizeInBytes)}
            </Badge>
            {isPrivate && (
              <Badge colorScheme="purple">Private</Badge>
            )}
          </HStack>
        </HStack>
        
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Text>
            Repository code has been successfully ingested. Review the code below before proceeding to analysis.
          </Text>
        </Alert>
        
        <Tabs 
          variant="enclosed" 
          colorScheme="blue" 
          onChange={(index) => setActiveTab(index)}
          isFitted
        >
          <TabList>
            <Tab>Repository Summary</Tab>
            <Tab>File Structure</Tab>
            <Tab>Full Code</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel>
              <Box 
                p={4} 
                bg={codeBg} 
                borderRadius="md" 
                whiteSpace="pre-wrap" 
                fontSize="sm"
                maxHeight="500px"
                overflowY="auto"
              >
                {repository.ingestedContent.summary}
              </Box>
            </TabPanel>
            
            <TabPanel>
              <Box 
                p={4} 
                bg={codeBg} 
                borderRadius="md" 
                whiteSpace="pre" 
                fontFamily="monospace" 
                fontSize="sm"
                maxHeight="500px"
                overflowY="auto"
              >
                {repository.ingestedContent.tree}
              </Box>
            </TabPanel>
            
            <TabPanel>
              <HStack mb={2} justifyContent="flex-end">
                <Tooltip label={copied ? "Copied!" : "Copy code"}>
                  <IconButton
                    aria-label="Copy code"
                    icon={copied ? <FiCheck /> : <FiCopy />}
                    size="sm"
                    onClick={copyToClipboard}
                    colorScheme={copied ? "green" : "gray"}
                  />
                </Tooltip>
                <Tooltip label="Download code">
                  <IconButton
                    aria-label="Download code"
                    icon={<FiDownload />}
                    size="sm"
                    onClick={downloadCode}
                  />
                </Tooltip>
              </HStack>
              <Box 
                p={4} 
                bg={codeBg} 
                borderRadius="md" 
                whiteSpace="pre" 
                fontFamily="monospace" 
                fontSize="sm"
                maxHeight="500px"
                overflowY="auto"
              >
                {repository.ingestedContent.fullCode}
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
        
        <Divider />
        
        <HStack justifyContent="flex-end">
          <Button
            rightIcon={<FiChevronRight />}
            colorScheme="blue"
            onClick={handleProceed}
            isLoading={loading}
            loadingText="Starting Analysis"
          >
            Proceed to Analysis
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
