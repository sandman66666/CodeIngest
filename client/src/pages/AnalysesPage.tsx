import {
  Badge,
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
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiAlertCircle, FiCheck, FiClock, FiSearch, FiXCircle } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { Pagination } from '@/components/Common/Pagination';

const ITEMS_PER_PAGE = 10;

interface Analysis {
  id: string;
  repositoryId: string;
  repository: {
    name: string;
    owner: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  insights: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
  vulnerabilities: Array<{
    severity: string;
    title: string;
    description: string;
  }>;
}

export function AnalysesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const tableBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Fetch analyses with filters and pagination
  const {
    data,
    isLoading,
    error,
  } = useQuery(
    ['analyses', page, status],
    () => apiClient.analysis.list(page, ITEMS_PER_PAGE),
    {
      select: (response) => response.data,
      keepPreviousData: true,
    }
  );

  // Filter and process analyses
  const analyses = data?.analyses || [];
  const filteredAnalyses = analyses
    .filter((analysis: Analysis) => {
      if (status !== 'all' && analysis.status !== status) {
        return false;
      }
      
      const searchTerm = search.toLowerCase();
      return (
        analysis.repository.name.toLowerCase().includes(searchTerm) ||
        analysis.repository.owner.toLowerCase().includes(searchTerm)
      );
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Icon as={FiCheck} color="green.500" />;
      case 'failed':
        return <Icon as={FiXCircle} color="red.500" />;
      case 'processing':
        return <Icon as={FiClock} color="blue.500" />;
      default:
        return <Icon as={FiClock} color="yellow.500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'green';
      default:
        return 'gray';
    }
  };

  if (error) {
    return (
      <Stack spacing={4} align="center" justify="center" h="full" py={16}>
        <Icon as={FiAlertCircle} boxSize={10} color="red.500" />
        <Text>Failed to load analyses</Text>
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
          <Heading size="lg">Code Analyses</Heading>
          <Text color="gray.500">
            View and manage your repository analyses
          </Text>
        </Stack>
      </Grid>

      <HStack spacing={4}>
        <InputGroup maxW={{ base: 'full', md: '320px' }}>
          <InputLeftElement>
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search analyses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          w={{ base: 'full', md: '200px' }}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </Select>
      </HStack>

      <Box
        bg={tableBg}
        rounded="lg"
        shadow="sm"
        borderWidth="1px"
        borderColor={borderColor}
        overflow="hidden"
      >
        <Table>
          <Thead>
            <Tr>
              <Th>Repository</Th>
              <Th>Status</Th>
              <Th>Insights</Th>
              <Th>Vulnerabilities</Th>
              <Th>Date</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              [...Array(ITEMS_PER_PAGE)].map((_, i) => (
                <Tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <Td key={j}>
                      <Box h="20px" w="100%" bg="gray.100" rounded="md" />
                    </Td>
                  ))}
                </Tr>
              ))
            ) : filteredAnalyses.length > 0 ? (
              filteredAnalyses.map((analysis: Analysis) => (
                <Tr key={analysis.id}>
                  <Td>
                    <Text fontWeight="medium">
                      {analysis.repository.owner}/{analysis.repository.name}
                    </Text>
                  </Td>
                  <Td>
                    <HStack>
                      {getStatusIcon(analysis.status)}
                      <Badge
                        colorScheme={
                          analysis.status === 'completed'
                            ? 'green'
                            : analysis.status === 'failed'
                            ? 'red'
                            : analysis.status === 'processing'
                            ? 'blue'
                            : 'yellow'
                        }
                      >
                        {analysis.status}
                      </Badge>
                    </HStack>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      {Object.entries(
                        analysis.insights.reduce((acc: any, insight) => {
                          acc[insight.severity] = (acc[insight.severity] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([severity, count]) => (
                        <Badge
                          key={severity}
                          colorScheme={getSeverityColor(severity)}
                        >
                          {count}
                        </Badge>
                      ))}
                    </HStack>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      {Object.entries(
                        analysis.vulnerabilities.reduce((acc: any, vuln) => {
                          acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([severity, count]) => (
                        <Badge
                          key={severity}
                          colorScheme={getSeverityColor(severity)}
                        >
                          {count}
                        </Badge>
                      ))}
                    </HStack>
                  </Td>
                  <Td>
                    <Text color="gray.500">
                      {new Date(analysis.createdAt).toLocaleDateString()}
                    </Text>
                  </Td>
                  <Td>
                    <Button
                      as={RouterLink}
                      to={`/analyses/${analysis.id}`}
                      size="sm"
                      variant="ghost"
                    >
                      View Details
                    </Button>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={6}>
                  <Stack align="center" spacing={4} py={8}>
                    <Icon as={FiSearch} boxSize={10} color="gray.400" />
                    <Text color="gray.500">No analyses found</Text>
                  </Stack>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      {data?.pagination && (
        <Box py={4}>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(data.pagination.total / ITEMS_PER_PAGE)}
            onPageChange={setPage}
          />
        </Box>
      )}
    </Stack>
  );
}
