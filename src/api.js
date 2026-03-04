function getApiUrl() {
  const base = window.location.origin + window.location.pathname.replace(/\/$/, '')
  return base.replace(/\/+$/, '') + '/api.php'
}

/* ─── mock data (dev-bypass) ─────────────────────────────── */
const MOCK = {
  clients: [
    { id: 1, name: 'Empresa Demo S.A.', slug: 'empresa-demo', notes: 'Cliente de ejemplo', created_at: '2024-01-10 10:00:00' },
    { id: 2, name: 'Comercio Norte', slug: 'comercio-norte', notes: '', created_at: '2024-02-15 09:00:00' },
  ],
  reports: {
    1: [
      { id: 1, title: 'Informe SEO Enero', period_date: '2024-01', original_name: 'seo-enero-2024.pdf', file_size: 1245184, uploaded_by_name: 'Super Admin', created_at: '2024-01-31 12:00:00' },
      { id: 2, title: 'Informe Redes Enero', period_date: '2024-01', original_name: 'redes-enero-2024.pdf', file_size: 876543, uploaded_by_name: 'Super Admin', created_at: '2024-01-31 12:30:00' },
    ],
    2: [
      { id: 3, title: 'Informe SEO Febrero', period_date: '2024-02', original_name: 'seo-feb-2024.pdf', file_size: 2097152, uploaded_by_name: 'Super Admin', created_at: '2024-02-28 15:00:00' },
    ],
  },
  users: [
    { id: 1, email: 'info@rableb.com', role: 'super_admin', name: 'Super Admin', created_at: '2024-01-01 00:00:00' },
    { id: 2, email: 'cliente1@test.com', role: 'user', name: 'Cliente Uno', created_at: '2024-01-10 10:00:00' },
    { id: 3, email: 'maria@ejemplo.com', role: 'user', name: 'María García', created_at: '2024-02-15 09:00:00' },
  ],
  userClients: { 2: [1], 3: [2] }, // user_id -> [client_id]
}

