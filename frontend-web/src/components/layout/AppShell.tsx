import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from '../ThemeToggle'
import { useLanguage } from '../../contexts/LanguageContext'
import { languages } from '../../i18n/languages'
import { useAuth } from '../../contexts/AuthContext'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import { useQuery } from '@tanstack/react-query'
import { getTenantProfile } from '../../api/farm'
import { getTenantSlug, tenantPath } from '../../utils/tenantRouting'

const navItems = [
  { to: '/', label: 'overview' },
  { to: '/farms', label: 'farms' },
  { to: '/map', label: 'map' },
  { to: '/tasks', label: 'tasks' },
  { to: '/farm-plans', label: 'farmPlans' },
  { to: '/workers', label: 'workers' },
  { to: '/assets', label: 'assets' },
  { to: '/sensors', label: 'sensors' },
  { to: '/finance', label: 'finance' },
  { to: '/reports', label: 'reports' },
  { to: '/demo', label: 'demo' },
  { to: '/settings', label: 'settings' },
]

export default function AppShell() {
  const { t, language, setLanguage } = useLanguage()
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const online = useOnlineStatus()
  const tenantQuery = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile, enabled: Boolean(user?.tenant_id) })
  const plan = tenantQuery.data?.plan || 'free'
  const tenantSlug = getTenantSlug(location.pathname)

  function logoutToTenantLogin() {
    logout()
    navigate(tenantPath('/login', tenantSlug), { replace: true })
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">BF</div>
          <div>
            <div className="brand-name">{t('appName')}</div>
            <div className="brand-subtitle">{t('commandCenter')}</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map(item => (
            <NavLink key={item.to} to={tenantPath(item.to, tenantSlug)} end={item.to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-credit">
          <span>Created by</span>
          <strong>BrickServers NG Limited</strong>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setOpen(value => !value)} aria-label="Open navigation">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="topbar-title">
            <strong>{tenantQuery.data?.name || t('commandCenter')}</strong>
            <span>{tenantQuery.data?.user_name || tenantQuery.data?.user_email || user?.role || t('freeMode')}</span>
          </div>
          <div className="topbar-actions">
            <span className={`connection-pill ${online ? 'online' : 'offline'}`}>{online ? 'Online' : 'Offline'}</span>
            <span className="plan-pill">{t('plan')}: {plan}</span>
            <label className="toolbar-field">
              <span>{t('language')}</span>
              <select value={language} onChange={event => setLanguage(event.target.value as typeof language)}>
                {languages.map(item => <option value={item.code} key={item.code}>{item.label}</option>)}
              </select>
            </label>
            <ThemeToggle />
            <button className="secondary-action topbar-logout" type="button" onClick={logoutToTenantLogin}>Logout</button>
          </div>
        </header>
        <main className="workspace-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
