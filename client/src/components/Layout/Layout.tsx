import { Box, Container, Flex } from '@chakra-ui/react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Box minH="100vh">
        <Navbar />
        <Container maxW="container.xl" py={8}>
          {children}
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh">
      <Navbar />
      <Flex>
        <Sidebar />
        <Box flex="1" p={8}>
          {children}
        </Box>
      </Flex>
    </Box>
  );
}
