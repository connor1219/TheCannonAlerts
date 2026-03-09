import React from 'react';
import { Box, Typography } from '@mui/material';

interface AdminStatCardProps {
  label: string;
  value: number;
  color?: string;
}

export function AdminStatCard({ label, value, color }: AdminStatCardProps) {
  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        width: 190,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 600,
          color: color || 'text.primary',
          fontSize: '1.5rem',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
