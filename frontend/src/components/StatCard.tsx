import React from 'react';
import { Typography, Box, Skeleton } from '@mui/material';

interface StatCardProps {
  title: string;
  value: number | null;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, loading = false, icon }: StatCardProps) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      {icon && (
        <Box sx={{ mb: 1, color: 'primary.main' }}>
          {icon}
        </Box>
      )}
      
      <Typography 
        variant="h3" 
        sx={{ 
          mb: 1,
          fontWeight: 700,
          color: 'text.primary',
          fontSize: { xs: '2rem', sm: '2.5rem' }
        }}
      >
        {loading ? (
          <Skeleton width={80} height={40} sx={{ mx: 'auto' }} />
        ) : (
          value?.toLocaleString() || '0'
        )}
      </Typography>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'text.secondary',
          fontWeight: 500,
          fontSize: '0.875rem'
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}
