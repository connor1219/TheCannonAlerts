import React, { useState, useRef } from 'react';
import {
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { CheckCircle, Send, IosShare, ContentCopy } from '@mui/icons-material';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { SubscriptionFormData } from '../schemas/subscriptionSchema';

// Cloudflare Turnstile site key
const TURNSTILE_SITE_KEY = '0x4AAAAAACOduE7P7y7PKVqb';

interface SuccessMessageProps {
  contactMethod: 'EMAIL' | 'WEBHOOK';
  onReset: () => void;
  subscriptionData?: SubscriptionFormData;
  subscriptionId?: string;
}

export function SuccessMessage({ contactMethod, onReset, subscriptionData, subscriptionId }: SuccessMessageProps) {
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testNotificationResult, setTestNotificationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('postmaster@thecannonalerts.ca');
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  const formatSendTime = (time: string | undefined): string => {
    if (!time) return '9:00 AM';
    const [hours] = time.split(':').map(Number);
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${hour12}:00 ${ampm}`;
  };

  const getNotificationMessage = (): string => {
    if (!subscriptionData) {
      return "When a match is found, you'll be alerted";
    }
    
    switch (subscriptionData.frequency) {
      case 'REAL_TIME':
        return "When a match is found, you'll be alerted instantly";
      case 'DAILY':
        return `You'll receive a daily digest at ${formatSendTime(subscriptionData.sendTime)} EST`;
      case 'WEEKLY':
        return `You'll receive a weekly digest every Sunday at ${formatSendTime(subscriptionData.sendTime)} EST`;
      default:
        return "When a match is found, you'll be alerted";
    }
  };

  const getFirebaseFunctionUrl = (functionName: string) => {
    return process.env.NODE_ENV === 'development'
      ? `http://127.0.0.1:5001/thecannonmonitor/us-central1/${functionName}`
      : `https://us-central1-thecannonmonitor.cloudfunctions.net/${functionName}`;
  };

  const handleSendTestNotification = async () => {
    if (!subscriptionData || !subscriptionId) {
      setTestNotificationResult({ success: false, message: 'Subscription data not available' });
      return;
    }

    if (!turnstileToken) {
      setTestNotificationResult({ success: false, message: 'Please complete the security check first' });
      return;
    }

    setIsSendingTest(true);
    setTestNotificationResult(null);

    try {
      const payload = {
        subscription_id: subscriptionId,
        type: subscriptionData.type,
        turnstileToken,
        ...(subscriptionData.type === 'EMAIL' ? { email: subscriptionData.email } : { webhookUrl: subscriptionData.webhookUrl })
      };

      const response = await fetch(getFirebaseFunctionUrl('send_test_notification'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestNotificationResult({ success: true, message: 'Test notification sent successfully! Check your email or Discord.' });
        // Reset Turnstile for potential future test sends
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      } else {
        // If security error, reset Turnstile
        if (result.error?.includes('security') || result.error?.includes('Security')) {
          turnstileRef.current?.reset();
          setTurnstileToken(null);
        }
        setTestNotificationResult({ success: false, message: result.error || 'Failed to send test notification' });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setTestNotificationResult({ success: false, message: 'Failed to send test notification. Please try again.' });
    } finally {
      setIsSendingTest(false);
    }
  };
  return (
    <Box
      sx={{
        backgroundColor: 'background.paper',
        py: 2,
        px: 4,
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        border: '1px solid',
        borderColor: 'grey.800',
        textAlign: 'center',
      }}
    >
      <Box sx={{ mb: 3 }}>
        <CheckCircle
          sx={{
            fontSize: 64,
            color: '#10B981',
            filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))',
          }}
        />
      </Box>

      <Typography 
        variant="h4" 
        sx={{ 
          mb: 5, 
          fontSize: '1.75rem', 
          fontWeight: 700,
          color: 'text.primary',
          letterSpacing: '0.02em',
        }}
      >
        Alert Created Successfully!
      </Typography>

      <Box 
        sx={{ 
          mb: 2, 
          p: 3, 
          backgroundColor: 'background.default', 
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'grey.800',
        }}
      >
        <Typography 
          variant="subtitle2" 
          sx={{ 
            mb: 2, 
            fontWeight: 600,
            color: 'text.primary',
            fontSize: '0.95rem',
          }}
        >
          What happens next?
        </Typography>
        <Box 
          sx={{ 
            textAlign: 'left',
            color: 'text.secondary',
            lineHeight: 1.8,
            fontSize: '0.9rem',
            '& > .bullet-item': {
              display: 'flex',
              alignItems: 'flex-start',
              mb: 1,
              '&:before': {
                content: '"•"',
                color: 'primary.main',
                fontWeight: 'bold',
                width: '1em',
                flexShrink: 0,
                marginRight: '0.5em',
              },
            },
          }}
        >
          <Box className="bullet-item">We&apos;ll monitor TheCannon for new listings</Box>
          <Box className="bullet-item">{getNotificationMessage()}</Box>
          {contactMethod === 'EMAIL' && (
            <Box className="bullet-item">
              <Box component="span">
                Add{' '}
                <Tooltip title={emailCopied ? 'Copied!' : 'Click to copy'} arrow>
                  <Box
                    component="span"
                    onClick={handleCopyEmail}
                    sx={{
                      fontWeight: 600,
                      color: '#3B82F6',
                      cursor: 'pointer',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    postmaster@thecannonalerts.ca
                    <ContentCopy sx={{ fontSize: 12, ml: 0.5, verticalAlign: 'middle' }} />
                  </Box>
                </Tooltip>
                {' '}to your email contacts to avoid emails being sent to your spam or junk folder
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {subscriptionData && subscriptionId && (
        <Box sx={{ mb: 2 }}>
          {testNotificationResult && (
            <Alert
              severity={testNotificationResult.success ? 'success' : 'error'}
              sx={{
                mb: 2,
                fontSize: '0.9rem',
              }}
            >
              {testNotificationResult.message}
            </Alert>
          )}

          {/* Turnstile widget for test notification */}
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => setTurnstileToken(token)}
              onError={() => setTurnstileToken(null)}
              onExpire={() => setTurnstileToken(null)}
              options={{
                theme: 'dark',
                size: 'normal',
              }}
            />
          </Box>

          <Button
            variant="contained"
            onClick={handleSendTestNotification}
            disabled={isSendingTest || !turnstileToken}
            fullWidth
            startIcon={isSendingTest ? <CircularProgress size={16} /> : <Send />}
            sx={{
              py: 1.5,
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'none',
              color: 'secondary.contrastText',
              transition: 'all 0.2s ease-in-out',
              opacity: !turnstileToken ? 0.5 : 1,
            }}
          >
            {isSendingTest ? 'Sending Test...' : 'Send Test Notification'}
          </Button>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button
          variant="outlined"
          onClick={onReset}
          fullWidth
          sx={{
            py: 1.5,
            fontSize: '0.95rem',
            fontWeight: 600,
            textTransform: 'none',
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              transform: 'scale(1.02)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          Create Another Alert
        </Button>
        
        <Button
          variant="outlined"
          onClick={() => window.open(`sms:&body=Check%20this%20out%20https://thecannonalerts.ca/`, '_blank')}
          startIcon={<IosShare />}
          fullWidth
          sx={{
            py: 1.5,
            fontSize: '0.95rem',
            fontWeight: 600,
            textTransform: 'none',
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              transform: 'scale(1.02)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          Share This Site
        </Button>
      </Box>
    </Box>
  );
}
