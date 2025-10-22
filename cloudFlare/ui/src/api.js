const API_BASE = import.meta.env.VITE_API_BASE;

function authHeaders() {
  const token = localStorage.getItem('adminToken') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

export async function listUsers() {
  const r = await fetch(`${API_BASE}/api/users`, { headers: authHeaders() });
  return r.json();
}

export async function addUser({ username, telegramId }) {
  const r = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      username: username?.replace(/^@/, '') || undefined,
      telegramId: telegramId ? Number(telegramId) : undefined
    })
  });
  return r.json();
}

export async function deleteUser(id) {
  const r = await fetch(`${API_BASE}/api/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return r.json();
}
