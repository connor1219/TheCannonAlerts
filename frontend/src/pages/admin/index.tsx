import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const theme = useTheme();
  const { user, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect to admin home if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/admin/home');
    }
  }, [user, authLoading, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Use .then()/.catch() instead of async/await to prevent Next.js dev overlay
    // from intercepting Firebase Auth errors before our catch block handles them
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        router.push('/admin/home');
      })
      .catch((err: unknown) => {
        console.error('Login error:', err);
        // Handle Firebase Auth errors - check for code property regardless of Error type
        const errorCode = (err as { code?: string })?.code;
        if (errorCode) {
          switch (errorCode) {
            case 'auth/invalid-email':
              setError('Invalid email address');
              break;
            case 'auth/user-disabled':
              setError('This account has been disabled');
              break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
              setError('Invalid email or password');
              break;
            default:
              setError('Failed to sign in. Please try again.');
          }
        } else {
          setError('Failed to sign in. Please try again.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
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
        <CircularProgress sx={{ color: theme.palette.cannon.yellow }} />
      </Box>
    );
  }

  // Don't show login form if already logged in (redirect in progress)
  if (user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Admin Login - TheCannon Alerts</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="/theCannon.png" />
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.05) 0%, transparent 50%)',
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
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', mt: 1 }}
          >
            Admin Dashboard
          </Typography>
        </Box>

        <Paper
          sx={{
            maxWidth: 400,
            width: '100%',
            p: 4,
            backgroundColor: 'background.paper',
          }}
        >
          <Typography variant="h2" sx={{ mb: 3, textAlign: 'center', fontSize: '1.5rem' }}>
            Sign In
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
              autoComplete="email"
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: 'inherit' }} />
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>
        </Paper>

        <Button
          variant="text"
          onClick={() => router.push('/')}
          sx={{ mt: 3, color: 'text.secondary' }}
        >
          Back to Home
        </Button>
      </Box>
    </>
  );
}
