import React from 'react';
import { Box, TextField, Typography, InputAdornment } from '@mui/material';
import { Control, Controller } from 'react-hook-form';
import { SubscriptionFormData } from '../schemas/subscriptionSchema';

interface PriceRangeInputsProps {
  control: Control<SubscriptionFormData>;
}

export function PriceRangeInputs({ control }: PriceRangeInputsProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="caption"
        sx={{
          mb: 1.5,
          fontWeight: 600,
          color: 'text.secondary',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          display: 'block',
        }}
      >
        PRICE RANGE
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name="minPrice"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label="Min"
              placeholder="No min"
              size="small"
              type="number"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val === '' ? null : parseInt(val, 10));
              }}
              value={field.value ?? ''}
              sx={{ flex: 1 }}
            />
          )}
        />
        <Controller
          name="maxPrice"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label="Max"
              placeholder="No max"
              size="small"
              type="number"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val === '' ? null : parseInt(val, 10));
              }}
              value={field.value ?? ''}
              sx={{ flex: 1 }}
            />
          )}
        />
      </Box>
    </Box>
  );
}
