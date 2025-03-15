import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface AddRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRepositoryModal({ isOpen, onClose }: AddRepositoryModalProps) {
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  // Add repository mutation
  const addRepository = useMutation(
    () => apiClient.repositories.add(owner, name),
    {
      onSuccess: () => {
        // Invalidate and refetch
        queryClient.invalidateQueries(['repositories']);
        
        // Show success message
        toast({
          title: 'Repository added',
          description: 'The repository has been added successfully.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        // Reset form and close modal
        handleClose();
      },
      onError: (error: any) => {
        setError(error.message || 'Failed to add repository');
        
        toast({
          title: 'Error',
          description: error.message || 'Failed to add repository',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!owner || !name) {
      setError('Please fill in all fields');
      return;
    }

    addRepository.mutate();
  };

  const handleClose = () => {
    setOwner('');
    setName('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit}>
        <ModalHeader>Add Repository</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Stack spacing={4}>
            <Text color="gray.500" fontSize="sm">
              Enter the GitHub repository details to add it for analysis.
            </Text>

            <FormControl isInvalid={!!error}>
              <FormLabel>Repository Owner</FormLabel>
              <Input
                placeholder="e.g., facebook"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </FormControl>

            <FormControl isInvalid={!!error}>
              <FormLabel>Repository Name</FormLabel>
              <Input
                placeholder="e.g., react"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {error && <FormErrorMessage>{error}</FormErrorMessage>}
            </FormControl>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={addRepository.isLoading}
            loadingText="Adding..."
          >
            Add Repository
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
