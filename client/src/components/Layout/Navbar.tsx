import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiGithub, FiMoon, FiSun, FiUser } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function Navbar() {
  const { user, login, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      as="nav"
      position="sticky"
      top={0}
      zIndex="sticky"
      bg={bg}
      borderBottom="1px"
      borderColor={borderColor}
    >
      <Flex
        h={16}
        alignItems="center"
        justifyContent="space-between"
        maxW="container.xl"
        mx="auto"
        px={4}
      >
        <Link to="/">
          <HStack spacing={2}>
            <Image
              src="/logo.svg"
              alt="CodeInsight"
              boxSize={8}
            />
            <Box
              as="span"
              fontSize="xl"
              fontWeight="bold"
              display={{ base: 'none', md: 'block' }}
            >
              CodeInsight
            </Box>
          </HStack>
        </Link>

        <HStack spacing={4}>
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
            onClick={toggleColorMode}
            variant="ghost"
          />

          {user ? (
            <Menu>
              <MenuButton
                as={Button}
                rightIcon={<FiUser />}
                variant="ghost"
              >
                {user.name}
              </MenuButton>
              <MenuList>
                <MenuItem as={Link} to="/profile">
                  Profile
                </MenuItem>
                <MenuItem onClick={logout}>
                  Logout
                </MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <Button
              leftIcon={<FiGithub />}
              onClick={login}
            >
              Login with GitHub
            </Button>
          )}
        </HStack>
      </Flex>
    </Box>
  );
}
