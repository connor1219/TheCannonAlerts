import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  Alert,
  useTheme,
  Badge,
} from '@mui/material';
import { Logout, Refresh, VerifiedUser } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionsTable, Subscription } from '../../components/SubscriptionsTable';
import { AdminStatCard } from '../../components/AdminStatCard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`subscription-tabpanel-${index}`}
      aria-labelledby={`subscription-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `subscription-tab-${index}`,
    'aria-controls': `subscription-tabpanel-${index}`,
  };
}

export default function AdminHomePage() {
  const router = useRouter();
  const theme = useTheme();
  const { user, loading: authLoading, signOut, getIdToken } = useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  const getFirebaseFunctionUrl = (functionName: string) => {
    return process.env.NODE_ENV === 'development'
      ? `http://127.0.0.1:5001/thecannonmonitor/us-central1/${functionName}`
      : `https://us-central1-thecannonmonitor.cloudfunctions.net/${functionName}`;
  };

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Failed to get authentication token');
        setLoading(false);
        return;
      }

      // Fetch subscriptions and pending verifications in parallel
      const [subscriptionsResponse, verificationsResponse] = await Promise.all([
        fetch(getFirebaseFunctionUrl('get_all_subscriptions'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(getFirebaseFunctionUrl('get_pending_verifications'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!subscriptionsResponse.ok) {
        const errorData = await subscriptionsResponse.json();
        throw new Error(errorData.error || 'Failed to fetch subscriptions');
      }

      const subscriptionsData = await subscriptionsResponse.json();
      setSubscriptions(subscriptionsData.subscriptions || []);

      // Set pending verifications count (don't throw error if this fails)
      if (verificationsResponse.ok) {
        const verificationsData = await verificationsResponse.json();
        setPendingVerificationsCount((verificationsData.subscriptions || []).length);
      }
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscriptions');
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

  // Fetch subscriptions when authenticated
  useEffect(() => {
    if (user && !authLoading) {
      fetchSubscriptions();
    }
  }, [user, authLoading, fetchSubscriptions]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDisable = async (subscriptionId: string) => {
    setDisablingId(subscriptionId);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Failed to get authentication token');
        return;
      }

      const response = await fetch(getFirebaseFunctionUrl('admin_disable_subscription'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disable subscription');
      }

      // Update local state to reflect the change
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId
            ? { ...sub, disabled: new Date().toISOString() }
            : sub
        )
      );
    } catch (err) {
      console.error('Error disabling subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable subscription');
    } finally {
      setDisablingId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin');
  };

  // Filter subscriptions by status
  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.disabled === null || sub.disabled === undefined
  );
  const disabledSubscriptions = subscriptions.filter(
    (sub) => sub.disabled !== null && sub.disabled !== undefined
  );

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
        <CircularProgress sx={{ color: theme.palette.cannon.yellow }} />
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
        <title>Admin Dashboard - TheCannon Alerts</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="/theCannon.png" />
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.05) 0%, transparent 50%)',
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
                      color: theme.palette.cannon.yellow,
                      textShadow: '0 0 20px rgba(234, 179, 8, 0.3)',
                    }}
                  >
                    TheCannon
                  </Box>{' '}
                  Admin
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {user.email}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Link href="/admin/verifications" passHref legacyBehavior>
                  <Button
                    component="a"
                    variant="outlined"
                    startIcon={
                      <Badge
                        badgeContent={pendingVerificationsCount}
                        color="error"
                        sx={{
                          '& .MuiBadge-badge': {
                            fontSize: '0.7rem',
                            height: 18,
                            minWidth: 18,
                          },
                        }}
                      >
                        <VerifiedUser />
                      </Badge>
                    }
                    sx={{ borderColor: 'divider', minWidth: 130 }}
                  >
                    Verifications
                  </Button>
                </Link>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchSubscriptions}
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
            <AdminStatCard label="Total Subscriptions" value={subscriptions.length} />
            <AdminStatCard label="Active" value={activeSubscriptions.length} color="#22c55e" />
            <AdminStatCard label="Disabled" value={disabledSubscriptions.length} color="#ef4444" />
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="subscription tabs"
              sx={{
                '& .MuiTab-root': {
                  color: 'text.secondary',
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '1rem',
                  '&.Mui-selected': {
                    color: theme.palette.cannon.yellow,
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: theme.palette.cannon.yellow,
                },
              }}
            >
              <Tab label={`Active (${activeSubscriptions.length})`} {...a11yProps(0)} />
              <Tab label={`Disabled (${disabledSubscriptions.length})`} {...a11yProps(1)} />
            </Tabs>
          </Box>

          {/* Tab Panels */}
          <TabPanel value={tabValue} index={0}>
            <SubscriptionsTable
              subscriptions={activeSubscriptions}
              loading={loading}
              onDisable={handleDisable}
              disablingId={disablingId}
              showDisableButton={true}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <SubscriptionsTable
              subscriptions={disabledSubscriptions}
              loading={loading}
              onDisable={handleDisable}
              disablingId={disablingId}
              showDisableButton={false}
            />
          </TabPanel>
        </Container>
      </Box>
    </>
  );
}
