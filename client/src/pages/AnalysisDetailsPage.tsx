import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiDownload,
  FiGitBranch,
  FiGithub,
  FiShare2,
  FiTrash2,
  FiXCircle,
} from 'react-icons/fi';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { ExportOptions } from '@/components/Analysis/ExportOptions';
import { ShareModal } from '@/components/Common/ShareModal';

interface Analysis {
  id: string;
  repositoryId: string;
  repository: {
    name: string;
    owner: string;
    url: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  specifications: {
    overview: string;
    architecture: string;
    components: Array<{
      name: string;
      description: string;
      responsibility: string;
    }>;
  };
  insights: Array<{
    type: string;
    severity: string;
    message: string;
    file?: string;
    line?: number;
    recommendation?: string;
  }>;
  vulnerabilities: Array<{
    severity: string;
    title: string;
    description: string;
    file?: string;
    line?: number;
    recommendation: string;
    cwe?: string;
  }>;
}

export function AnalysisDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const {
    isOpen: isExportModalOpen,
    onOpen: onExportModalOpen,
    onClose: onExportModalClose,
  } = useDisclosure();
  const {
    isOpen: isShareModalOpen,
    onOpen: onShareModalOpen,
    onClose: onShareModalClose,
  } = useDisclosure();

  // Fetch analysis details
  const { data: analysis, isLoading } = useQuery<Analysis>(
    ['analysis', id],
    () => apiClient.analysis.get(id!).then((res) => res.data),
    {
      enabled: !!id,
    }
  );

