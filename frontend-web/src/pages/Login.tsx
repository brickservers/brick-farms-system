import React, { useEffect, useState } from 'react'
import { login, signup } from '../api/auth'
import { useLocation, useNavigate } from 'react-router-dom'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { getTenantSlug, normalizeTenantSlug, tenantNameFromSlug, tenantPath } from '../utils/tenantRouting'

const slides = [
  {
    label: 'FIELD OPERATIONS',
    title: 'Welcome back',
    copy: 'Open your farm command center, map plots, manage work, and track production with investor-grade records.',
    tone: 'slide-field',
  },
  {
    label: 'LIVE MAPS',
    title: 'See every plot clearly',
    copy: 'Review farm boundaries, plot activity, task pins, and sensor readings from one mobile-friendly workspace.',
    tone: 'slide-map',
  },
  {
    label: 'FARM FINANCE',
    title: 'Run the season with confidence',
    copy: 'Keep tasks, reports, investments, and payouts tied to the same operational record.',
    tone: 'slide-finance',
  },
]

type AuthMode = 'login' | 'register'

const countries = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'BJ', name: 'Benin' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'US', name: 'United States' },
]

export default function LoginPage({ initialMode = 'login' }: { initialMode?: AuthMode }){
  const location = useLocation()
  const tenantSlug = getTenantSlug(location.pathname)
  const defaultTenantName = tenantNameFromSlug(tenantSlug)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [tenant,setTenant]=useState(defaultTenantName)
  const [country,setCountry]=useState('NG')
  const [firstName,setFirstName]=useState('')
  const [lastName,setLastName]=useState('')
  const [dob,setDob]=useState('')
  const [phone,setPhone]=useState('')
  const [mode,setMode]=useState<AuthMode>(initialMode)
  const [registerStep,setRegisterStep]=useState(0)
  const [error,setError]=useState<string|null>(null)
  const [activeSlide,setActiveSlide]=useState(0)
  const [loadingAction,setLoadingAction]=useState<'login' | 'demo' | 'register' | null>(null)
  const nav = useNavigate()
  const { setToken } = useAuth()

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % slides.length)
    }, 4800)
    return () => window.clearInterval(timer)
  }, [])

  function authTargetPath(nextTenantSlug = tenantSlug) {
    const from = (location.state as { from?: string } | null)?.from
    if (from && from !== location.pathname && !from.includes('/login') && !from.includes('/register')) return from
    return tenantPath('/', nextTenantSlug)
  }

  async function submitLogin(e:React.FormEvent){
    e.preventDefault()
    setError(null)
    setLoadingAction('login')
    try{
      const res = await login(email,password)
      setToken(res.access_token, res.refresh_token)
      nav(authTargetPath(), { replace: true })
    }catch(err:any){ setError(err.message || 'Login failed') }
    finally{ setLoadingAction(null) }
  }

  async function submitRegister(e:React.FormEvent){
    e.preventDefault()
    setError(null)
    if (registerStep < 2) {
      if (registerStep === 0 && !tenant.trim()) {
        setError('Workspace name is required.')
        return
      }
      if (registerStep === 0 && !country) {
        setError('Country is required.')
        return
      }
      if (registerStep === 1 && (!firstName.trim() || !lastName.trim() || !email.trim() || !dob || !phone.trim())) {
        setError('Complete the owner details before continuing.')
        return
      }
      setRegisterStep(current => current + 1)
      return
    }

    if (!password.trim()) {
      setError('Password is required.')
      return
    }

    setLoadingAction('register')
    try{
      const res = await signup({
        tenant_name: tenant,
        country,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        dob,
        phone,
      })
      setToken(res.access_token, res.refresh_token)
      nav(authTargetPath(normalizeTenantSlug(tenant)), { replace: true })
    }catch(err:any){ setError(err.message || 'Signup failed') }
    finally{ setLoadingAction(null) }
  }

  async function loginDemo(){
    setError(null)
    setLoadingAction('demo')
    try{
      const res = await login('demo@brickfarms.ng','Demo123!')
      setToken(res.access_token, res.refresh_token)
      nav(tenantPath('/', 'brickfarms-demo'), { replace: true })
    }catch(err:any){ setError(err.message || 'Demo login failed') }
    finally{ setLoadingAction(null) }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError(null)
    setRegisterStep(0)
  }

  const registerSteps = ['Workspace', 'Owner', 'Security']
  const completedSteps = [
    Boolean(tenant.trim() && country),
    Boolean(firstName.trim() && lastName.trim() && email.trim() && dob && phone.trim()),
    Boolean(password.trim()),
  ]

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className={`auth-copy auth-slider ${slides[activeSlide].tone}`}>
          <div className="auth-slide-visual" aria-hidden="true">
            <div className="plot-lines" />
            <div className="sensor-dot dot-one" />
            <div className="sensor-dot dot-two" />
            <div className="sensor-dot dot-three" />
          </div>
          <span>BrickFarms DAP</span>
          <h1>{slides[activeSlide].title}</h1>
          <p>{slides[activeSlide].copy}</p>
          <p className="auth-demo-copy">Demo: demo@brickfarms.ng / Demo123!</p>
          <p className="auth-credit">Created by BrickServers NG Limited</p>
          <div className="auth-slide-dots" aria-label="Login image placeholders">
            {slides.map((slide, index) => (
              <button
                aria-label={slide.label}
                className={index === activeSlide ? 'active' : ''}
                key={slide.label}
                onClick={() => setActiveSlide(index)}
                type="button"
              />
            ))}
          </div>
        </div>
        <div className="auth-form">
          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">Login</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Register</button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={submitLogin} className="auth-form-inner">
              <h2>Login</h2>
              {tenantSlug ? <p className="auth-context">Workspace: {tenantNameFromSlug(tenantSlug)}</p> : null}
              <div>
                <label>Email</label>
                <Input value={email} onChange={e=>setEmail(e.target.value)} />
              </div>
              <div>
                <label>Password</label>
                <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
              </div>
              <Button icon="->" isLoading={loadingAction === 'login'} type="submit">{loadingAction === 'login' ? 'Logging in...' : 'Login'}</Button>
              <button className="secondary-action auth-loading-action" disabled={loadingAction === 'demo'} type="button" onClick={loginDemo}>
                <span className={loadingAction === 'demo' ? 'button-spinner' : ''} aria-hidden="true">{loadingAction === 'demo' ? '' : '>'}</span>
                <span>{loadingAction === 'demo' ? 'Opening demo...' : 'Use demo account'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="auth-form-inner">
              <h2>Create free workspace</h2>
              <div className="auth-stepper" aria-label="Registration steps">
                {registerSteps.map((step, index) => (
                  <span className={`${index <= registerStep ? 'active' : ''} ${completedSteps[index] ? 'complete' : ''}`} key={step}>
                    <span className="step-check" aria-hidden="true">{completedSteps[index] ? '✓' : index + 1}</span>
                    {step}
                  </span>
                ))}
              </div>
              {registerStep === 0 ? (
                <div className="auth-step-grid">
                  <div>
                    <label>Workspace name</label>
                    <Input value={tenant} onChange={e=>setTenant(e.target.value)} placeholder="Green Valley Farms" />
                  </div>
                  <div>
                    <label>Farm country</label>
                    <select className="auth-select" value={country} onChange={event => setCountry(event.target.value)}>
                      {countries.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : null}
              {registerStep === 1 ? (
                <div className="auth-step-grid two-col">
                  <div>
                    <label>First name</label>
                    <Input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Amina" />
                  </div>
                  <div>
                    <label>Last name</label>
                    <Input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Orseer" />
                  </div>
                  <div>
                    <label>Date of birth</label>
                    <Input type="date" value={dob} onChange={e=>setDob(e.target.value)} />
                  </div>
                  <div>
                    <label>Phone number</label>
                    <Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+234..." />
                  </div>
                  <div className="wide-auth-field">
                    <label>Owner email</label>
                    <Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@example.com" />
                  </div>
                </div>
              ) : null}
              {registerStep === 2 ? (
                <div>
                  <label>Password</label>
                  <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 6 characters" />
                </div>
              ) : null}
              <div className="auth-step-actions">
                {registerStep > 0 ? <button className="secondary-action" type="button" onClick={() => setRegisterStep(current => current - 1)}>Back</button> : null}
                <Button icon={registerStep === 2 ? '+' : '->'} isLoading={loadingAction === 'register'} type="submit">
                  {loadingAction === 'register' ? 'Creating account...' : registerStep === 2 ? 'Create account' : 'Continue'}
                </Button>
              </div>
              <p className="auth-context">New accounts start on the limited free plan. Growth and Enterprise upgrades will require payment when billing is enabled.</p>
            </form>
          )}

          {error && <div className="form-error">{error}</div>}
        </div>
      </section>
    </div>
  )
}
