import { useMemo, useState } from 'react';
import {
  Paper, TextField, InputAdornment, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, IconButton, Tooltip, Chip, Box, Typography, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Stack, Skeleton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function UsersTable({ users, loading, onDelete, onSnack }) {
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = users.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (!q) return arr;
    return arr.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      String(u.telegramId || '').includes(q)
    );
  }, [users, search]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text));
      onSnack('Скопійовано у буфер', 'success');
    } catch {
      onSnack('Не вдалося скопіювати', 'warning');
    }
  };

  return (
    <>
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Пошук за username або ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
      </Paper>

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
                  <TableCell>
                    {u.telegramId ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography component="span">{u.telegramId}</Typography>
                        <Tooltip title="Скопіювати ID">
                          <IconButton size="small" onClick={() => copy(u.telegramId)}>
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ) : <Chip size="small" label="—" />}
                  </TableCell>
                  <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Видалити">
                      <span>
                        <IconButton color="error" size="small" onClick={() => setConfirmId(u._id)}>
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

      {/* Confirm delete */}
      <Dialog open={!!confirmId} onClose={() => setConfirmId(null)}>
        <DialogTitle>Підтвердіть видалення</DialogTitle>
        <DialogContent>Цю дію не можна скасувати.</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)}>Скасувати</Button>
          <Button color="error" variant="contained" onClick={() => { onDelete(confirmId); setConfirmId(null); }}>
            Видалити
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
