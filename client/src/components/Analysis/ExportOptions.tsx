import {
  Button,
  Checkbox,
  CheckboxGroup,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  FiDownload,
  FiFile,
  FiFileText,
  FiCode,
} from 'react-icons/fi';
import { apiClient } from '@/lib/api';

interface ExportOptionsProps {
  analysisId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ExportConfig {
  format: 'pdf' | 'json' | 'html';
  sections: string[];
}

export function ExportOptions({
  analysisId,
  isOpen,
  onClose,
}: ExportOptionsProps) {
  const toast = useToast();
  const [format, setFormat] = useState<ExportConfig['format']>('pdf');
  const [selectedSections, setSelectedSections] = useState<string[]>([
    'overview',
    'insights',
    'vulnerabilities',
  ]);

  const exportMutation = useMutation<Blob, Error, ExportConfig>(
    (config) =>
      apiClient.analysis.export(analysisId, config).then((response) => response.data),
    {
      onSuccess: (data) => {
        // Create a download link
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analysis-${analysisId}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Export successful',
          description: 'Your analysis has been exported successfully.',
          status: 'success',
          duration: 5000,
        });
        onClose();
      },
      onError: (error) => {
        toast({
          title: 'Export failed',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
      },
    }
  );

  const handleExport = () => {
    const config: ExportConfig = {
      format,
      sections: selectedSections,
    };
    exportMutation.mutate(config);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Export Analysis</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Stack spacing={6}>
            <FormControl>
              <FormLabel>Export Format</FormLabel>
              <RadioGroup value={format} onChange={(value: ExportConfig['format']) => setFormat(value)}>
                <Stack>
                  <Radio value="pdf">
                    <HStack>
                      <Icon as={FiFileText} />
                      <Text>PDF Document</Text>
                    </HStack>
                  </Radio>
                  <Radio value="json">
                    <HStack>
                      <Icon as={FiCode} />
                      <Text>JSON Data</Text>
                    </HStack>
                  </Radio>
                  <Radio value="html">
                    <HStack>
                      <Icon as={FiFile} />
                      <Text>HTML Report</Text>
                    </HStack>
                  </Radio>
                </Stack>
              </RadioGroup>
            </FormControl>

            <FormControl>
              <FormLabel>Include Sections</FormLabel>
              <CheckboxGroup
                value={selectedSections}
                onChange={(values: string[]) => setSelectedSections(values)}
              >
                <Stack>
                  <Checkbox value="overview">Overview</Checkbox>
                  <Checkbox value="insights">Code Insights</Checkbox>
                  <Checkbox value="vulnerabilities">
                    Security Vulnerabilities
                  </Checkbox>
                  <Checkbox value="components">Component Analysis</Checkbox>
                </Stack>
              </CheckboxGroup>
            </FormControl>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftIcon={<Icon as={FiDownload} />}
            onClick={handleExport}
            isLoading={exportMutation.isLoading}
            loadingText="Exporting..."
          >
            Export
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
