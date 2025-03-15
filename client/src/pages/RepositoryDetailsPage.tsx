import {
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
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  FiAlertCircle,
  FiGithub,
  FiPlay,
  FiShare2,
} from 'react-icons/fi';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { FileTreeNavigator } from '@/components/Repository/FileTreeNavigator';
import { ShareModal } from '@/components/Common/ShareModal';
import { apiClient } from '@/lib/api';

interface Repository {
  id: string;
  name: string;
  owner: string;
  description: string;
  url: string;
  defaultBranch: string;
  lastAnalysis?: {
    id: string;
    status: string;
    createdAt: string;
  };
}

export function RepositoryDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const {
    isOpen: isShareModalOpen,
    onOpen: onShareModalOpen,
    onClose: onShareModalClose,
  } = useDisclosure();

  // Fetch repository details
  const { data: repository, isLoading } = useQuery<Repository>(
    ['repository', id],
    () => apiClient.repositories.get(id!).then((res) => res.data),
    {
      enabled: !!id,
    }
  );

  // Start analysis mutation
  const startAnalysis = useMutation(
    () => apiClient.analysis.start(id!),
    {
      onSuccess: (response) => {
        toast({
          title: 'Analysis started',
          description: 'The repository analysis has been initiated.',
          status: 'success',
          duration: 5000,
        });
      },
      onError: (error: any) => {
        toast({
          title: 'Failed to start analysis',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
      },
    }
  );

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Fetch file content when a file is selected
  const { data: fileContent } = useQuery(
    ['repository', id, 'file', selectedFile],
    () =>
      apiClient.repositories.getFileContent(id!, selectedFile!),
    {
      enabled: !!id && !!selectedFile,
    }
  );

  if (isLoading || !repository) {
    return (
      <Stack align="center" justify="center" h="full" py={16}>
        <Icon as={FiAlertCircle} boxSize={10} color="red.500" />
        <Text>Repository not found</Text>
        <Button
          as={RouterLink}
          to="/repositories"
          leftIcon={<Icon as={FiArrowLeft} />}
        >
          Back to Repositories
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
            <Icon as={FiGithub} />
            <Heading size="lg">
              {repository.owner}/{repository.name}
            </Heading>
          </HStack>
          <Text color="gray.500">{repository.description}</Text>
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
            leftIcon={<Icon as={FiPlay} />}
            onClick={() => startAnalysis.mutate()}
            isLoading={startAnalysis.isLoading}
            loadingText="Starting..."
          >
            Start Analysis
          </Button>
        </HStack>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '300px 1fr' }} gap={8}>
        {/* File Tree */}
        <Stack spacing={4}>
          <Card bg={cardBg}>
            <CardHeader>
              <Heading size="sm">Repository Files</Heading>
            </CardHeader>
            <CardBody p={0}>
              <FileTreeNavigator
                repositoryId={id!}
                onFileSelect={setSelectedFile}
                selectedPath={selectedFile}
              />
            </CardBody>
          </Card>
        </Stack>

        {/* Main Content */}
        <Stack spacing={6}>
          <Tabs>
            <TabList>
              <Tab>Overview</Tab>
              <Tab>Files</Tab>
              <Tab>Analyses</Tab>
            </TabList>

            <TabPanels>
              {/* Overview Panel */}
              <TabPanel>
                <Stack spacing={6}>
                  <Card>
                    <CardHeader>
                      <Heading size="sm">Repository Information</Heading>
                    </CardHeader>
                    <CardBody>
                      <Stack spacing={4}>
                        <HStack>
                          <Text fontWeight="medium">GitHub URL:</Text>
                          <Link
                            href={repository.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            color="brand.500"
                          >
                            {repository.url}
                          </Link>
                        </HStack>
                        <HStack>
                          <Text fontWeight="medium">Default Branch:</Text>
                          <Text>{repository.defaultBranch}</Text>
                        </HStack>
                        {repository.lastAnalysis && (
                          <HStack>
                            <Text fontWeight="medium">Last Analysis:</Text>
                            <Link
                              as={RouterLink}
                              to={`/analyses/${repository.lastAnalysis.id}`}
                              color="brand.500"
                            >
                              {new Date(
                                repository.lastAnalysis.createdAt
                              ).toLocaleDateString()}
                            </Link>
                          </HStack>
                        )}
                      </Stack>
                    </CardBody>
                  </Card>
                </Stack>
              </TabPanel>

              {/* Files Panel */}
              <TabPanel>
                <Card>
                  <CardBody>
                    {selectedFile ? (
                      <Stack spacing={4}>
                        <HStack justify="space-between">
                          <Text fontWeight="medium">{selectedFile}</Text>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedFile(null)}
                          >
                            Close
                          </Button>
                        </HStack>
                        <Box
                          p={4}
                          bg={useColorModeValue('gray.50', 'gray.700')}
                          borderRadius="md"
                          fontFamily="monospace"
                          fontSize="sm"
                          whiteSpace="pre-wrap"
                          overflowX="auto"
                        >
                          {fileContent}
                        </Box>
                      </Stack>
                    ) : (
                      <Text color="gray.500">
                        Select a file from the tree to view its contents
                      </Text>
                    )}
                  </CardBody>
                </Card>
              </TabPanel>

              {/* Analyses Panel */}
              <TabPanel>
                <Card>
                  <CardHeader>
                    <Heading size="sm">Analysis History</Heading>
                  </CardHeader>
                  <CardBody>
                    {/* Analysis history list component will go here */}
                  </CardBody>
                </Card>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Stack>
      </Grid>

      {/* Share Modal */}
      <ShareModal
        resourceId={id!}
        resourceType="repository"
        isOpen={isShareModalOpen}
        onClose={onShareModalClose}
      />
    </Stack>
  );
}
