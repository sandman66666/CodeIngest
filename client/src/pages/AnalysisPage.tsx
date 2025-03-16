import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Container, Heading, Divider } from '@chakra-ui/react';
import AnalysisResults from '../components/AnalysisResults';

const AnalysisPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId: string }>();

  if (!analysisId) {
    return (
      <Container maxW="container.xl" py={8}>
        <Heading as="h1" mb={6}>Analysis Results</Heading>
        <Box p={4} borderWidth="1px" borderRadius="lg">
          No analysis ID provided.
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <Heading as="h1" mb={6}>Analysis Results</Heading>
      <Divider mb={6} />
      <AnalysisResults analysisId={analysisId} />
    </Container>
  );
};

export default AnalysisPage;
