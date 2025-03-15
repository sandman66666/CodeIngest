import {
  Box,
  Button,
  Grid,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiGitBranch, FiSearch } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { RepositoryCard } from '@/components/Repository/RepositoryCard';
import { AddRepositoryModal } from '@/components/Repository/AddRepositoryModal';
import { Pagination } from '@/components/Common/Pagination';

const ITEMS_PER_PAGE = 12;

export function RepositoriesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Fetch repositories with search and pagination
  const {
    data,
    isLoading,
    error,
  } = useQuery(
    ['repositories', page, search, sort],
    () => apiClient.repositories.list(page, ITEMS_PER_PAGE),
    {
      select: (response) => response.data,
      keepPreviousData: true,
    }
  );

  // Filter and sort repositories
  const repositories = data?.repositories || [];
  const filteredRepositories = repositories
    .filter((repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.description?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sort === 'lastAnalyzed') {
        const aDate = a.lastAnalysis?.createdAt || '0';
        const bDate = b.lastAnalysis?.createdAt || '0';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      return 0;
    });

  if (error) {
    return (
      <Stack spacing={4} align="center" justify="center" h="full" py={16}>
        <Icon as={FiGitBranch} boxSize={10} color="red.500" />
        <Text>Failed to load repositories</Text>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={8}>
      <Grid
        templateColumns={{ base: '1fr', md: '1fr auto' }}
        gap={4}
        alignItems="flex-start"
      >
        <Stack spacing={1}>
          <Heading size="lg">Repositories</Heading>
          <Text color="gray.500">
            Manage and analyze your GitHub repositories
          </Text>
        </Stack>

        <Button
          leftIcon={<Icon as={FiGitBranch} />}
          onClick={onOpen}
        >
          Add Repository
        </Button>
      </Grid>

      <HStack spacing={4}>
        <InputGroup maxW={{ base: 'full', md: '320px' }}>
          <InputLeftElement>
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>

        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          w={{ base: 'full', md: '200px' }}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name</option>
          <option value="lastAnalyzed">Last Analyzed</option>
        </Select>
      </HStack>

      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
            <Skeleton key={i} height="200px" rounded="lg" />
          ))}
        </SimpleGrid>
      ) : filteredRepositories.length > 0 ? (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {filteredRepositories.map((repository) => (
              <RepositoryCard
                key={repository.id}
                repository={repository}
              />
            ))}
          </SimpleGrid>

          <Box py={4}>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil((data?.pagination.total || 0) / ITEMS_PER_PAGE)}
              onPageChange={setPage}
            />
          </Box>
        </>
      ) : (
        <Stack spacing={4} align="center" justify="center" py={16}>
          <Icon as={FiGitBranch} boxSize={10} color="gray.400" />
          <Text color="gray.500">No repositories found</Text>
          <Button onClick={onOpen}>
            Add Repository
          </Button>
        </Stack>
      )}

      <AddRepositoryModal
        isOpen={isOpen}
        onClose={onClose}
      />
    </Stack>
  );
}
