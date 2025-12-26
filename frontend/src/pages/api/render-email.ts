import { NextApiRequest, NextApiResponse } from 'next';
import { renderTheCannonAlertEmail } from '../../emails/renderEmail';
import { TheCannonAlertEmailProps } from '../../emails/TheCannonAlertEmail';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const emailProps: TheCannonAlertEmailProps = req.body;
    
    if (!emailProps.price || !emailProps.bedrooms || !emailProps.address) {
      return res.status(400).json({ 
        error: 'Missing required email props: price, bedrooms, address' 
      });
    }
    
    const emailHtml = renderTheCannonAlertEmail(emailProps);
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(emailHtml);
    
  } catch (error) {
    console.error('Error rendering email:', error);
    res.status(500).json({ 
      error: 'Failed to render email template'
    });
  }
}
