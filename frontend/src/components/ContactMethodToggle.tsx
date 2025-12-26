import React from 'react';
import { ToggleButton, ToggleButtonGroup, Box, Typography } from '@mui/material';
import { Email, Webhook } from '@mui/icons-material';

interface ContactMethodToggleProps {
  value: 'EMAIL' | 'WEBHOOK';
  onChange: (value: 'EMAIL' | 'WEBHOOK') => void;
}

export function ContactMethodToggle({ value, onChange }: ContactMethodToggleProps) {
  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    newValue: 'EMAIL' | 'WEBHOOK' | null,
  ) => {
    if (newValue !== null) {
      onChange(newValue);
    }
  };

  const handleButtonClick = (buttonValue: 'EMAIL' | 'WEBHOOK') => {
    onChange(buttonValue);
  };

  return (
    <Box sx={{ mb: 1 }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          mb: 2, 
          fontWeight: 600,
          color: 'text.primary',
          fontSize: '0.875rem',
        }}
      >
        How should we notify you?
      </Typography>
      
      <Box
        sx={{
          backgroundColor: '#111827',
          borderRadius: '24px',
          p: 0.5,
          border: '1px solid #374151',
        }}
      >
        <ToggleButtonGroup
          value={value}
          exclusive
          onChange={handleChange}
          aria-label="contact method"
          fullWidth
          sx={{
            gap: 0.5,
            '& .MuiToggleButtonGroup-grouped': {
              border: 'none',
              flex: 1,
              '&:not(:first-of-type)': {
                borderRadius: '20px',
                marginLeft: 0,
              },
              '&:first-of-type': {
                borderRadius: '20px',
              },
            },
          }}
        >
          <ToggleButton 
            value="EMAIL" 
            aria-label="email notifications"
            onClick={() => handleButtonClick('EMAIL')}
            sx={{
              border: 'none !important',
              backgroundColor: value === 'EMAIL' ? '#EAB308 !important' : 'transparent !important',
              color: value === 'EMAIL' ? '#0B1120 !important' : '#9CA3AF !important',
              flex: 1,
              py: 1.5,
              px: 2,
              '&:hover': {
                backgroundColor: value === 'EMAIL' ? '#D97706 !important' : 'rgba(56, 189, 248, 0.1) !important',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Email fontSize="small" />
              <Typography variant="body2" fontWeight={500}>
                Email
              </Typography>
            </Box>
          </ToggleButton>
          <ToggleButton 
            value="WEBHOOK" 
            aria-label="discord webhook notifications"
            onClick={() => handleButtonClick('WEBHOOK')}
            sx={{
              border: 'none !important',
              backgroundColor: value === 'WEBHOOK' ? '#EAB308 !important' : 'transparent !important',
              color: value === 'WEBHOOK' ? '#0B1120 !important' : '#9CA3AF !important',
              flex: 1,
              py: 1.5,
              px: 2,
              '&:hover': {
                backgroundColor: value === 'WEBHOOK' ? '#D97706 !important' : 'rgba(56, 189, 248, 0.1) !important',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Webhook fontSize="small" />
              <Typography variant="body2" fontWeight={500}>
                Discord Webhook
              </Typography>
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
}
