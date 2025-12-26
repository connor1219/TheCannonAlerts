import React from 'react';
import { TextField, Box, Typography } from '@mui/material';
import { Control, Controller } from 'react-hook-form';
import { SubscriptionFormData } from '../schemas/subscriptionSchema';

interface ContactFieldGroupProps {
  contactMethod: 'EMAIL' | 'WEBHOOK';
  control: Control<SubscriptionFormData>;
  errors: any;
}

export function ContactFieldGroup({ contactMethod, control, errors }: ContactFieldGroupProps) {
  return (
    <Box sx={{ mb: 3, minHeight: 88 }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          mb: 1.5, 
          fontWeight: 600,
          color: 'text.primary',
          fontSize: '0.875rem',
        }}
      >
        {contactMethod === 'EMAIL' ? 'Email address' : 'Discord Webhook URL'}
      </Typography>
      
      <Box sx={{ position: 'relative', height: 48 }}>
        {contactMethod === 'EMAIL' ? (
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                type="email"
                placeholder="you@university.ca"
                error={!!errors.email}
                helperText=""
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 48,
                  },
                  '& .MuiFormHelperText-root': {
                    display: 'none',
                  },
                }}
              />
            )}
          />
        ) : (
          <Controller
            name="webhookUrl"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                error={!!errors.webhookUrl}
                helperText=""
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 48,
                  },
                  '& .MuiFormHelperText-root': {
                    display: 'none',
                  },
                }}
              />
            )}
          />
        )}
      </Box>
      
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          mt: 0.5,
          color: (contactMethod === 'EMAIL' && errors.email) || (contactMethod === 'WEBHOOK' && errors.webhookUrl) 
            ? 'error.main' 
            : 'text.secondary',
          fontSize: '0.75rem',
          lineHeight: 1.4,
          display: 'block',
          minHeight: 16,
        }}
      >
        {contactMethod === 'EMAIL' 
          ? (errors.email?.message || '')
          : (errors.webhookUrl?.message || 'Paste the webhook URL from your server\'s integrations.')
        }
      </Typography>
    </Box>
  );
}
