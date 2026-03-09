import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography,
  CircularProgress,
  TableSortLabel,
} from '@mui/material';
import { Check, Close } from '@mui/icons-material';
import { Subscription } from './SubscriptionsTable';
import { getBedroomLabel, formatPriceRange, getFrequencyLabel } from '../schemas/subscriptionSchema';

interface VerificationsTableProps {
  subscriptions: Subscription[];
  loading: boolean;
  onVerify: (subscriptionId: string) => void;
  onDecline: (subscriptionId: string) => void;
  processingId: string | null;
  processingAction: 'verify' | 'decline' | null;
}

const columnHelper = createColumnHelper<Subscription>();

export function VerificationsTable({
  subscriptions,
  loading,
  onVerify,
  onDecline,
  processingId,
  processingAction,
}: VerificationsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatPreferences = (preferences?: string[], labelFn?: (value: string) => string) => {
    if (!preferences || preferences.length === 0) return 'Any';
    if (preferences.includes('ANY')) return 'Any';
    return preferences.map(p => labelFn ? labelFn(p) : p).join(', ');
  };

  const columns = useMemo(() => [
    columnHelper.accessor('createdAt', {
      header: 'Subscribed',
      cell: (info) => formatDate(info.getValue()),
      sortingFn: 'datetime',
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {info.getValue() || 'N/A'}
        </Typography>
      ),
    }),
    columnHelper.accessor('bedroomPreferences', {
      header: 'Bedrooms',
      cell: (info) => formatPreferences(info.getValue(), getBedroomLabel),
    }),
    columnHelper.accessor((row) => ({ minPrice: row.minPrice, maxPrice: row.maxPrice }), {
      id: 'price',
      header: 'Price',
      cell: (info) => {
        const { minPrice, maxPrice } = info.getValue();
        return formatPriceRange(minPrice, maxPrice);
      },
    }),
    columnHelper.accessor('frequency', {
      header: 'Frequency',
      cell: (info) => getFrequencyLabel(info.getValue() || 'REAL_TIME'),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const row = info.row.original;
        const isProcessing = processingId === row.id;
        const isVerifying = isProcessing && processingAction === 'verify';
        const isDeclining = isProcessing && processingAction === 'decline';

        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={isVerifying ? <CircularProgress size={14} color="inherit" /> : <Check />}
              onClick={() => onVerify(row.id)}
              disabled={isProcessing}
              sx={{
                minWidth: 90,
                backgroundColor: '#22c55e',
                boxShadow: 'none',
                transform: 'none',
                '&:hover': {
                  backgroundColor: '#16a34a',
                  boxShadow: 'none',
                  transform: 'none',
                },
              }}
            >
              Verify
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={isDeclining ? <CircularProgress size={14} sx={{ color: '#ef4444' }} /> : <Close />}
              onClick={() => onDecline(row.id)}
              disabled={isProcessing}
              sx={{
                minWidth: 90,
                borderColor: '#ef4444',
                color: '#ef4444',
                '&:hover': {
                  borderColor: '#dc2626',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                },
              }}
            >
              Decline
            </Button>
          </Box>
        );
      },
    }),
  ], [processingId, processingAction, onVerify, onDecline]);

  const table = useReactTable({
    data: subscriptions,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          No pending verifications
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      sx={{
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Table size="small">
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableCell
                  key={header.id}
                  sx={{
                    fontWeight: 600,
                    backgroundColor: '#111827',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <TableSortLabel
                      active={!!header.column.getIsSorted()}
                      direction={header.column.getIsSorted() === 'desc' ? 'desc' : 'asc'}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableSortLabel>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                },
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
