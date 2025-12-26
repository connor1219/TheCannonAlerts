import React from 'react';
import {
  Typography,
  Button,
  Box,
} from '@mui/material';
import { CheckCircle, Email, Webhook } from '@mui/icons-material';

interface SuccessMessageProps {
  contactMethod: 'EMAIL' | 'WEBHOOK';
  onReset: () => void;
}

export function SuccessMessage({ contactMethod, onReset }: SuccessMessageProps) {
  return (
    <Box
      sx={{
        backgroundColor: 'background.paper',
        py: 2,
        px: 4,
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        border: '1px solid',
        borderColor: 'grey.800',
        textAlign: 'center',
      }}
    >
      <Box sx={{ mb: 3 }}>
        <CheckCircle
          sx={{
            fontSize: 64,
            color: '#10B981',
            filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))',
          }}
        />
      </Box>

      <Typography 
        variant="h4" 
        sx={{ 
          mb: 2, 
          fontSize: '1.75rem', 
          fontWeight: 700,
          color: 'text.primary',
          letterSpacing: '0.02em',
        }}
      >
        Alert Created Successfully!
      </Typography>

      <Typography 
        variant="body1" 
        sx={{ 
          mb: 3, 
          color: 'text.secondary',
          fontSize: '1rem',
          lineHeight: 1.6,
        }}
      >
        Your housing alert has been set up. You&apos;ll receive notifications when new listings match your preferences.
      </Typography>

      <Box
        sx={{
          mb: 3,
          p: 2,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        {contactMethod === 'EMAIL' ? (
          <Email sx={{ color: '#10B981', fontSize: 20 }} />
        ) : (
          <Webhook sx={{ color: '#10B981', fontSize: 20 }} />
        )}
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'text.primary',
            fontWeight: 500,
          }}
        >
          {contactMethod === 'EMAIL' 
            ? 'Email notifications are now active'
            : 'Discord webhook notifications are now active'
          }
        </Typography>
      </Box>

      <Box 
        sx={{ 
          mb: 1, 
          p: 3, 
          backgroundColor: 'background.default', 
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'grey.800',
        }}
      >
        <Typography 
          variant="subtitle2" 
          sx={{ 
            mb: 2, 
            fontWeight: 600,
            color: 'text.primary',
            fontSize: '0.95rem',
          }}
        >
          What happens next?
        </Typography>
        <Box sx={{ textAlign: 'left' }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              lineHeight: 1.8,
              fontSize: '0.9rem',
              '& > div': {
                display: 'flex',
                alignItems: 'flex-start',
                mb: 1,
                '&:before': {
                  content: '"•"',
                  color: 'primary.main',
                  fontWeight: 'bold',
                  width: '1em',
                  flexShrink: 0,
                  marginRight: '0.5em',
                },
              },
            }}
          >
            <div>We&apos;ll monitor TheCannon for new listings</div>
            <div>When a match is found, you&apos;ll get notified instantly</div>
            <div>You can create multiple alerts with different preferences</div>
          </Typography>
        </Box>
      </Box>

      <Button
        variant="outlined"
        onClick={onReset}
        sx={{
          mt: 1,
          px: 4,
          py: 1.5,
          fontSize: '0.95rem',
          fontWeight: 600,
          textTransform: 'none',
          borderColor: 'primary.main',
          color: 'primary.main',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            transform: 'scale(1.02)',
          },
          transition: 'all 0.2s ease-in-out',
        }}
      >
        Create Another Alert
      </Button>
    </Box>
  );
}
