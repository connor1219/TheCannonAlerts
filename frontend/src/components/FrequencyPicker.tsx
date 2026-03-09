import React from 'react';
import { Box, Chip, Typography, FormControl, Select, MenuItem, Collapse } from '@mui/material';
import { Control, Controller, useWatch } from 'react-hook-form';
import { SubscriptionFormData, FrequencyValue } from '../schemas/subscriptionSchema';
import { Schedule, Bolt, CalendarMonth, ViewWeek } from '@mui/icons-material';

interface FrequencyPickerProps {
  control: Control<SubscriptionFormData>;
}

const frequencyOptions: { value: FrequencyValue; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    value: 'REAL_TIME', 
    label: 'Real-time', 
    description: 'Get notified instantly when new listings appear',
    icon: <Bolt sx={{ fontSize: 16 }} />
  },
  { 
    value: 'DAILY', 
    label: 'Daily', 
    description: 'Receive a summary of new listings once per day',
    icon: <CalendarMonth sx={{ fontSize: 16 }} />
  },
  { 
    value: 'WEEKLY', 
    label: 'Weekly', 
    description: 'Receive a summary of new listings once per week (Sundays)',
    icon: <ViewWeek sx={{ fontSize: 16 }} />
  },
];

// Generate hourly time options (00:00 to 23:00)
const timeOptions = Array.from({ length: 24 }, (_, hour) => {
  const hour24 = hour.toString().padStart(2, '0');
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return {
    value: `${hour24}:00`,
    label: `${hour12}:00 ${ampm}`,
  };
});

export function FrequencyPicker({ control }: FrequencyPickerProps) {
  const frequency = useWatch({ control, name: 'frequency' });
  const showTimeField = frequency === 'DAILY' || frequency === 'WEEKLY';

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
        NOTIFICATION FREQUENCY
      </Typography>
      
      <Controller
        name="frequency"
        control={control}
        render={({ field }) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {frequencyOptions.map((option) => {
              const isSelected = field.value === option.value;
              return (
                <Chip
                  key={option.value}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {option.icon}
                      {option.label}
                    </Box>
                  }
                  clickable
                  variant={isSelected ? 'filled' : 'outlined'}
                  onClick={() => field.onChange(option.value)}
                  sx={{
                    px: 1,
                  }}
                />
              );
            })}
          </Box>
        )}
      />

      {/* Description text for selected frequency */}
      <Typography 
        variant="caption" 
        sx={{ 
          mt: 1.5,
          color: 'text.secondary',
          fontSize: '0.75rem',
          display: 'block',
          fontStyle: 'italic',
        }}
      >
        {frequencyOptions.find(o => o.value === frequency)?.description}
      </Typography>

      {/* Send time dropdown - only shown for daily/weekly */}
      <Collapse in={showTimeField}>
        <Box sx={{ mt: 2 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              mb: 1,
              fontWeight: 600,
              color: 'text.secondary',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Schedule sx={{ fontSize: 14 }} />
            SEND TIME (EST)
          </Typography>
          
          <Controller
            name="sendTime"
            control={control}
            render={({ field }) => (
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select
                  {...field}
                  value={field.value || '09:00'}
                  displayEmpty
                  sx={{
                    fontSize: '0.9rem',
                    '& .MuiSelect-select': {
                      py: 1,
                    },
                  }}
                >
                  {timeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          
          <Typography 
            variant="caption" 
            sx={{ 
              mt: 0.5,
              color: 'text.secondary',
              fontSize: '0.7rem',
              display: 'block',
            }}
          >
            {frequency === 'WEEKLY' ? 'Digest sent every Sunday at this time' : 'Digest sent daily at this time'}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
}
