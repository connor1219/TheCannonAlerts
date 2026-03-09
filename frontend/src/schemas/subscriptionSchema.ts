import { z } from 'zod';

const bedroomValues = ['ANY', 'B1', 'B2', 'B3', 'B4', 'B5_PLUS'] as const;
const frequencyValues = ['REAL_TIME', 'DAILY', 'WEEKLY'] as const;

export const subscriptionSchema = z.object({
  type: z.enum(['EMAIL', 'WEBHOOK']),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  webhookUrl: z.string().url('Please enter a valid webhook URL').optional().or(z.literal('')),
  bedroomPreferences: z.array(z.enum(bedroomValues)).min(1, 'Select at least one bedroom option'),
  minPrice: z.number().int().nonnegative().nullable().optional(),
  maxPrice: z.number().int().nonnegative().nullable().optional(),
  frequency: z.enum(frequencyValues),
  sendTime: z.string().optional().or(z.literal('')),
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
}).refine((data) => {
  if (data.minPrice != null && data.maxPrice != null) {
    return data.minPrice <= data.maxPrice;
  }
  return true;
}, {
  message: 'Min price must be less than or equal to max price',
  path: ['maxPrice'],
});

export type SubscriptionFormData = z.infer<typeof subscriptionSchema>;
export type BedroomValue = typeof bedroomValues[number];
export type FrequencyValue = typeof frequencyValues[number];

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

export const formatPriceRange = (minPrice?: number | null, maxPrice?: number | null): string => {
  if (minPrice == null && maxPrice == null) return 'Any price';
  if (minPrice != null && maxPrice == null) return `$${minPrice.toLocaleString()}+`;
  if (minPrice == null && maxPrice != null) return `Up to $${maxPrice.toLocaleString()}`;
  return `$${minPrice!.toLocaleString()} - $${maxPrice!.toLocaleString()}`;
};

export const getFrequencyLabel = (value: string): string => {
  const labels: Record<string, string> = {
    'REAL_TIME': 'Real-time',
    'DAILY': 'Daily digest',
    'WEEKLY': 'Weekly digest',
  };
  return labels[value] || value;
};
