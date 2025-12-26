import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, Typography, CircularProgress, Alert, Button, Paper, useTheme } from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';

export default function UnsubscribePage() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && typeof id === 'string') {
      handleUnsubscribe(id);
    } else if (router.isReady && !id) {
      setError('No subscription ID provided');
      setLoading(false);
    }
  }, [id, router.isReady]);

  const getFirebaseFunctionUrl = (functionName: string) => {
    return process.env.NODE_ENV === 'development'
      ? `http://127.0.0.1:5001/thecannonmonitor/us-central1/${functionName}`
      : `https://us-central1-thecannonmonitor.cloudfunctions.net/${functionName}`;
  };

  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      const response = await fetch(`${getFirebaseFunctionUrl('unsubscribe')}?id=${encodeURIComponent(subscriptionId)}`);

      if (response.ok) {
        setSuccess(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to unsubscribe');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography
          variant="h1"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '2.25rem', md: '3rem' },
            color: 'text.primary',
          }}
        >
          <Box
            component="span"
            sx={{
              color: theme.palette.cannon.yellow,
              textShadow: '0 0 20px rgba(234, 179, 8, 0.3)',
            }}
          >
            TheCannon
          </Box>{' '}
          Alerts
        </Typography>
      </Box>

      <Paper
        sx={{
          maxWidth: 500,
          width: '100%',
          p: 4,
          textAlign: 'center',
          backgroundColor: 'background.paper',
        }}
      >

        {loading && (
          <Box>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Processing your unsubscribe request...
            </Typography>
          </Box>
        )}

        {success && (
          <Box>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" sx={{ mb: 2, color: 'success.main' }}>
              Successfully Unsubscribed
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              You have been unsubscribed from TheCannon listing alerts.
              You will no longer receive notifications for new listings.
            </Typography>
            <Button
              variant="outlined"
              href="https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date"
              target="_blank"
              sx={{ mb: 2 }}
            >
              Browse Current Listings
            </Button>
            <br />
            <Button
              variant="text"
              onClick={() => router.push('/')}
              size="small"
            >
              Create New Alert
            </Button>
          </Box>
        )}

        {error && (
          <Box>
            <Error sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" sx={{ mb: 2, color: 'error.main' }}>
              Unsubscribe Failed
            </Typography>
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Button
              variant="outlined"
              onClick={() => router.push('/')}
            >
              Go to Home Page
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
