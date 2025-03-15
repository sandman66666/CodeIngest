import {
  Box,
  Button,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  FiChevronDown,
  FiChevronRight,
  FiFile,
  FiFolder,
  FiSearch,
} from 'react-icons/fi';
import { apiClient } from '@/lib/api';

interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileTreeNode[];
  size?: number;
}

interface FileTreeNodeProps {
  node: FileTreeNode;
  level: number;
  onSelect: (node: FileTreeNode) => void;
  selectedPath?: string;
}

interface FileTreeNavigatorProps {
  repositoryId: string;
  onFileSelect?: (path: string | null) => void;
  selectedPath?: string;
}

function FileTreeNodeComponent({
  node,
  level,
  onSelect,
  selectedPath,
}: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');
  const isSelected = node.path === selectedPath;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(node);
    }
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Stack spacing={0}>
      <HStack
        py={2}
        px={4}
        spacing={2}
        cursor="pointer"
        onClick={handleClick}
        bg={isSelected ? bg : 'transparent'}
        _hover={{ bg: hoverBg }}
        borderRadius="md"
      >
        <Box pl={`${level * 20}px`}>
          {node.type === 'directory' ? (
            <Icon
              as={isExpanded ? FiChevronDown : FiChevronRight}
              color="gray.500"
            />
          ) : (
            <Box w="16px" />
          )}
        </Box>
        <Icon
          as={node.type === 'directory' ? FiFolder : FiFile}
          color={node.type === 'directory' ? 'yellow.400' : 'blue.400'}
        />
        <Text flex="1" fontSize="sm">
          {node.name}
        </Text>
        {node.size && (
          <Text fontSize="xs" color="gray.500">
            {formatSize(node.size)}
          </Text>
        )}
      </HStack>
      {isExpanded && node.children && (
        <Stack spacing={0}>
          {node.children.map((child) => (
            <FileTreeNodeComponent
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function FileTreeNavigator({
  repositoryId,
  onFileSelect,
  selectedPath,
}: FileTreeNavigatorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const { data: fileTree, isLoading } = useQuery(
    ['repository', repositoryId, 'files'],
    () => apiClient.repositories.getFileTree(repositoryId),
    {
      select: (response) => response.data,
    }
  );

  const filterTree = (
    node: FileTreeNode,
    query: string
  ): FileTreeNode | null => {
    if (node.name.toLowerCase().includes(query.toLowerCase())) {
      return node;
    }

    if (node.children) {
      const filteredChildren = node.children
        .map((child) => filterTree(child, query))
        .filter((child): child is FileTreeNode => child !== null);

      if (filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
    }

    return null;
  };

  const filteredTree = searchQuery && fileTree
    ? filterTree(fileTree, searchQuery)
    : fileTree;

  const handleSelect = (node: FileTreeNode) => {
    if (node.type === 'file') {
      onFileSelect?.(node.path);
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h="200px">
        <Spinner />
      </Stack>
    );
  }

  return (
    <Stack
      spacing={4}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
    >
      <InputGroup size="sm">
        <InputLeftElement>
          <Icon as={FiSearch} color="gray.500" />
        </InputLeftElement>
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </InputGroup>

      <Box overflowY="auto" maxH="500px">
        {filteredTree ? (
          <FileTreeNodeComponent
            node={filteredTree}
            level={0}
            onSelect={handleSelect}
            selectedPath={selectedPath}
          />
        ) : (
          <Stack align="center" justify="center" h="200px" spacing={4}>
            <Text color="gray.500">No files found</Text>
            {searchQuery && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </Button>
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
