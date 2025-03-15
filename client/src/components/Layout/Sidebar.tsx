import {
  Box,
  Button,
  Icon,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  FiBook,
  FiDatabase,
  FiHome,
  FiLayers,
  FiShield,
} from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  icon: typeof FiHome;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: FiHome, path: '/dashboard' },
  { label: 'Repositories', icon: FiDatabase, path: '/repositories' },
  { label: 'Analyses', icon: FiLayers, path: '/analyses' },
  { label: 'Security', icon: FiShield, path: '/security' },
  { label: 'Documentation', icon: FiBook, path: '/docs' },
];

export function Sidebar() {
  const location = useLocation();
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      as="nav"
      pos="sticky"
      top="16"
      h="calc(100vh - 4rem)"
      w="64"
      bg={bg}
      borderRight="1px"
      borderColor={borderColor}
      py={8}
      px={4}
      overflowY="auto"
    >
      <Stack spacing={2}>
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.path}
            as={Link}
            to={item.path}
            variant={location.pathname === item.path ? 'solid' : 'ghost'}
            justifyContent="flex-start"
            leftIcon={<Icon as={item.icon} boxSize={5} />}
            size="lg"
            width="full"
          >
            <Text>{item.label}</Text>
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
