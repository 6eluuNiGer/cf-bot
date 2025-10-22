import { useState } from 'react';
import { Paper, Stack, TextField, Button, Alert, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export default function AddUserForm({ onAdd, onSnack }) {
  const [username, setUsername] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [errors, setErrors] = useState({});

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
    setUsername(''); setTelegramId(''); setErrors({});
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      await onAdd({
        username: username ? username.replace(/^@/, '') : undefined,
        telegramId: telegramId || undefined
      });
      clearForm();
      onSnack('Користувача додано', 'success');
    } catch (e) {
      onSnack(e.message || 'Помилка створення', 'error');
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Telegram username (@...)"
          value={username}
          onChange={e => setUsername(e.target.value)}
          error={!!errors.username || !!errors.form}
          helperText={errors.username ? errors.username : 'Необовʼязково, достатньо ID'}
          InputProps={{ startAdornment: <InputAdornment position="start">@</InputAdornment> }}
        />
        <TextField
          label="Telegram ID"
          value={telegramId}
          onChange={e => setTelegramId(e.target.value)}
          error={!!errors.telegramId || !!errors.form}
          helperText={errors.telegramId ? errors.telegramId : 'Числове значення (optional)'}
        />
        <Stack direction="row" spacing={0.5}>
          <Button variant="outlined" size="small" sx={{ px: 1.25, py: 0.4 }} onClick={clearForm}>Clear</Button>
          <Button variant="contained" size="small" sx={{ px: 1.25, py: 0.4 }}
            startIcon={<AddIcon fontSize="small" />} onClick={submit}>
            Add
          </Button>
        </Stack>
      </Stack>
      {errors.form && <Alert severity="warning" sx={{ mt: 1 }}>{errors.form}</Alert>}
    </Paper>
  );
}
