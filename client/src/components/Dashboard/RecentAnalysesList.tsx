import {
  Badge,
  Box,
  Icon,
  Link,
  Skeleton,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiAlertCircle, FiCheck, FiClock, FiXCircle } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

interface Analysis {
  id: string;
  repositoryId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  insights: Array<{ type: string }>;
  vulnerabilities: Array<{ severity: string }>;
}

interface RecentAnalysesListProps {
  analyses: Analysis[];
  isLoading: boolean;
}

export function RecentAnalysesList({ analyses, isLoading }: RecentAnalysesListProps) {
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  if (isLoading) {
    return (
      <Stack spacing={4}>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height="60px" rounded="md" />
        ))}
      </Stack>
    );
  }

  if (!analyses.length) {
    return (
      <Stack align="center" spacing={4} py={8}>
        <Icon as={FiClock} boxSize={10} color="gray.400" />
        <Text color="gray.500">No analyses yet</Text>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {analyses.map((analysis) => (
        <Link
          key={analysis.id}
          as={RouterLink}
          to={`/analyses/${analysis.id}`}
          _hover={{ textDecoration: 'none' }}
        >
          <Box
            p={4}
            rounded="md"
            _hover={{ bg: hoverBg }}
            transition="background-color 0.2s"
          >
            <Stack spacing={2}>
              <Stack direction="row" justify="space-between" align="center">
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
                  display="flex"
                  alignItems="center"
                >
                  <Icon
                    as={
                      analysis.status === 'completed'
                        ? FiCheck
                        : analysis.status === 'failed'
                        ? FiXCircle
                        : analysis.status === 'processing'
                        ? FiClock
                        : FiAlertCircle
                    }
                    mr={1}
                  />
                  {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
                </Badge>
                <Text fontSize="sm" color="gray.500">
                  {new Date(analysis.createdAt).toLocaleDateString()}
                </Text>
              </Stack>

              <Stack direction="row" spacing={4}>
                <Text fontSize="sm">
                  Insights: {analysis.insights?.length || 0}
                </Text>
                <Text fontSize="sm" color="red.500">
                  Vulnerabilities: {analysis.vulnerabilities?.length || 0}
                </Text>
              </Stack>
            </Stack>
          </Box>
        </Link>
      ))}
    </Stack>
  );
}
