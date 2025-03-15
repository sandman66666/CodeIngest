import {
  Box,
  Container,
  Heading,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';

export function RepositoryPage() {
  const { owner, name } = useParams();

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Heading size="lg">
          {owner}/{name}
        </Heading>
        <Box p={6} borderWidth={1} rounded="lg">
          <Text>Analysis in progress...</Text>
        </Box>
      </VStack>
    </Container>
  );
}
