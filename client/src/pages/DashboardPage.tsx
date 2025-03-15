import {
  Box,
  Button,
  Grid,
  Heading,
  Icon,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiGitBranch, FiStar } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  language: string;
}

export function DashboardPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cardBg = useColorModeValue('white', 'gray.800');
  const { user } = useAuth();

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/repos', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data.data);
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <VStack spacing={8} align="stretch">
      <Box>
        <Heading size="lg">Welcome, {user?.name}</Heading>
        <Text mt={2} color="gray.500">
          Select a repository to analyze with AI
        </Text>
      </Box>

      <Grid
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
        }}
        gap={6}
      >
        {repositories.map((repo) => (
          <Box
            key={repo.id}
            p={6}
            bg={cardBg}
            rounded="lg"
            shadow="sm"
            borderWidth={1}
            transition="all 0.2s"
            _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
          >
            <VStack align="stretch" spacing={4}>
              <Heading size="md" noOfLines={1}>
                {repo.name}
              </Heading>
              {repo.description && (
                <Text color="gray.500" noOfLines={2}>
                  {repo.description}
                </Text>
              )}
              <Box>
                {repo.language && (
                  <Text fontSize="sm" color="gray.500">
                    {repo.language}
                  </Text>
                )}
                <Text fontSize="sm" color="gray.500">
                  <Icon as={FiStar} mr={1} />
                  {repo.stars} stars
                </Text>
              </Box>
              <Button
                as={RouterLink}
                to={`/repository/${repo.fullName}`}
                leftIcon={<Icon as={FiGitBranch} />}
                size="sm"
                width="full"
              >
                Analyze Repository
              </Button>
            </VStack>
          </Box>
        ))}
      </Grid>
    </VStack>
  );
}
