import { NextApiRequest, NextApiResponse } from 'next';
import { renderTheCannonDigestEmail } from '../../emails/renderEmail';
import { TheCannonDigestEmailProps } from '../../emails/TheCannonDigestEmail';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const emailProps: TheCannonDigestEmailProps = req.body;
    
    if (!emailProps.listings || !emailProps.digestType || !emailProps.subscriptionBedrooms || !emailProps.subscriptionPriceRange) {
      return res.status(400).json({ 
        error: 'Missing required email props: listings, digestType, subscriptionBedrooms, subscriptionPriceRange' 
      });
    }
    
    const emailHtml = renderTheCannonDigestEmail(emailProps);
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(emailHtml);
    
  } catch (error) {
    console.error('Error rendering digest email:', error);
    res.status(500).json({ 
      error: 'Failed to render digest email template'
    });
  }
}
