import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Box,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { subscriptionSchema, SubscriptionFormData } from '../schemas/subscriptionSchema';
import { ContactMethodToggle } from './ContactMethodToggle';
import { ContactFieldGroup } from './ContactFieldGroup';
import { FilterChips } from './FilterChips';

interface SubscriptionCardProps {
  onSubmit: (data: SubscriptionFormData) => void;
}

export function SubscriptionCard({ onSubmit }: SubscriptionCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      type: 'EMAIL',
      email: '',
      webhookUrl: '',
      bedroomPreference: 'ANY',
      pricePreference: 'ANY',
    },
  });

  const contactMethod = watch('type');
  const emailValue = watch('email');
  const webhookValue = watch('webhookUrl');

  const hasValidContact = contactMethod === 'EMAIL' 
    ? emailValue && emailValue.includes('@') && emailValue.length > 0
    : webhookValue && webhookValue.startsWith('http') && webhookValue.length > 0;

  const getFirebaseFunctionUrl = (functionName: string) => {
    return process.env.NODE_ENV === 'development'
      ? `http://127.0.0.1:5001/thecannonmonitor/us-central1/${functionName}`
      : `https://us-central1-thecannonmonitor.cloudfunctions.net/${functionName}`;
  };

  const onSubmitForm = async (data: SubscriptionFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      console.log('Sending subscription payload:', data);

      const response = await fetch(getFirebaseFunctionUrl('create_subscription'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const result = await response.json();
      console.log('Subscription created:', result);

      onSubmit(data);
      reset();
    } catch (error) {
      console.error('Error creating subscription:', error);
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      sx={{
        maxWidth: 520,
        mx: 'auto',
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box component="form" onSubmit={handleSubmit(onSubmitForm)}>
          <ContactMethodToggle
            value={contactMethod}
            onChange={(value) => {
              setValue('type', value);
              if (value === 'EMAIL') {
                setValue('webhookUrl', '');
              } else {
                setValue('email', '');
              }
            }}
          />

          <ContactFieldGroup
            contactMethod={contactMethod}
            control={control}
            errors={errors}
          />

          <Typography 
            variant="subtitle2" 
            sx={{ 
              mb: 1,
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '0.875rem',
            }}
          >
            Notify me about...
          </Typography>

          <FilterChips control={control} type="bedroom" />

          <FilterChips control={control} type="price" />

          {submitError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {submitError}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isSubmitting || !hasValidContact}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              mb: 2,
              opacity: (!hasValidContact && !isSubmitting) ? 0.5 : 1,
            }}
          >
            {isSubmitting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                Creating Alert...
              </Box>
            ) : (
              'Start Alerts'
            )}
          </Button>

          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.75rem',
              textAlign: 'center',
              display: 'block',
              lineHeight: 1.4,
            }}
          >
            You&apos;ll receive alerts only when new listings match your filters. You can unsubscribe anytime.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
