const reservedSegments = new Set([
  'demo',
  'farms',
  'finance',
  'login',
  'map',
  'register',
  'reports',
  'sensors',
  'settings',
  'tasks',
])

export function normalizeTenantSlug(value?: string | null) {
  if (!value) return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function tenantNameFromSlug(slug?: string | null) {
  const normalized = normalizeTenantSlug(slug)
  if (!normalized) return ''
  return normalized
    .split(/[.-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getTenantSlug(pathname: string, hostname = window.location.hostname) {
  const host = hostname.toLowerCase()
  const growthSuffix = '.app.brickfarms.ng'
  if (host.endsWith(growthSuffix) && host !== 'app.brickfarms.ng') {
    return normalizeTenantSlug(host.slice(0, -growthSuffix.length))
  }

  const firstSegment = pathname.split('/').filter(Boolean)[0]
  const normalized = normalizeTenantSlug(firstSegment)
  if (!normalized || reservedSegments.has(normalized)) return ''
  return normalized
}

export function tenantBasePath(slug?: string | null) {
  const normalized = normalizeTenantSlug(slug)
  return normalized ? `/${normalized}` : ''
}

export function tenantPath(path: string, slug?: string | null) {
  const base = tenantBasePath(slug)
  if (!path || path === '/') return base || '/'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
