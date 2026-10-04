import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getTenantSlug, tenantPath } from '../../utils/tenantRouting'

export default function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user?.sub || !user?.tenant_id) {
    const tenantSlug = getTenantSlug(location.pathname)
    return <Navigate to={tenantPath('/login', tenantSlug)} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
