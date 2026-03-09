import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '../theme/theme';
import { AuthProvider } from '../contexts/AuthContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  )
}