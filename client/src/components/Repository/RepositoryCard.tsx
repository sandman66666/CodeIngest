import {
  Badge,
  Box,
  Button,
  HStack,
  Icon,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiGitBranch, FiGithub, FiSearch } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface Repository {
  id: string;
  name: string;
  owner: string;
  description: string;
  private: boolean;
  lastAnalysis?: {
    id: string;
    status: string;
    createdAt: string;
  };
}

interface RepositoryCardProps {
  repository: Repository;
}

export function RepositoryCard({ repository }: RepositoryCardProps) {
  const queryClient = useQueryClient();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Start analysis mutation
  const startAnalysis = useMutation(
    () => apiClient.analysis.start(repository.id),
    {
      onSuccess: () => {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries(['repositories']);
        queryClient.invalidateQueries(['analyses']);
      },
    }
  );

  return (
    <Box
      bg={cardBg}
      border="1px"
      borderColor={borderColor}
      rounded="lg"
      overflow="hidden"
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-2px)',
        shadow: 'md',
      }}
    >
      <Stack spacing={4} p={4}>
        <Stack spacing={2}>
          <HStack justify="space-between">
            <Text
              as={RouterLink}
              to={`/repositories/${repository.id}`}
              fontWeight="semibold"
              _hover={{ color: 'brand.500' }}
            >
              {repository.name}
            </Text>
            <Badge
              colorScheme={repository.private ? 'red' : 'green'}
              variant="subtle"
            >
              {repository.private ? 'Private' : 'Public'}
            </Badge>
          </HStack>

          <Text
            fontSize="sm"
            color="gray.500"
            noOfLines={2}
          >
            {repository.description || 'No description provided'}
          </Text>
        </Stack>

        <Stack spacing={3}>
          <HStack fontSize="sm">
            <Icon as={FiGithub} />
            <Text>{repository.owner}</Text>
          </HStack>

          {repository.lastAnalysis && (
            <HStack fontSize="sm">
              <Icon as={FiGitBranch} />
              <Text>
                Last analyzed:{' '}
                {new Date(repository.lastAnalysis.createdAt).toLocaleDateString()}
              </Text>
              <Badge colorScheme={
                repository.lastAnalysis.status === 'completed'
                  ? 'green'
                  : repository.lastAnalysis.status === 'failed'
                  ? 'red'
                  : 'yellow'
              }>
                {repository.lastAnalysis.status}
              </Badge>
            </HStack>
          )}
        </Stack>

        <Stack direction="row" spacing={2}>
          <Button
            as={RouterLink}
            to={`/repositories/${repository.id}`}
            variant="ghost"
            size="sm"
            leftIcon={<Icon as={FiGitBranch} />}
            flex={1}
          >
            View
          </Button>
          <Button
            size="sm"
            leftIcon={<Icon as={FiSearch} />}
            isLoading={startAnalysis.isLoading}
            onClick={() => startAnalysis.mutate()}
            flex={1}
          >
            Analyze
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
