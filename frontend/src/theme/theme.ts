import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    cannon: {
      yellow: string;
      darkBlue: string;
      cardBackground: string;
    };
  }

  interface PaletteOptions {
    cannon?: {
      yellow?: string;
      darkBlue?: string;
      cardBackground?: string;
    };
  }
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#EAB308',
      light: '#FCD34D',
      dark: '#D97706',
    },
    secondary: {
      main: '#38BDF8',
      light: '#7DD3FC',
      dark: '#0284C7',
    },
    cannon: {
      yellow: '#EAB308',
      darkBlue: '#050816',
      cardBackground: '#0B1120',
    },
    background: {
      default: '#050816',
      paper: '#0B1120',
    },
    text: {
      primary: '#F9FAFB',
      secondary: '#9CA3AF',
    },
    error: {
      main: '#F97373',
    },
    divider: '#374151',
  },
  typography: {
    fontFamily: '"Space Grotesk", "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      fontWeight: 400,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 24,
          padding: '12px 32px',
          fontSize: '1rem',
          fontWeight: 600,
        },
        contained: {
          boxShadow: '0 4px 12px rgba(234, 179, 8, 0.3)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(234, 179, 8, 0.4)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#0B1120',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          borderRadius: 16,
          border: '1px solid #374151',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          height: 40,
          fontSize: '0.875rem',
          fontWeight: 500,
          border: '1px solid #374151',
          transition: 'none !important',
          '&.MuiChip-outlined': {
            backgroundColor: 'transparent',
            color: '#9CA3AF',
            transition: 'none !important',
            '&:hover': {
              backgroundColor: 'rgba(56, 189, 248, 0.1) !important',
              borderColor: '#38BDF8 !important',
              transition: 'none !important',
            },
          },
          '&.MuiChip-filled': {
            backgroundColor: '#EAB308 !important',
            color: '#0B1120 !important',
            border: 'none !important',
            transition: 'none !important',
            '&:hover': {
              backgroundColor: '#D97706 !important',
              transition: 'none !important',
            },
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#111827',
            borderRadius: 12,
            '& fieldset': {
              borderColor: '#374151',
            },
            '&:hover fieldset': {
              borderColor: '#38BDF8',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#EAB308',
              boxShadow: '0 0 0 3px rgba(234, 179, 8, 0.1)',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#9CA3AF',
          },
          '& .MuiOutlinedInput-input': {
            color: '#F9FAFB',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          padding: '12px 24px',
          border: '2px solid #374151',
          backgroundColor: 'transparent',
          color: '#9CA3AF',
          fontWeight: 500,
          transition: 'none !important',
          '&.Mui-selected': {
            backgroundColor: '#EAB308 !important',
            color: '#0B1120 !important',
            borderColor: '#EAB308 !important',
            transition: 'none !important',
            '&:hover': {
              backgroundColor: '#D97706 !important',
              transition: 'none !important',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(56, 189, 248, 0.1) !important',
            borderColor: '#38BDF8 !important',
            transition: 'none !important',
          },
        },
      },
    },
  },
});

export default theme;
