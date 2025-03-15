import {
  Box,
  Button,
  Center,
  Heading,
  Icon,
  Stack,
  Text,
  useColorModeValue,
  Divider,
  VStack,
} from '@chakra-ui/react';
import { FiGithub } from 'react-icons/fi';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PublicRepositoryIngest } from '../components/PublicRepositoryIngest';

export function LoginPage() {
  const { user, login } = useAuth();
  const bg = useColorModeValue('white', 'gray.800');

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Center minH="calc(100vh - 4rem)">
      <VStack 
        spacing={8} 
        align="center" 
        maxW="md"
        w="full"
        px={4}
      >
        <Box
          bg={bg}
          p={8}
          rounded="xl"
          shadow="lg"
          w="full"
          textAlign="center"
        >
          <Stack spacing={6}>
            <Stack spacing={2}>
              <Heading size="lg">Welcome to CodeInsight</Heading>
              <Text color="gray.500">
                Enhance your code understanding with AI-powered analysis
              </Text>
            </Stack>

            <Button
              size="lg"
              leftIcon={<Icon as={FiGithub} boxSize={5} />}
              onClick={login}
              colorScheme="blue"
            >
              Continue with GitHub
            </Button>

            <Text fontSize="sm" color="gray.500">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </Stack>
        </Box>
        
        <PublicRepositoryIngest />
      </VStack>
    </Center>
  );
}