  // Delete analysis mutation
  const deleteAnalysis = useMutation(
    () => apiClient.analysis.delete(id!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['analyses']);
        toast({
          title: 'Analysis deleted',
          status: 'success',
          duration: 5000,
        });
        navigate('/analyses');
      },
      onError: (error: any) => {
        toast({
          title: 'Error deleting analysis',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
      },
    }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'processing':
        return 'blue';
      default:
        return 'yellow';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return FiCheck;
      case 'failed':
        return FiXCircle;
      case 'processing':
        return FiClock;
      default:
        return FiClock;
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

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h="full" py={16}>
        <Spinner size="xl" color="brand.500" />
      </Stack>
    );
  }

  if (!analysis) {
    return (
      <Stack align="center" justify="center" h="full" py={16}>
        <Icon as={FiAlertCircle} boxSize={10} color="red.500" />
        <Text>Analysis not found</Text>
        <Button
          as={RouterLink}
          to="/analyses"
          leftIcon={<Icon as={FiArrowLeft} />}
        >
          Back to Analyses
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
          <HStack>
            <Button
              as={RouterLink}
              to="/analyses"
              variant="ghost"
              leftIcon={<Icon as={FiArrowLeft} />}
              size="sm"
            >
              Back
            </Button>
            <Heading size="lg">Analysis Details</Heading>
          </HStack>
          <Text color="gray.500">
            Detailed analysis results and insights
          </Text>
        </Stack>

        <HStack>
          <Button
            leftIcon={<Icon as={FiShare2} />}
            variant="ghost"
            onClick={onShareModalOpen}
          >
            Share
          </Button>
          <Button
            leftIcon={<Icon as={FiDownload} />}
            onClick={onExportModalOpen}
          >
            Export
          </Button>
          <Button
            colorScheme="red"
            variant="ghost"
            leftIcon={<Icon as={FiTrash2} />}
            onClick={() => deleteAnalysis.mutate()}
            isLoading={deleteAnalysis.isLoading}
          >
            Delete Analysis
          </Button>
        </HStack>
      </Grid>

      {/* Analysis Overview */}
      <Card bg={cardBg}>
        <CardHeader>
          <Stack spacing={4}>
            <HStack justify="space-between">
              <Stack>
                <HStack>
                  <Icon as={FiGithub} />
                  <Link
                    href={analysis.repository.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    fontWeight="semibold"
                  >
                    {analysis.repository.owner}/{analysis.repository.name}
                  </Link>
                </HStack>
                <HStack>
                  <Icon as={getStatusIcon(analysis.status)} />
                  <Badge colorScheme={getStatusColor(analysis.status)}>
                    {analysis.status}
                  </Badge>
                  <Text color="gray.500">
                    Started: {new Date(analysis.createdAt).toLocaleString()}
                  </Text>
                  {analysis.completedAt && (
                    <Text color="gray.500">
                      Completed: {new Date(analysis.completedAt).toLocaleString()}
                    </Text>
                  )}
                </HStack>
              </Stack>

              <Button
                as={RouterLink}
                to={`/repositories/${analysis.repositoryId}`}
                leftIcon={<Icon as={FiGitBranch} />}
                variant="ghost"
              >
                View Repository
              </Button>
            </HStack>
          </Stack>
        </CardHeader>
      </Card>

      {/* Analysis Results */}
      <Tabs>
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Insights ({analysis.insights.length})</Tab>
          <Tab>Vulnerabilities ({analysis.vulnerabilities.length})</Tab>
          <Tab>Specifications</Tab>
        </TabList>

        <TabPanels>
          {/* Overview Panel */}
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
              <Card>
                <CardHeader>
                  <Heading size="sm">Total Insights</Heading>
                </CardHeader>
                <CardBody>
                  <HStack spacing={4}>
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
                        {severity}: {count}
                      </Badge>
                    ))}
                  </HStack>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Heading size="sm">Security Issues</Heading>
                </CardHeader>
                <CardBody>
                  <HStack spacing={4}>
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
                        {severity}: {count}
                      </Badge>
                    ))}
                  </HStack>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Insights Panel */}
          <TabPanel>
            <Accordion allowMultiple>
              {analysis.insights.map((insight, index) => (
                <AccordionItem key={index}>
                  <AccordionButton>
                    <HStack flex="1" spacing={4}>
                      <Badge colorScheme={getSeverityColor(insight.severity)}>
                        {insight.severity}
                      </Badge>
                      <Text fontWeight="medium">{insight.message}</Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel>
                    <Stack spacing={4}>
                      {insight.file && (
                        <HStack>
                          <Text fontWeight="semibold">Location:</Text>
                          <Text>{insight.file}:{insight.line}</Text>
                        </HStack>
                      )}
                      {insight.recommendation && (
                        <Box>
                          <Text fontWeight="semibold">Recommendation:</Text>
                          <Text mt={2}>{insight.recommendation}</Text>
                        </Box>
                      )}
                    </Stack>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </TabPanel>

          {/* Vulnerabilities Panel */}
          <TabPanel>
            <Accordion allowMultiple>
              {analysis.vulnerabilities.map((vuln, index) => (
                <AccordionItem key={index}>
                  <AccordionButton>
                    <HStack flex="1" spacing={4}>
                      <Badge colorScheme={getSeverityColor(vuln.severity)}>
                        {vuln.severity}
                      </Badge>
                      <Text fontWeight="medium">{vuln.title}</Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel>
                    <Stack spacing={4}>
                      <Text>{vuln.description}</Text>
                      {vuln.file && (
                        <HStack>
                          <Text fontWeight="semibold">Location:</Text>
                          <Text>{vuln.file}:{vuln.line}</Text>
                        </HStack>
                      )}
                      <Box>
                        <Text fontWeight="semibold">Recommendation:</Text>
                        <Text mt={2}>{vuln.recommendation}</Text>
                      </Box>
                      {vuln.cwe && (
                        <Link
                          href={`https://cwe.mitre.org/data/definitions/${vuln.cwe}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="brand.500"
                        >
                          Learn more about CWE-{vuln.cwe}
                        </Link>
                      )}
                    </Stack>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </TabPanel>

          {/* Specifications Panel */}
          <TabPanel>
            <Stack spacing={6}>
              <Card>
                <CardHeader>
                  <Heading size="sm">Project Overview</Heading>
                </CardHeader>
                <CardBody>
                  <Text whiteSpace="pre-wrap">{analysis.specifications.overview}</Text>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Heading size="sm">Architecture</Heading>
                </CardHeader>
                <CardBody>
                  <Text whiteSpace="pre-wrap">{analysis.specifications.architecture}</Text>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Heading size="sm">Components</Heading>
                </CardHeader>
                <CardBody>
                  <Stack spacing={4}>
                    {analysis.specifications.components.map((component, index) => (
                      <Box
                        key={index}
                        p={4}
                        borderWidth="1px"
                        borderColor={borderColor}
                        rounded="md"
                      >
                        <Stack spacing={2}>
                          <Heading size="sm">{component.name}</Heading>
                          <Text>{component.description}</Text>
                          <Text fontStyle="italic" color="gray.500">
                            Responsibility: {component.responsibility}
                          </Text>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </CardBody>
              </Card>
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Export Modal */}
      <ExportOptions
        analysisId={id!}
        isOpen={isExportModalOpen}
        onClose={onExportModalClose}
      />

      {/* Share Modal */}
      <ShareModal
        resourceId={id!}
        resourceType="analysis"
        isOpen={isShareModalOpen}
        onClose={onShareModalClose}
      />
    </Stack>
  );
}
