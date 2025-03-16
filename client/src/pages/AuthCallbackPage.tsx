import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Spinner, Center, VStack, Text, useToast } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const { handleAuthCallback } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    async function processCallback() {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const errorParam = params.get('error');

      if (errorParam) {
        setError(errorParam);
        toast({
          title: 'Authentication Failed',
          description: `Error: ${errorParam}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!token) {
        setError('No authentication token received');
        toast({
          title: 'Authentication Failed',
          description: 'No token received from GitHub',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        await handleAuthCallback(token);
        toast({
          title: 'Authentication Successful',
          description: 'You have successfully logged in with GitHub.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        navigate('/');
      } catch (err) {
        setError('Failed to authenticate');
        toast({
          title: 'Authentication Failed',
          description: 'Could not complete the authentication process.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setTimeout(() => navigate('/login'), 3000);
      }
    }

    processCallback();
  }, [location, navigate, handleAuthCallback, toast]);

  return (
    <Center h="100vh">
      <VStack spacing={6}>
        {error ? (
          <>
            <Text fontSize="xl" fontWeight="bold" color="red.500">
              Authentication Error
            </Text>
            <Text>{error}</Text>
            <Text>Redirecting to login page...</Text>
          </>
        ) : (
          <>
            <Spinner size="xl" />
            <Box textAlign="center">
              <Text fontSize="xl" fontWeight="bold">
                Completing Authentication
              </Text>
              <Text mt={2}>Please wait while we complete the GitHub authentication...</Text>
            </Box>
          </>
        )}
      </VStack>
    </Center>
  );
}
