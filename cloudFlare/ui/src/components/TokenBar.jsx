import { useState } from 'react';
import { Paper, Stack, TextField, Button, Chip, Tooltip, IconButton, FormControlLabel, Switch } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import LogoutIcon from '@mui/icons-material/Logout';

export default function TokenBar({ mode, onToggleMode, onSaved, onSnack }) {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');

  const saveToken = async () => {
    const t = token.trim();
    if (!t) return onSnack('Введіть Admin Token', 'warning');
    localStorage.setItem('adminToken', t);
    onSaved?.();
    onSnack('Токен збережено', 'success');
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setToken('');
    onSaved?.();
    onSnack('Токен очищено', 'info');
  };

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    onSnack('Токен скопійовано', 'success');
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <TextField
          label="Admin Token"
          fullWidth
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={copy} disabled={!token}>
            <ContentCopyIcon fontSize="small" sx={{ mr: .5 }} /> Copy
          </Button>
          <Button variant="contained" size="small" onClick={saveToken}>
            <SaveIcon fontSize="small" sx={{ mr: .5 }} /> Save
          </Button>
          <Tooltip title="Очистити токен">
            <span>
              <IconButton color="error" size="small" onClick={logout} disabled={!localStorage.getItem('adminToken')}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
        <Chip size="small" color={localStorage.getItem('adminToken') ? 'success' : 'default'} label={localStorage.getItem('adminToken') ? 'Token set' : 'No token'} />
        <FormControlLabel
          sx={{ ml: 'auto' }}
          control={<Switch checked={mode === 'dark'} onChange={onToggleMode} />}
          label="Dark mode"
        />
      </Stack>
    </Paper>
  );
}
