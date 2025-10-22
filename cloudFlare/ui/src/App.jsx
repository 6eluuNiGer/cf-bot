import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline, Container, Snackbar, Alert, AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import RefreshIcon from '@mui/icons-material/Refresh';
import { makeTheme } from './theme';
import { listUsers, addUser, deleteUser } from './api';

import TokenBar from './components/TokenBar';
import AddUserForm from './components/AddUserForm';
import UsersTable from './components/UsersTable';

export default function App() {
  const [mode, setMode] = useState(localStorage.getItem('uiTheme') || 'light');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });

  const theme = useMemo(() => makeTheme(mode), [mode]);
  const onSnack = (msg, sev = 'success') => setSnack({ open: true, msg, sev });

  const load = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return setUsers([]);
    setLoading(true);
    try {
      const j = await listUsers();
      setUsers(j.items || []);
    } catch (e) {
      onSnack(e.message || 'Авторизація не вдалася', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async (payload) => {
    await addUser(payload);
    await load();
  };

  const del = async (id) => {
    await deleteUser(id);
    await load();
    onSnack('Користувача видалено', 'info');
  };

  const toggleMode = () => {
    const m = mode === 'light' ? 'dark' : 'light';
    setMode(m);
    localStorage.setItem('uiTheme', m);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', width:'100vw' }}>
      <AppBar position="sticky" color="primary" elevation={1}>
        <Toolbar>
          <ShieldIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Admin Panel — Whitelist</Typography>
          <IconButton color="inherit" onClick={load} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <TokenBar mode={mode} onToggleMode={toggleMode} onSaved={load} onSnack={onSnack} />
        <AddUserForm onAdd={add} onSnack={onSnack} />
        <UsersTable users={users} loading={loading} onDelete={del} onSnack={onSnack} />
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
