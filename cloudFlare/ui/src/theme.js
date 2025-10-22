import { createTheme } from '@mui/material/styles';

export const makeTheme = (mode = 'light') => createTheme({
  palette: { mode },
  components: {
    MuiButton: {
      styleOverrides: {
        sizeSmall: {
          minHeight: 28,
          paddingTop: 2,
          paddingBottom: 2,
          paddingLeft: 10,
          paddingRight: 10,
          lineHeight: 1.1
        },
        startIcon: { marginRight: 6 }
      }
    }
  }
});
