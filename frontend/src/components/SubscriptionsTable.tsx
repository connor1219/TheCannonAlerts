import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnDef,
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
  Chip,
  Box,
  Typography,
  CircularProgress,
  TableSortLabel,
} from '@mui/material';
import { getBedroomLabel, getPriceLabel, getFrequencyLabel } from '../schemas/subscriptionSchema';

export interface Subscription {
  id: string;
  type: 'EMAIL' | 'WEBHOOK';
  email?: string;
  webhookUrl?: string;
  bedroomPreferences?: string[];
  pricePreferences?: string[];
  frequency?: string;
  sendTime?: string;
  disabled?: string | null;
  createdAt?: string;
  isVerified?: boolean;
  verifiedAt?: string;
  declinedAt?: string;
}

interface SubscriptionsTableProps {
  subscriptions: Subscription[];
  loading: boolean;
  onDisable: (subscriptionId: string) => void;
  disablingId: string | null;
  showDisableButton?: boolean;
}

const columnHelper = createColumnHelper<Subscription>();

export function SubscriptionsTable({
  subscriptions,
  loading,
  onDisable,
  disablingId,
  showDisableButton = true,
}: SubscriptionsTableProps) {
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

  const columns = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols: ColumnDef<Subscription, any>[] = [
      columnHelper.accessor('createdAt', {
        header: 'Subscribed',
        cell: (info) => formatDate(info.getValue()),
        sortingFn: 'datetime',
      }),
      // Show "Disabled At" column for disabled tab, "Status" column for active tab
      showDisableButton
        ? columnHelper.accessor('disabled', {
            id: 'status',
            header: 'Status',
            cell: (info) => {
              const isDisabled = info.getValue() !== null && info.getValue() !== undefined;
              return (
                <Chip
                  label={isDisabled ? 'Disabled' : 'Active'}
                  size="small"
                  sx={{
                    backgroundColor: isDisabled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    color: isDisabled ? '#ef4444' : '#22c55e',
                    border: `1px solid ${isDisabled ? '#ef4444' : '#22c55e'}`,
                    fontWeight: 500,
                  }}
                />
              );
            },
          })
        : columnHelper.accessor('disabled', {
            id: 'disabledAt',
            header: 'Disabled At',
            cell: (info) => formatDate(info.getValue() ?? undefined),
            sortingFn: 'datetime',
          }),
      columnHelper.accessor((row) => row.email || row.webhookUrl, {
        id: 'contact',
        header: 'Contact',
        cell: (info) => {
          const row = info.row.original;
          return (
            <Box sx={{ maxWidth: 300 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={row.type === 'EMAIL' ? row.email : row.webhookUrl}
              >
                {row.type === 'EMAIL' ? row.email : row.webhookUrl}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {row.type}
              </Typography>
            </Box>
          );
        },
      }),
      columnHelper.accessor('bedroomPreferences', {
        header: 'Bedrooms',
        cell: (info) => formatPreferences(info.getValue(), getBedroomLabel),
      }),
      columnHelper.accessor('pricePreferences', {
        header: 'Price',
        cell: (info) => formatPreferences(info.getValue(), getPriceLabel),
      }),
      columnHelper.accessor('frequency', {
        header: 'Frequency',
        cell: (info) => getFrequencyLabel(info.getValue() || 'REAL_TIME'),
      }),
    ];

    if (showDisableButton) {
      cols.push(
        columnHelper.display({
          id: 'actions',
          header: 'Actions',
          cell: (info) => {
            const row = info.row.original;
            const isDisabled = row.disabled !== null && row.disabled !== undefined;
            const isDisabling = disablingId === row.id;

            if (isDisabled) {
              return (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  Disabled
                </Typography>
              );
            }

            return (
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => onDisable(row.id)}
                disabled={isDisabling}
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
                {isDisabling ? (
                  <CircularProgress size={16} sx={{ color: '#ef4444' }} />
                ) : (
                  'Disable'
                )}
              </Button>
            );
          },
        })
      );
    }

    return cols;
  }, [showDisableButton, disablingId, onDisable]);

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
          No subscriptions found
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
