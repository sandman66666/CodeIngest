import React, { useState } from 'react';
import {
  Button,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import {
  FiCheck,
  FiCopy,
  FiLink,
  FiMail,
} from 'react-icons/fi';
import { apiClient } from '@/lib/api';

interface ShareModalProps {
  resourceId: string;
  resourceType: 'repository' | 'analysis';
  isOpen: boolean;
  onClose: () => void;
}

interface ShareLinkResponse {
  url: string;
  expiresAt?: string;
}

interface ShareConfig {
  email?: string;
  expiresInDays?: number;
  allowEdit: boolean;
}

interface ShareEmailConfig extends ShareConfig {
  email: string;
}

export function ShareModal({
  resourceId,
  resourceType,
  isOpen,
  onClose,
}: ShareModalProps) {
  const toast = useToast();
  const [shareUrl, setShareUrl] = useState('');
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [allowEdit, setAllowEdit] = useState(false);
  const { onCopy, hasCopied } = useClipboard(shareUrl);

  // Generate share link mutation
  const generateLink = useMutation<ShareLinkResponse, Error, ShareConfig>({
    mutationFn: (config: ShareConfig) =>
      apiClient.share.generateLink(resourceId, resourceType, config),
    onSuccess: (data: ShareLinkResponse) => {
      setShareUrl(data.url);
      toast({
        title: 'Share link generated',
        description: 'Link has been generated successfully.',
        status: 'success',
        duration: 5000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to generate link',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    },
  });

  // Send email invitation mutation
  const sendEmail = useMutation<void, Error, ShareEmailConfig>({
    mutationFn: (config: ShareEmailConfig) =>
      apiClient.share.sendEmail(resourceId, resourceType, config),
    onSuccess: () => {
      toast({
        title: 'Invitation sent',
        description: 'Share invitation has been sent successfully.',
        status: 'success',
        duration: 5000,
      });
      setEmail('');
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send invitation',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    },
  });

  const handleGenerateLink = () => {
    const config: ShareConfig = {
      expiresInDays,
      allowEdit,
    };
    generateLink.mutate(config);
  };

  const handleSendEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address.',
        status: 'warning',
        duration: 5000,
      });
      return;
    }

    const config: ShareEmailConfig = {
      email,
      expiresInDays,
      allowEdit,
    };
    sendEmail.mutate(config);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Share {resourceType}</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Tabs>
            <TabList>
              <Tab>Share Link</Tab>
              <Tab>Email Invite</Tab>
            </TabList>

            <TabPanels>
              {/* Share Link Panel */}
              <TabPanel>
                <Stack spacing={6}>
                  <FormControl>
                    <FormLabel>Share Link</FormLabel>
                    <HStack>
                      <Input
                        value={shareUrl}
                        isReadOnly
                        placeholder="Generate a link to share"
                      />
                      {shareUrl && (
                        <Button
                          onClick={onCopy}
                          leftIcon={
                            <Icon as={hasCopied ? FiCheck : FiCopy} />
                          }
                        >
                          {hasCopied ? 'Copied' : 'Copy'}
                        </Button>
                      )}
                    </HStack>
                  </FormControl>

                  <Stack spacing={4}>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Allow Edit Access</FormLabel>
                      <Switch
                        isChecked={allowEdit}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAllowEdit(e.target.checked)
                        }
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Expires In (Days)</FormLabel>
                      <Input
                        type="number"
                        value={expiresInDays}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setExpiresInDays(parseInt(e.target.value, 10))
                        }
                        min={1}
                        max={30}
                      />
                    </FormControl>
                  </Stack>

                  <Button
                    leftIcon={<Icon as={FiLink} />}
                    onClick={handleGenerateLink}
                    isLoading={generateLink.isLoading}
                    loadingText="Generating..."
                  >
                    Generate Link
                  </Button>
                </Stack>
              </TabPanel>

              {/* Email Invite Panel */}
              <TabPanel>
                <form onSubmit={handleSendEmail}>
                  <Stack spacing={6}>
                    <FormControl>
                      <FormLabel>Email Address</FormLabel>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEmail(e.target.value)
                        }
                        placeholder="Enter email address"
                      />
                    </FormControl>

                    <Stack spacing={4}>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb={0}>Allow Edit Access</FormLabel>
                        <Switch
                          isChecked={allowEdit}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAllowEdit(e.target.checked)
                          }
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Expires In (Days)</FormLabel>
                        <Input
                          type="number"
                          value={expiresInDays}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setExpiresInDays(parseInt(e.target.value, 10))
                          }
                          min={1}
                          max={30}
                        />
                      </FormControl>
                    </Stack>

                    <Button
                      type="submit"
                      leftIcon={<Icon as={FiMail} />}
                      isLoading={sendEmail.isLoading}
                      loadingText="Sending..."
                    >
                      Send Invitation
                    </Button>
                  </Stack>
                </form>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
