require('dotenv').config();
const axios = require('axios');

const cfBearer = process.env.CLOUDFLARE_TOKEN ? axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' },
  timeout: 15000,
}) : null;

const cfGlobal = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: {
    'X-Auth-Email': process.env.CF_EMAIL,
    'X-Auth-Key': process.env.CF_GLOBAL_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ---- ZONES ----
async function createZone(name) {
  const { data } = await cfGlobal.post('/zones', {
    name,
    account: { id: process.env.CLOUDFLARE_ACCOUNT_ID },
    jump_start: true,
  });
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result; // { id, name, status, ... }
}
async function getZoneByName(name) {
  const client = cfBearer ?? cfGlobal;
  const { data } = await client.get('/zones', { params: { name, per_page: 1 } });
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result?.[0] || null;
}
async function getZoneNS(zoneId) {
  const client = cfBearer ?? cfGlobal;
  const { data } = await client.get(`/zones/${zoneId}`);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result.name_servers || [];
}

// ---- DNS ----
async function listDns(zoneId) {
  const client = cfBearer ?? cfGlobal;
  const { data } = await client.get(`/zones/${zoneId}/dns_records`, { params: { per_page: 100 } });
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result;
}
async function createDns(zoneId, rec) {
  const client = cfBearer ?? cfGlobal;
  const { data } = await client.post(`/zones/${zoneId}/dns_records`, rec);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result;
}
async function updateDns(zoneId, recordId, patch) {
  const client = cfBearer ?? cfGlobal;
  const { data } = await client.patch(`/zones/${zoneId}/dns_records/${recordId}`, patch);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result;
}
async function deleteDns(zoneId, recordId) {
  const client = cfBearer ?? cfGlobal;
  const { data } = await client.delete(`/zones/${zoneId}/dns_records/${recordId}`);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return true;
}

async function getZoneStatusByName(name) {
  const zone = await getZoneByName(name);
  if (!zone) return null;

  // у відповіді /zones?name=... зазвичай вже є status
  let status = zone.status;
  if (!status) {
    const client = cfBearer ?? cfGlobal;
    const { data } = await client.get(`/zones/${zone.id}`);
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
    status = data.result.status;
  }
  return { id: zone.id, status };
}

module.exports = { createZone, getZoneByName, getZoneNS, listDns, createDns, updateDns, deleteDns, getZoneStatusByName };
