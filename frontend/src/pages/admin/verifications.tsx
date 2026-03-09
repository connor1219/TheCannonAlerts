import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Logout, Refresh, ArrowBack } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { VerificationsTable } from '../../components/VerificationsTable';
import { Subscription } from '../../components/SubscriptionsTable';
import { AdminStatCard } from '../../components/AdminStatCard';

export default function AdminVerificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut, getIdToken } = useAuth();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'verify' | 'decline' | null>(null);

  const getFirebaseFunctionUrl = (functionName: string) => {
    return process.env.NODE_ENV === 'development'
      ? `http://127.0.0.1:5001/thecannonmonitor/us-central1/${functionName}`
      : `https://us-central1-thecannonmonitor.cloudfunctions.net/${functionName}`;
  };

  const fetchPendingVerifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Failed to get authentication token');
        setLoading(false);
        return;
      }

      const response = await fetch(getFirebaseFunctionUrl('get_pending_verifications'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch pending verifications');
      }

      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error('Error fetching pending verifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pending verifications');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/admin');
    }
  }, [user, authLoading, router]);

  // Fetch pending verifications when authenticated
  useEffect(() => {
    if (user && !authLoading) {
      fetchPendingVerifications();
    }
  }, [user, authLoading, fetchPendingVerifications]);

  const handleVerify = async (subscriptionId: string) => {
    setProcessingId(subscriptionId);
    setProcessingAction('verify');

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Failed to get authentication token');
        return;
      }

      const response = await fetch(getFirebaseFunctionUrl('admin_verify_subscription'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify subscription');
      }

      // Remove from local state
      setSubscriptions((prev) => prev.filter((sub) => sub.id !== subscriptionId));
    } catch (err) {
      console.error('Error verifying subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify subscription');
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const handleDecline = async (subscriptionId: string) => {
    setProcessingId(subscriptionId);
    setProcessingAction('decline');

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Failed to get authentication token');
        return;
      }

      const response = await fetch(getFirebaseFunctionUrl('admin_decline_subscription'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decline subscription');
      }

      // Remove from local state
      setSubscriptions((prev) => prev.filter((sub) => sub.id !== subscriptionId));
    } catch (err) {
      console.error('Error declining subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to decline subscription');
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin');
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Don't render if not authenticated (redirect in progress)
  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Verify Subscriptions - TheCannon Alerts Admin</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="/theCannon.png" />
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Container maxWidth="xl">
            <Box
              sx={{
                py: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.5rem', md: '2rem' },
                    color: 'text.primary',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      color: '#EAB308',
                    }}
                  >
                    TheCannon
                  </Box>{' '}
                  Verifications
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {user.email}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Link href="/admin/home" passHref legacyBehavior>
                  <Button
                    component="a"
                    variant="outlined"
                    startIcon={<ArrowBack />}
                    sx={{ borderColor: 'divider', minWidth: 130 }}
                  >
                    Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchPendingVerifications}
                  disabled={loading}
                  sx={{ borderColor: 'divider', minWidth: 130 }}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Logout />}
                  onClick={handleSignOut}
                  sx={{ borderColor: 'divider', minWidth: 130 }}
                >
                  Sign Out
                </Button>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Main Content */}
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Stats Summary */}
          <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <AdminStatCard label="Pending Verifications" value={subscriptions.length} />
          </Box>

          {/* Description */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Review and verify email subscriptions before they can receive notifications.
              Webhook subscriptions are automatically verified.
            </Typography>
          </Box>

          {/* Table */}
          <VerificationsTable
            subscriptions={subscriptions}
            loading={loading}
            onVerify={handleVerify}
            onDecline={handleDecline}
            processingId={processingId}
            processingAction={processingAction}
          />
        </Container>
      </Box>
    </>
  );
}
