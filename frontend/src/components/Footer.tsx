import React from 'react';
import { Box, Typography, Link, useTheme } from '@mui/material';

export function Footer() {
  const theme = useTheme();

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 4,
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary',
            fontSize: '0.75rem',
            lineHeight: 1.5,
          }}
        >
          Not affiliated with TheCannon.ca or the University of Guelph. Built by students for students.
        </Typography>
      </Box>
    </Box>
  );
}
