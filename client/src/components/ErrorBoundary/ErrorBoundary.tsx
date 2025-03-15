import {
  Button,
  Container,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react';
import React from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container maxW="container.md" py={16}>
          <Stack spacing={8} align="center" textAlign="center">
            <Icon as={FiAlertTriangle} boxSize={12} color="red.500" />
            <Stack spacing={4}>
              <Heading size="xl">Something went wrong</Heading>
              <Text color="gray.500">
                An unexpected error occurred. Our team has been notified.
              </Text>
              {this.state.error && (
                <Text
                  color="gray.500"
                  fontSize="sm"
                  fontFamily="monospace"
                  whiteSpace="pre-wrap"
                >
                  {this.state.error.toString()}
                </Text>
              )}
            </Stack>
            <Button
              leftIcon={<Icon as={FiRefreshCw} />}
              onClick={this.handleRetry}
              colorScheme="brand"
            >
              Retry
            </Button>
          </Stack>
        </Container>
      );
    }

    return this.props.children;
  }
}
