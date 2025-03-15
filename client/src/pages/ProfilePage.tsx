import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  Heading,
  HStack,
  Icon,
  Link,
  Stack,
  Switch,
  Text,
  useColorMode,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import {
  FiGithub,
  FiMail,
  FiMoon,
  FiShield,
  FiSun,
  FiTrash2,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode, toggleColorMode } = useColorMode();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Delete account mutation
  const deleteAccount = useMutation(
    () => apiClient.auth.deleteAccount(),
    {
      onSuccess: () => {
        toast({
          title: 'Account deleted',
          description: 'Your account has been permanently deleted.',
          status: 'success',
          duration: 5000,
        });
        logout();
        navigate('/');
      },
      onError: (error: any) => {
        toast({
          title: 'Error deleting account',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
      },
    }
  );

  // Revoke GitHub access mutation
  const revokeGitHubAccess = useMutation(
    () => apiClient.auth.revokeGitHub(),
    {
      onSuccess: () => {
        toast({
          title: 'GitHub access revoked',
          description: 'Successfully revoked GitHub access.',
          status: 'success',
          duration: 5000,
        });
        logout();
        navigate('/');
      },
      onError: (error: any) => {
        toast({
          title: 'Error revoking access',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
      },
    }
  );

  if (!user) {
    return null;
  }

  return (
    <Stack spacing={8}>
      <Grid
        templateColumns={{ base: '1fr', md: '1fr auto' }}
        gap={4}
        alignItems="flex-start"
      >
        <Stack spacing={1}>
          <Heading size="lg">Profile Settings</Heading>
          <Text color="gray.500">
            Manage your account and preferences
          </Text>
        </Stack>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={8}>
        {/* Main Settings */}
        <Stack spacing={6}>
          {/* Profile Information */}
          <Card bg={cardBg}>
            <CardHeader>
              <Heading size="md">Profile Information</Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={6}>
                <HStack spacing={4}>
                  <Avatar
                    size="xl"
                    name={user.name}
                    src={user.avatarUrl}
                  />
                  <Stack spacing={2}>
                    <Heading size="md">{user.name}</Heading>
                    <HStack>
                      <Icon as={FiMail} color="gray.500" />
                      <Text color="gray.500">{user.email}</Text>
                    </HStack>
                    <HStack>
                      <Icon as={FiGithub} color="gray.500" />
                      <Link
                        href={`https://github.com/${user.login}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {user.login}
                      </Link>
                    </HStack>
                  </Stack>
                </HStack>

                <Divider />

                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Stack spacing={1}>
                      <Text fontWeight="medium">GitHub Integration</Text>
                      <Text color="gray.500" fontSize="sm">
                        Manage your GitHub account connection
                      </Text>
                    </Stack>
                    <Button
                      colorScheme="red"
                      variant="ghost"
                      leftIcon={<Icon as={FiShield} />}
                      onClick={() => revokeGitHubAccess.mutate()}
                      isLoading={revokeGitHubAccess.isLoading}
                    >
                      Revoke Access
                    </Button>
                  </HStack>

                  <HStack>
                    <Badge colorScheme="green">Connected</Badge>
                    <Text color="gray.500" fontSize="sm">
                      Last synced: {new Date().toLocaleDateString()}
                    </Text>
                  </HStack>
                </Stack>
              </Stack>
            </CardBody>
          </Card>

          {/* Preferences */}
          <Card bg={cardBg}>
            <CardHeader>
              <Heading size="md">Preferences</Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={6}>
                <HStack justify="space-between">
                  <Stack spacing={1}>
                    <Text fontWeight="medium">Color Theme</Text>
                    <Text color="gray.500" fontSize="sm">
                      Choose your preferred color theme
                    </Text>
                  </Stack>
                  <HStack>
                    <Icon as={FiSun} />
                    <Switch
                      isChecked={colorMode === 'dark'}
                      onChange={toggleColorMode}
                    />
                    <Icon as={FiMoon} />
                  </HStack>
                </HStack>

                <Divider />

                <HStack justify="space-between">
                  <Stack spacing={1}>
                    <Text fontWeight="medium">Email Notifications</Text>
                    <Text color="gray.500" fontSize="sm">
                      Receive email notifications for analysis results
                    </Text>
                  </Stack>
                  <Switch defaultChecked />
                </HStack>

                <Divider />

                <HStack justify="space-between">
                  <Stack spacing={1}>
                    <Text fontWeight="medium">Security Alerts</Text>
                    <Text color="gray.500" fontSize="sm">
                      Get notified about critical security issues
                    </Text>
                  </Stack>
                  <Switch defaultChecked />
                </HStack>
              </Stack>
            </CardBody>
          </Card>
        </Stack>

        {/* Danger Zone */}
        <Card bg={cardBg} borderColor="red.500" borderWidth="1px">
          <CardHeader>
            <Heading size="md" color="red.500">
              Danger Zone
            </Heading>
          </CardHeader>
          <CardBody>
            <Stack spacing={6}>
              <Box
                p={4}
                bg={useColorModeValue('red.50', 'red.900')}
                rounded="md"
              >
                <Stack spacing={4}>
                  <Stack spacing={1}>
                    <Text fontWeight="medium">Delete Account</Text>
                    <Text color="gray.500" fontSize="sm">
                      Permanently delete your account and all associated data
                    </Text>
                  </Stack>
                  <Button
                    colorScheme="red"
                    leftIcon={<Icon as={FiTrash2} />}
                    onClick={() => deleteAccount.mutate()}
                    isLoading={deleteAccount.isLoading}
                  >
                    Delete Account
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}
