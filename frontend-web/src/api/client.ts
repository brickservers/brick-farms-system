export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

type ReqOpts = RequestInit & { json?: any }

async function request(path: string, opts: ReqOpts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  return requestWithAuth(url, opts, true)
}

async function requestWithAuth(url: string, opts: ReqOpts = {}, allowRefresh: boolean) {
  const headers: Record<string,string> = opts.headers ? {...(opts.headers as Record<string,string>)} : {}
  const token = typeof window !== 'undefined' ? localStorage.getItem('bf_access_token') : null
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.json) {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(opts.json)
  }
  const method = opts.method || 'GET'
  const cacheKey = `bf:api-cache:${url}`

  function extractMessage(body: any) {
    if (!body) return null
    if (typeof body === 'string') return body
    if (body.message) return body.message
    if (body.error) return body.error
    if (body.detail) return body.detail
    if (Array.isArray(body) && body.length) {
      const first = body[0]
      if (first && typeof first === 'object' && first.message) return first.message
      return JSON.stringify(body)
    }
    try { return JSON.stringify(body) } catch { return String(body) }
  }

  try {
    const res = await fetch(url, {...opts, headers, credentials: 'include'})
    if (res.status === 401 && allowRefresh && typeof window !== 'undefined') {
      const refreshed = await refreshExpiredToken()
      if (refreshed) return requestWithAuth(url, opts, false)
    }

    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => null)

    if (!res.ok) {
      const message = extractMessage(data) || `HTTP ${res.status}`
      const err: any = new Error(message)
      err.status = res.status
      err.body = data
      if (typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('bf-api-error', { detail: { status: res.status, message, body: data } })) } catch {};
        try { window.dispatchEvent(new CustomEvent('bf-toast', { detail: { type: 'error', message } })) } catch {};
      }
      throw err
    }

    if (method === 'GET' && typeof window !== 'undefined') {
      localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }))
    }

    return data
  } catch (error) {
    if (method === 'GET' && typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey)
      if (cached) return JSON.parse(cached).data
    }
    if (typeof window !== 'undefined') {
      const message = error instanceof Error ? error.message : String(error)
      try { window.dispatchEvent(new CustomEvent('bf-toast', { detail: { type: 'error', message } })) } catch {}
    }
    throw error
  }
}

async function refreshExpiredToken() {
  const refreshToken = localStorage.getItem('bf_refresh_token')
  if (!refreshToken) return false
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) {
    localStorage.removeItem('bf_access_token')
    localStorage.removeItem('bf_refresh_token')
    window.dispatchEvent(new Event('bf-auth-expired'))
    return false
  }
  const data = await response.json()
  localStorage.setItem('bf_access_token', data.access_token)
  if (data.refresh_token) localStorage.setItem('bf_refresh_token', data.refresh_token)
  return true
}

async function fetchBlobWithAuth(url: string, allowRefresh: boolean): Promise<Blob> {
  const headers: Record<string,string> = {}
  const token = typeof window !== 'undefined' ? localStorage.getItem('bf_access_token') : null
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { method: 'GET', headers, credentials: 'include' })
  if (res.status === 401 && allowRefresh && typeof window !== 'undefined') {
    const refreshed = await refreshExpiredToken()
    if (refreshed) return fetchBlobWithAuth(url, false)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.blob()
}

async function download(path: string) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  return fetchBlobWithAuth(url, true)
}

async function postFormWithAuth(url: string, formData: FormData, allowRefresh: boolean) {
  const headers: Record<string,string> = {}
  const token = typeof window !== 'undefined' ? localStorage.getItem('bf_access_token') : null
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'include' })
  if (res.status === 401 && allowRefresh && typeof window !== 'undefined') {
    const refreshed = await refreshExpiredToken()
    if (refreshed) return postFormWithAuth(url, formData, false)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json().catch(() => null)
}

async function upload(path: string, formData: FormData) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  return postFormWithAuth(url, formData, true)
}

export const api = {
  get: (p: string) => request(p, { method: 'GET' }),
  post: (p: string, json: any) => request(p, { method: 'POST', json }),
  put: (p: string, json: any) => request(p, { method: 'PUT', json }),
  patch: (p: string, json: any) => request(p, { method: 'PATCH', json }),
  del: (p: string) => request(p, { method: 'DELETE' }),
  download,
  upload,
}

export default api
