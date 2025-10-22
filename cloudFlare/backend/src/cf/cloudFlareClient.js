const axios = require('axios');
const { CF_EMAIL, CF_GLOBAL_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_TOKEN } = require('../config');

const base = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

function client() {
  if (CLOUDFLARE_TOKEN) {
    return axios.create({
      baseURL: base.defaults.baseURL,
      headers: { Authorization: `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
  }
  return axios.create({
    baseURL: base.defaults.baseURL,
    headers: {
      'X-Auth-Email': CF_EMAIL,
      'X-Auth-Key': CF_GLOBAL_API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

async function createZone(name) {
  const c = client();
  const { data } = await c.post('/zones', {
    name,
    account: { id: CLOUDFLARE_ACCOUNT_ID },
    jump_start: true,
  });
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result;
}

async function getZoneByName(name) {
  const c = client();
  const { data } = await c.get('/zones', { params: { name, per_page: 1 } });
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result?.[0] || null;
}

async function getZoneNS(zoneId) {
  const c = client();
  const { data } = await c.get(`/zones/${zoneId}`);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result.name_servers || [];
}

async function listDns(zoneId) {
  const c = client();
  const { data } = await c.get(`/zones/${zoneId}/dns_records`, { params: { per_page: 100 } });
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result;
}

async function createDns(zoneId, rec) {
  const c = client();
  const { data } = await c.post(`/zones/${zoneId}/dns_records`, rec);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result;
}

async function updateDns(zoneId, recordId, patch) {
  const c = client();
  const { data } = await c.patch(`/zones/${zoneId}/dns_records/${recordId}`, patch);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return data.result;
}

async function deleteDns(zoneId, recordId) {
  const c = client();
  const { data } = await c.delete(`/zones/${zoneId}/dns_records/${recordId}`);
  if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare error');
  return true;
}

async function getZoneStatusByName(name) {
  const zone = await getZoneByName(name);
  if (!zone) return null;
  return { id: zone.id, status: zone.status || 'unknown' };
}

module.exports = {
  createZone, getZoneByName, getZoneNS,
  listDns, createDns, updateDns, deleteDns,
  getZoneStatusByName
};
