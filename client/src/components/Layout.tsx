import {
  Box,
  Container,
  Flex,
  Heading,
  IconButton,
  Spacer,
  useColorMode,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Text,
  HStack,
} from '@chakra-ui/react';
import { FiMoon, FiSun, FiLogOut, FiGithub } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export function Layout({ children }: { children: React.ReactNode }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const bgColor = colorMode === 'light' ? 'white' : 'gray.800';

  return (
    <Box minH="100vh" bg={colorMode === 'light' ? 'gray.50' : 'gray.900'}>
      <Flex
        as="header"
        bg={bgColor}
        py={4}
        px={8}
        shadow="sm"
        position="sticky"
        top={0}
        zIndex={1}
      >
        <HStack spacing={4}>
          <FiGithub size={24} />
          <Heading size="md" as={Link} to="/">
            CodeInsight
          </Heading>
        </HStack>
        <Spacer />
        <Flex gap={4} align="center">
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
            onClick={toggleColorMode}
            variant="ghost"
          />
          {isLoading ? (
            <Spinner size="sm" />
          ) : isAuthenticated && user ? (
            <Menu>
              <MenuButton>
                <HStack spacing={3}>
                  <Avatar size="sm" name={user.name} src={user.avatarUrl} />
                  <Text display={{ base: 'none', md: 'block' }}>{user.name}</Text>
                </HStack>
              </MenuButton>
              <MenuList>
                <MenuItem icon={<FiLogOut />} onClick={logout}>
                  Logout
                </MenuItem>
              </MenuList>
            </Menu>
          ) : null}
        </Flex>
      </Flex>
      <Box as="main" py={8}>
        <Container maxW="container.xl">
          {isLoading ? (
            <Flex justify="center" align="center" minH="50vh">
              <Spinner size="xl" />
            </Flex>
          ) : (
            children
          )}
        </Container>
      </Box>
    </Box>
  );
}
