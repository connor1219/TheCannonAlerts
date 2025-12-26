import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Control, Controller } from 'react-hook-form';
import { SubscriptionFormData } from '../schemas/subscriptionSchema';

interface FilterChipsProps {
  control: Control<SubscriptionFormData>;
  type: 'bedroom' | 'price';
}

const bedroomOptions = [
  { value: 'ANY', label: 'Any' },
  { value: 'B1', label: '1' },
  { value: 'B2', label: '2' },
  { value: 'B3', label: '3' },
  { value: 'B4', label: '4' },
  { value: 'B5_PLUS', label: '5+' },
];

const priceOptions = [
  { value: 'ANY', label: 'Any' },
  { value: 'P0_399', label: '$0–399' },
  { value: 'P400_699', label: '$400–699' },
  { value: 'P700_999', label: '$700–999' },
  { value: 'P1000_1499', label: '$1000–1499' },
  { value: 'P1500_PLUS', label: '$1500+' },
];

export function FilterChips({ control, type }: FilterChipsProps) {
  const options = type === 'bedroom' ? bedroomOptions : priceOptions;
  const fieldName = type === 'bedroom' ? 'bedroomPreference' : 'pricePreference';
  const sectionTitle = type === 'bedroom' ? 'BEDROOMS' : 'PRICE RANGE';

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
        {sectionTitle}
      </Typography>
      
      <Controller
        name={fieldName as keyof SubscriptionFormData}
        control={control}
        render={({ field }) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {options.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                clickable
                variant={field.value === option.value ? 'filled' : 'outlined'}
                onClick={() => field.onChange(option.value)}
                sx={{
                  minWidth: type === 'bedroom' ? 48 : 'auto',
                  px: type === 'bedroom' ? 1 : 2,
                }}
              />
            ))}
          </Box>
        )}
      />
    </Box>
  );
}
