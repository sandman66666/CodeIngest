import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Grid,
  Heading,
  HStack,
  Icon,
  Link,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiShield,
  FiShieldOff,
} from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { apiClient } from '@/lib/api';

interface SecurityIssue {
  id: string;
  analysisId: string;
  repository: {
    id: string;
    name: string;
    owner: string;
  };
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  line?: number;
  cwe?: string;
  recommendation: string;
  createdAt: string;
}

export function SecurityPage() {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Fetch security issues across all analyses
  const { data, isLoading, error } = useQuery(
    ['security-issues'],
    async () => {
      const analyses = await apiClient.analysis.list(1, 100).then(res => res.data.analyses);
      return analyses.reduce((issues: SecurityIssue[], analysis: any) => {
        const vulnerabilities = analysis.vulnerabilities.map((vuln: any) => ({
          id: `${analysis.id}-${vuln.id}`,
          analysisId: analysis.id,
          repository: analysis.repository,
          ...vuln,
        }));
        return [...issues, ...vulnerabilities];
      }, []);
    }
  );

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

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return FiAlertCircle;
      case 'medium':
        return FiAlertTriangle;
      case 'low':
        return FiShieldOff;
      default:
        return FiShield;
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h="full" py={16}>
        <Spinner size="xl" color="brand.500" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack align="center" justify="center" h="full" py={16}>
        <Icon as={FiAlertCircle} boxSize={10} color="red.500" />
        <Text>Failed to load security issues</Text>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Stack>
    );
  }

  const issues = data || [];
  const severityCounts = issues.reduce((acc: Record<string, number>, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <Stack spacing={8}>
      <Grid
        templateColumns={{ base: '1fr', md: '1fr auto' }}
        gap={4}
        alignItems="flex-start"
      >
        <Stack spacing={1}>
          <Heading size="lg">Security Overview</Heading>
          <Text color="gray.500">
            Comprehensive view of security vulnerabilities across all repositories
          </Text>
        </Stack>
      </Grid>

      {/* Security Summary */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
        {['critical', 'high', 'medium', 'low'].map((severity) => (
          <Card
            key={severity}
            bg={cardBg}
            borderWidth="1px"
            borderColor={
              severityCounts[severity] > 0
                ? `${getSeverityColor(severity)}.500`
                : borderColor
            }
          >
            <CardBody>
              <Stack spacing={4}>
                <HStack>
                  <Icon
                    as={getSeverityIcon(severity)}
                    color={`${getSeverityColor(severity)}.500`}
                    boxSize={6}
                  />
                  <Text
                    textTransform="capitalize"
                    fontWeight="medium"
                    color={`${getSeverityColor(severity)}.500`}
                  >
                    {severity}
                  </Text>
                </HStack>
                <Heading size="2xl">{severityCounts[severity] || 0}</Heading>
              </Stack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Security Issues List */}
      <Card bg={cardBg}>
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="md">Security Issues</Heading>
            <Select
              w="200px"
              defaultValue="all"
              onChange={(e) => {
                // TODO: Implement filtering by severity
              }}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </HStack>
        </CardHeader>
        <CardBody>
          <Stack spacing={4}>
            {issues.length > 0 ? (
              issues.map((issue) => (
                <Box
                  key={issue.id}
                  p={4}
                  borderWidth="1px"
                  borderColor={borderColor}
                  rounded="lg"
                >
                  <Stack spacing={4}>
                    <HStack justify="space-between">
                      <HStack>
                        <Badge
                          colorScheme={getSeverityColor(issue.severity)}
                          display="flex"
                          alignItems="center"
                          px={2}
                          py={1}
                        >
                          <Icon
                            as={getSeverityIcon(issue.severity)}
                            mr={1}
                          />
                          {issue.severity}
                        </Badge>
                        <Text fontWeight="medium">{issue.title}</Text>
                      </HStack>
                      <Link
                        as={RouterLink}
                        to={`/analyses/${issue.analysisId}`}
                        color="brand.500"
                      >
                        View Analysis
                      </Link>
                    </HStack>

                    <Stack spacing={2}>
                      <Text color="gray.500">
                        {issue.repository.owner}/{issue.repository.name}
                      </Text>
                      <Text>{issue.description}</Text>
                      {issue.file && (
                        <Text fontSize="sm" color="gray.500">
                          Location: {issue.file}:{issue.line}
                        </Text>
                      )}
                    </Stack>

                    <Box
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      p={4}
                      rounded="md"
                    >
                      <Stack spacing={2}>
                        <Text fontWeight="medium">Recommendation</Text>
                        <Text>{issue.recommendation}</Text>
                      </Stack>
                    </Box>

                    {issue.cwe && (
                      <Link
                        href={`https://cwe.mitre.org/data/definitions/${issue.cwe}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="brand.500"
                        fontSize="sm"
                      >
                        Learn more about CWE-{issue.cwe}
                      </Link>
                    )}
                  </Stack>
                </Box>
              ))
            ) : (
              <Stack align="center" spacing={4} py={8}>
                <Icon as={FiShield} boxSize={10} color="green.500" />
                <Text>No security issues found</Text>
                <Text color="gray.500">
                  All your repositories are currently secure
                </Text>
              </Stack>
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
