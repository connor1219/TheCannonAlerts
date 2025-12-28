import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Control, Controller } from 'react-hook-form';
import { SubscriptionFormData, BedroomValue, PriceValue } from '../schemas/subscriptionSchema';

interface FilterChipsProps {
  control: Control<SubscriptionFormData>;
  type: 'bedroom' | 'price';
}

const bedroomOptions: { value: BedroomValue; label: string }[] = [
  { value: 'ANY', label: 'Any' },
  { value: 'B1', label: '1' },
  { value: 'B2', label: '2' },
  { value: 'B3', label: '3' },
  { value: 'B4', label: '4' },
  { value: 'B5_PLUS', label: '5+' },
];

const priceOptions: { value: PriceValue; label: string }[] = [
  { value: 'ANY', label: 'Any' },
  { value: 'P0_399', label: '$0–399' },
  { value: 'P400_699', label: '$400–699' },
  { value: 'P700_999', label: '$700–999' },
  { value: 'P1000_1499', label: '$1000–1499' },
  { value: 'P1500_PLUS', label: '$1500+' },
];

export function FilterChips({ control, type }: FilterChipsProps) {
  const options = type === 'bedroom' ? bedroomOptions : priceOptions;
  const fieldName = type === 'bedroom' ? 'bedroomPreferences' : 'pricePreferences' as const;
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
        name={fieldName}
        control={control}
        render={({ field }) => {
          const selectedValues = (field.value || ['ANY']) as string[];
          
          const handleToggle = (value: string) => {
            const currentValues = [...selectedValues];
            const isSelected = currentValues.includes(value);
            
            if (value === 'ANY') {
              // If clicking ANY, select only ANY
              field.onChange(['ANY']);
            } else if (isSelected) {
              // If unselecting a non-ANY option
              const newValues = currentValues.filter(v => v !== value);
              // If nothing left selected, default to ANY
              field.onChange(newValues.length === 0 ? ['ANY'] : newValues);
            } else {
              // If selecting a non-ANY option, remove ANY and add the new value
              const newValues = currentValues.filter(v => v !== 'ANY');
              newValues.push(value);
              field.onChange(newValues);
            }
          };
          
          return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <Chip
                    key={option.value}
                    label={option.label}
                    clickable
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => handleToggle(option.value)}
                    sx={{
                      minWidth: type === 'bedroom' ? 48 : 'auto',
                      px: type === 'bedroom' ? 1 : 2,
                    }}
                  />
                );
              })}
            </Box>
          );
        }}
      />
    </Box>
  );
}
