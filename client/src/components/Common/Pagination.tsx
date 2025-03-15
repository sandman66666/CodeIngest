import {
  Button,
  ButtonGroup,
  HStack,
  Icon,
  Select,
  Text,
} from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <HStack spacing={4} justify="center">
      <ButtonGroup size="sm" variant="outline" isAttached>
        <Button
          onClick={() => handlePageChange(currentPage - 1)}
          isDisabled={currentPage === 1}
          aria-label="Previous page"
        >
          <Icon as={FiChevronLeft} />
        </Button>

        {totalPages <= 7 ? (
          // Show all pages if total pages are 7 or less
          pages.map((page) => (
            <Button
              key={page}
              onClick={() => handlePageChange(page)}
              variant={currentPage === page ? 'solid' : 'outline'}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </Button>
          ))
        ) : (
          // Show truncated pagination for more than 7 pages
          <>
            {/* First page */}
            <Button
              onClick={() => handlePageChange(1)}
              variant={currentPage === 1 ? 'solid' : 'outline'}
            >
              1
            </Button>

            {/* Ellipsis or second page */}
            {currentPage > 3 && <Text>...</Text>}

            {/* Current page and surrounding pages */}
            {pages
              .filter(
                (page) =>
                  page !== 1 &&
                  page !== totalPages &&
                  Math.abs(currentPage - page) <= 1
              )
              .map((page) => (
                <Button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  variant={currentPage === page ? 'solid' : 'outline'}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </Button>
              ))}

            {/* Ellipsis or second-to-last page */}
            {currentPage < totalPages - 2 && <Text>...</Text>}

            {/* Last page */}
            <Button
              onClick={() => handlePageChange(totalPages)}
              variant={currentPage === totalPages ? 'solid' : 'outline'}
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          onClick={() => handlePageChange(currentPage + 1)}
          isDisabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <Icon as={FiChevronRight} />
        </Button>
      </ButtonGroup>

      <Select
        value={currentPage}
        onChange={(e) => handlePageChange(Number(e.target.value))}
        w="auto"
        size="sm"
      >
        {pages.map((page) => (
          <option key={page} value={page}>
            Page {page}
          </option>
        ))}
      </Select>
    </HStack>
  );
}
