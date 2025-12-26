import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import Image from 'next/image';

export function HeroSection() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        textAlign: 'center',
        maxWidth: 600,
        mx: 'auto',
        px: 2,
        mb: 6,
      }}
    >

      {/* Main Title with Yellow "TheCannon" */}
      <Typography
        variant="h1"
        sx={{
          mb: 3,
          fontWeight: 700,
          fontSize: { xs: '2.25rem', md: '3rem' },
          color: 'text.primary',
        }}
      >
        <Box
          component="span"
          sx={{
            color: theme.palette.cannon.yellow,
            textShadow: '0 0 20px rgba(234, 179, 8, 0.3)',
          }}
        >
          TheCannon
        </Box>{' '}
        Alerts
      </Typography>

      {/* Subtitle */}
      <Typography
        variant="body1"
        sx={{
          mb: 2,
          fontWeight: 400,
          fontSize: { xs: '1.125rem', md: '1.25rem' },
          color: 'text.primary',
          lineHeight: 1.5,
          maxWidth: 500,
          mx: 'auto',
        }}
      >
        Get notified when new Guelph rentals hit TheCannon that match your budget and bedroom needs.
      </Typography>

      {/* Description */}
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          fontSize: { xs: '0.875rem', md: '1rem' },
          maxWidth: 400,
          mx: 'auto',
        }}
      >
        Choose Email or Discord alerts and we'll handle the rest.
      </Typography>
    </Box>
  );
}
