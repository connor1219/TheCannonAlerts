import { onRequest } from 'firebase-functions/v2/https';
import { renderTheCannonAlertEmail, TheCannonAlertEmailProps } from './emails/renderEmail';
import type { Request, Response } from 'express';

function isValidProps(body: any): body is TheCannonAlertEmailProps {
  return Boolean(body)
    && typeof body.price === 'string'
    && typeof body.bedrooms === 'string'
    && typeof body.address === 'string'
    && typeof body.listingUrl === 'string'
    && typeof body.subscriptionBedrooms === 'string'
    && typeof body.subscriptionPriceRange === 'string';
}

export const renderEmail = onRequest((req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const emailProps = req.body;

    if (!isValidProps(emailProps)) {
      res.status(400).json({
        error: 'Missing or invalid required email props',
        required: [
          'price',
          'bedrooms',
          'address',
          'listingUrl',
          'subscriptionBedrooms',
          'subscriptionPriceRange',
        ],
      });
      return;
    }

    const html = renderTheCannonAlertEmail(emailProps);
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error rendering email:', error);
    res.status(500).json({ error: 'Failed to render email template' });
  }
});

