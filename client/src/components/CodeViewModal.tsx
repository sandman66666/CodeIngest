import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Box,
  Flex,
  Text,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { CopyIcon } from '@chakra-ui/icons';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface CodeViewModalProps {
  open: boolean;
  onClose: () => void;
  codeContent: string;
  repositoryName: string;
  fileTree?: FileNode[];
  summary?: string;
}

const CodeViewModal: React.FC<CodeViewModalProps> = ({
  open,
  onClose,
  codeContent,
  repositoryName,
  fileTree = [],
  summary = ''
}) => {
  const codeRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(0);
  
  const bg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const codeBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    if (open) {
      Prism.highlightAll();
      console.log("CodeViewModal opened with fileTree:", fileTree); // Debug log
    }
  }, [open, codeContent, fileTree]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(codeContent)
      .then(() => {
        toast({
          title: 'Code copied',
          description: 'The code has been copied to your clipboard',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      })
      .catch(err => {
        toast({
          title: 'Failed to copy',
          description: 'An error occurred while copying the code',
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
      });
  };

  const renderFileTree = (nodes: any, depth = 0) => {
    // Return early for invalid input
    if (!nodes) {
      return <Text color={textColor}>No file structure available</Text>;
    }
    
    // Handle different data structures
    let itemsToRender = [];
    
    if (Array.isArray(nodes)) {
      itemsToRender = nodes;
    } else if (typeof nodes === 'object') {
      // If it's a single object, wrap it in an array
      if (nodes.name || nodes.path) {
        itemsToRender = [nodes];
      } else {
        // Try to get values if it's an object map
        itemsToRender = Object.values(nodes);
      }
    } else {
      return <Text color={textColor}>Invalid file structure format</Text>;
    }
    
    if (itemsToRender.length === 0) {
      return <Text color={textColor}>Empty file structure</Text>;
    }
    
    return (
      <Box ml={depth * 4}>
        {itemsToRender.map((node, index) => (
          <Box key={index}>
            <Text 
              fontWeight={node.type === 'directory' ? 'bold' : 'normal'}
              color={textColor}
              my={1}
            >
              {node.type === 'directory' ? '📁 ' : '📄 '}
              {node.name || node.path || 'Unknown'}
            </Text>
            {node.children && renderFileTree(node.children, depth + 1)}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="full">
      <ModalOverlay />
      <ModalContent h="90vh" bg={bg}>
        <ModalHeader color={textColor}>
          {repositoryName} - Full Code View
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody overflow="auto">
          <Tabs variant="enclosed" colorScheme="blue" onChange={setActiveTab}>
            <TabList>
              <Tab color={textColor}>Code</Tab>
              <Tab color={textColor}>File Structure</Tab>
              <Tab color={textColor}>Summary</Tab>
            </TabList>
            <TabPanels>
              <TabPanel p={0} pt={4}>
                <Flex justify="flex-end" mb={2}>
                  <Tooltip label="Copy code">
                    <IconButton
                      aria-label="Copy code"
                      icon={<CopyIcon />}
                      onClick={copyToClipboard}
                      size="sm"
                    />
                  </Tooltip>
                </Flex>
                <Box 
                  ref={codeRef}
                  bg={codeBg} 
                  p={4} 
                  borderRadius="md" 
                  overflow="auto" 
                  h="calc(100% - 40px)"
                  borderWidth="1px"
                  borderColor={borderColor}
                  color={textColor}
                  className="code-container"
                >
                  <pre style={{ color: textColor }}>
                    <code className="language-typescript">
                      {codeContent}
                    </code>
                  </pre>
                </Box>
              </TabPanel>
              <TabPanel>
                <Box 
                  p={4} 
                  overflowY="auto" 
                  maxHeight="60vh"
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="md"
                >
                  {fileTree ? (
                    renderFileTree(fileTree)
                  ) : (
                    <Text color={textColor}>No file structure available</Text>
                  )}
                </Box>
              </TabPanel>
              <TabPanel>
                <Box
                  overflow="auto"
                  h="100%"
                  p={4}
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="md"
                >
                  <Text whiteSpace="pre-wrap" color={textColor}>
                    {summary || 'No summary available'}
                  </Text>
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CodeViewModal;
