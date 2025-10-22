import { useEffect, useMemo, useState } from 'react';
import {
  AppBar, Toolbar, IconButton, Typography, Container, Paper, Stack,
  TextField, Button, InputAdornment, Tooltip, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Skeleton, Divider, Box, Switch, FormControlLabel
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
  Shield as ShieldIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon
} from '@mui/icons-material';
import { listUsers, addUser, deleteUser } from './api';

// ---- простий theme toggle без ThemeProvider на рівні App (щоб не тягнути додаткових файлів)
function useColorMode() {
  const [mode, setMode] = useState(localStorage.getItem('uiTheme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('uiTheme', mode);
  }, [mode]);
  const toggle = () => setMode(m => (m === 'light' ? 'dark' : 'light'));
  return { mode, toggle };
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState('');

  const [confirmId, setConfirmId] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });

  const { mode, toggle } = useColorMode();

  const showSnack = (msg, sev = 'success') => setSnack({ open: true, msg, sev });

  const saveToken = async () => {
    const t = token.trim();
    if (!t) {
      showSnack('Введіть Admin Token', 'warning');
      return;
    }
    localStorage.setItem('adminToken', t);
    await load();
    showSnack('Токен збережено');
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setToken('');
    setUsers([]);
    showSnack('Токен очищено', 'info');
  };

  const validate = () => {
    const e = {};
    const u = username.trim();
    const id = telegramId.trim();
    if (!u && !id) e.form = 'Вкажіть принаймні username або Telegram ID';
    if (u && !/^@?[a-zA-Z0-9_]{3,}$/.test(u)) e.username = 'Некоректний username';
    if (id && !/^\d+$/.test(id)) e.telegramId = 'ID має бути числом';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearForm = () => {
    setUsername('');
    setTelegramId('');
    setErrors({});
  };

  const onAdd = async () => {
    if (!validate()) return;
    try {
      const j = await addUser({
        username: username ? username.replace(/^@/, '') : undefined,
        telegramId: telegramId || undefined
      });
      if (j.ok) {
        clearForm();
        await load();
        showSnack('Користувача додано');
      } else {
        showSnack(j.error || 'Помилка створення', 'error');
      }
    } catch (e) {
      showSnack(e.message || 'Помилка мережі', 'error');
    }
  };

  const onDelete = async (id) => {
    try {
      const j = await deleteUser(id);
      if (j.ok) {
        setConfirmId(null);
        await load();
        showSnack('Користувача видалено', 'info');
      } else {
        showSnack(j.error || 'Помилка видалення', 'error');
      }
    } catch (e) {
      showSnack(e.message || 'Помилка мережі', 'error');
    }
  };

  const load = async () => {
    if (!token) return setUsers([]);
    setLoading(true);
    try {
      const j = await listUsers();
      if (j.ok) setUsers(j.items || []);
      else showSnack(j.error || 'Авторизація не вдалася', 'error');
    } catch (e) {
      showSnack(e.message || 'Помилка завантаження', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = users.slice();
    // сортування за датою (нові зверху)
    arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (!q) return arr;
    return arr.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      String(u.telegramId || '').includes(q)
    );
  }, [users, search]);

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      showSnack('Токен скопійовано в буфер');
    } catch {
      showSnack('Не вдалось скопіювати', 'warning');
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: mode === 'dark' ? 'background.default' : '#f6f7fb',
      color: 'text.primary',
      transition: 'background-color .2s ease',
      width: '100vw'
    }}>
      {/* App Bar */}
      <AppBar position="sticky" color="primary" elevation={1}>
        <Toolbar>
          <ShieldIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Admin Panel — Whitelist
          </Typography>

          <Tooltip title={mode === 'dark' ? 'Світла тема' : 'Темна тема'}>
            <IconButton color="inherit" onClick={toggle} sx={{ mr: 1 }}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Оновити">
            <span>
              <IconButton color="inherit" onClick={load} disabled={!token || loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={token ? 'Очистити токен' : 'Ввести токен'}>
            <IconButton color="inherit" onClick={token ? logout : saveToken}>
              {token ? <LogoutIcon /> : <SaveIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Token card */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Admin Token"
              fullWidth
              value={token}
              onChange={e => setToken(e.target.value)}
              type="password"
            />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={copyToken} disabled={!token}><CopyIcon sx={{ mr: .5 }} />Copy</Button>
              <Button variant="contained" onClick={saveToken}><SaveIcon sx={{ mr: .5 }} />Save</Button>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
            <Chip size="small" color={token ? 'success' : 'default'} label={token ? 'Token set' : 'No token'} />
            <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />
            <FormControlLabel control={<Switch checked={mode === 'dark'} onChange={toggle} />} label="Dark mode" />
          </Stack>
        </Paper>

        {/* Add user card */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Додати користувача</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Telegram username (@...)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              error={!!errors.username || !!errors.form}
              helperText={errors.username ? errors.username : 'Необовʼязково, достатньо ID'}
              InputProps={{
                startAdornment: <InputAdornment position="start">@</InputAdornment>
              }}
            />
            <TextField
              label="Telegram ID"
              value={telegramId}
              onChange={e => setTelegramId(e.target.value)}
              error={!!errors.telegramId || !!errors.form}
              helperText={errors.telegramId ? errors.telegramId : 'Числове значення (optional)'}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={clearForm}>Clear</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} disabled={!token}>
                Add
              </Button>
            </Stack>
          </Stack>
          {errors.form && <Alert severity="warning" sx={{ mt: 1 }}>{errors.form}</Alert>}
        </Paper>

        {/* Search */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Пошук за username або ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
        </Paper>

        {/* Users table */}
        <Paper sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell width={160}>Telegram ID</TableCell>
                  <TableCell width={220}>Created</TableCell>
                  <TableCell align="right" width={120}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`sk${i}`}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton width="60%" /></TableCell>
                    <TableCell><Skeleton width="80%" /></TableCell>
                    <TableCell align="right"><Skeleton width="50%" /></TableCell>
                  </TableRow>
                ))}

                {!loading && filtered.map(u => (
                  <TableRow key={u._id} hover>
                    <TableCell>{u.username || <Chip size="small" label="—" />}</TableCell>
                    <TableCell>{u.telegramId || <Chip size="small" label="—" />}</TableCell>
                    <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Видалити">
                        <span>
                          <IconButton color="error" onClick={() => setConfirmId(u._id)} size="small">
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Box sx={{ py: 4, textAlign: 'center', opacity: .7 }}>
                        <Typography>Користувачів не знайдено</Typography>
                        <Typography variant="body2">Спробуйте змінити фільтр або додайте першого користувача.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>

      {/* Confirm delete */}
      <Dialog open={!!confirmId} onClose={() => setConfirmId(null)}>
        <DialogTitle>Підтвердіть видалення</DialogTitle>
        <DialogContent>Цю дію не можна скасувати.</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)}>Скасувати</Button>
          <Button color="error" variant="contained" onClick={() => onDelete(confirmId)} startIcon={<DeleteIcon />}>
            Видалити
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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

      {/* Невеликий CSS для теми */}
      <style>{`
        :root { color-scheme: light; }
        [data-theme="dark"] { color-scheme: dark; }
        [data-theme="dark"] body { background:#0b0d12; }
      `}</style>
    </Box>
  );
}
