import { z } from 'zod';

const bedroomValues = ['ANY', 'B1', 'B2', 'B3', 'B4', 'B5_PLUS'] as const;
const priceValues = ['ANY', 'P0_399', 'P400_699', 'P700_999', 'P1000_1499', 'P1500_PLUS'] as const;

export const subscriptionSchema = z.object({
  type: z.enum(['EMAIL', 'WEBHOOK']),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  webhookUrl: z.string().url('Please enter a valid webhook URL').optional().or(z.literal('')),
  bedroomPreferences: z.array(z.enum(bedroomValues)).min(1, 'Select at least one bedroom option'),
  pricePreferences: z.array(z.enum(priceValues)).min(1, 'Select at least one price option'),
}).refine((data) => {
  if (data.type === 'EMAIL') {
    return data.email && data.email.length > 0;
  }
  if (data.type === 'WEBHOOK') {
    return data.webhookUrl && data.webhookUrl.length > 0;
  }
  return true;
}, {
  message: 'Email is required for email notifications, webhook URL is required for webhook notifications',
  path: ['email'],
});

export type SubscriptionFormData = z.infer<typeof subscriptionSchema>;
export type BedroomValue = typeof bedroomValues[number];
export type PriceValue = typeof priceValues[number];

export const getBedroomLabel = (value: string): string => {
  const labels: Record<string, string> = {
    'ANY': 'Any',
    'B1': '1 Bedroom',
    'B2': '2 Bedrooms',
    'B3': '3 Bedrooms',
    'B4': '4 Bedrooms',
    'B5_PLUS': '5+ Bedrooms',
  };
  return labels[value] || value;
};

export const getPriceLabel = (value: string): string => {
  const labels: Record<string, string> = {
    'ANY': 'Any Price',
    'P0_399': '$0 - $399',
    'P400_699': '$400 - $699',
    'P700_999': '$700 - $999',
    'P1000_1499': '$1000 - $1499',
    'P1500_PLUS': '$1500+',
  };
  return labels[value] || value;
};
