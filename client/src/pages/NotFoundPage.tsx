import {
  Button,
  Container,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react';
import { FiArrowLeft, FiHome } from 'react-icons/fi';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Container maxW="container.md" py={16}>
      <Stack spacing={8} align="center" textAlign="center">
        <Heading size="4xl">404</Heading>
        <Stack spacing={4}>
          <Heading size="xl">Page Not Found</Heading>
          <Text color="gray.500">
            The page you're looking for doesn't exist or has been moved.
          </Text>
        </Stack>

        <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Button
            as={RouterLink}
            to="/"
            leftIcon={<Icon as={FiHome} />}
            colorScheme="brand"
          >
            Return Home
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