function mockResponse(action, body) {
  switch (action) {
    case 'clients-list':
      return { ok: true, clients: MOCK.clients }
    case 'clients-get': {
      const c = MOCK.clients.find(c => c.slug === body.slug)
      return c ? { ok: true, client: c } : { ok: false, error: 'Cliente no encontrado' }
    }
    case 'clients-create': {
      const slug = (body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'empresa'
      const nc = { id: Date.now(), name: body.name, slug, notes: body.notes || '', created_at: new Date().toISOString() }
      MOCK.clients.push(nc)
      if (body.user_email) {
        let u = MOCK.users.find(x => x.email === body.user_email)
        if (!u) {
          u = { id: Date.now() + 1, email: body.user_email, role: 'user', name: body.user_email.split('@')[0], created_at: new Date().toISOString() }
          MOCK.users.push(u)
        }
        if (!MOCK.userClients[u.id]) MOCK.userClients[u.id] = []
        if (!MOCK.userClients[u.id].includes(nc.id)) MOCK.userClients[u.id].push(nc.id)
      }
      return { ok: true, client: nc }
    }
    case 'clients-update': {
      const c = MOCK.clients.find(x => x.id === body.id)
      if (c) { c.name = body.name ?? c.name; c.notes = body.notes ?? c.notes }
      return { ok: true }
    }
    case 'clients-delete': {
      const idx = MOCK.clients.findIndex(c => c.id === body.id)
      if (idx !== -1) MOCK.clients.splice(idx, 1)
      return { ok: true }
    }
    case 'reports-list': {
      const cid = body.client_id || (MOCK.clients.find(c => c.slug === body.slug)?.id)
      return { ok: true, reports: MOCK.reports[cid] || [] }
    }
    case 'report-delete': {
      for (const cid in MOCK.reports) {
        const idx = MOCK.reports[cid].findIndex(r => r.id === body.id)
        if (idx !== -1) { MOCK.reports[cid].splice(idx, 1); break }
      }
      return { ok: true }
    }
    case 'users-list':
      return { ok: true, users: MOCK.users }
    case 'users-create': {
      const nu = { id: Date.now(), email: body.email, role: body.role || 'user', name: body.name || body.email.split('@')[0], created_at: new Date().toISOString() }
      MOCK.users.push(nu)
      return { ok: true, user: nu }
    }
    case 'users-delete': {
      const idx = MOCK.users.findIndex(u => u.id === body.id)
      if (idx !== -1) MOCK.users.splice(idx, 1)
      return { ok: true }
    }
    case 'users-update': {
      const u = MOCK.users.find(x => x.id === body.id)
      if (!u) return { ok: false, error: 'Usuario no encontrado' }
      if (body.name != null) u.name = body.name
      if (body.role != null && ['super_admin', 'user'].includes(body.role)) u.role = body.role
      if (body.email != null) u.email = body.email
      return { ok: true, user: u }
    }
    case 'client-users-list': {
      const cid = body.client_id
      if (!cid) return { ok: true, users: [] }
      const uids = Object.entries(MOCK.userClients || {}).filter(([, ids]) => ids.includes(cid)).map(([uid]) => Number(uid))
      const users = (MOCK.users || []).filter(u => uids.includes(u.id))
      return { ok: true, users }
    }
    case 'client-users-add': {
      const cid = body.client_id
      const uid = body.user_id
      if (!MOCK.userClients[uid]) MOCK.userClients[uid] = []
      if (!MOCK.userClients[uid].includes(cid)) MOCK.userClients[uid].push(cid)
      return { ok: true }
    }
    case 'client-users-remove': {
      const cid = body.client_id
      const uid = body.user_id
      if (MOCK.userClients[uid]) MOCK.userClients[uid] = MOCK.userClients[uid].filter(id => id !== cid)
      return { ok: true }
    }
    case 'user-clients-list': {
      const uid = body.user_id
      const ids = (MOCK.userClients || {})[uid] || []
      const clients = (MOCK.clients || []).filter(c => ids.includes(c.id))
      return { ok: true, clients }
    }
    default:
      return { ok: false, error: 'Mock: acción no soportada — se necesita PHP para esta operación' }
  }
}

/* ─── api call ───────────────────────────────────────────── */
export async function api(action, body = {}, token = null) {
  if (token === 'dev-bypass') {
    return Promise.resolve(mockResponse(action, body))
  }
  // Vista pública en localhost sin PHP: usar mock para que /p/:slug funcione
  if (isLocalhost() && !token && (action === 'clients-get' && body.slug || action === 'reports-list' && body.slug)) {
    return Promise.resolve(mockResponse(action, body))
  }
  const url = getApiUrl()
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  }
  if (token) opts.headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error de conexión')
  return data
}

/* ─── file upload (multipart) ────────────────────────────── */
export async function apiUpload(formData, token = null) {
  if (token === 'dev-bypass') {
    // Simular carga en dev
    const clientId = Number(formData.get('client_id'))
    const rep = {
      id: Date.now(),
      title: formData.get('title'),
      period_date: formData.get('period_date'),
      original_name: formData.get('file')?.name || 'informe.pdf',
      file_size: formData.get('file')?.size || 0,
      uploaded_by_name: 'Super Admin',
      created_at: new Date().toISOString(),
    }
    if (!MOCK.reports[clientId]) MOCK.reports[clientId] = []
    MOCK.reports[clientId].unshift(rep)
    return Promise.resolve({ ok: true, report: rep })
  }
  const url = getApiUrl() + '?action=report-upload'
  const opts = { method: 'POST', body: formData }
  if (token) opts.headers = { Authorization: `Bearer ${token}` }
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error al subir archivo')
  return data
}

/* ─── download URL ───────────────────────────────────────── */
export function downloadUrl(reportId, { slug, token }) {
  if (token === 'dev-bypass') return null // en dev no hay archivo real
  const base = getApiUrl()
  const p = new URLSearchParams({ action: 'report-download', id: reportId })
  if (slug) p.set('slug', slug)
  else if (token) p.set('token', token)
  return `${base}?${p}`
}

export function isLocalhost() {
  return /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname)
}

export function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export function formatPeriod(period) {
  if (!period || typeof period !== 'string' || period === 'undefined') return 'Sin período'
  const [y, m] = period.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const monthName = months[parseInt(m, 10) - 1]
  return monthName && y ? `${monthName} ${y}` : period
}
