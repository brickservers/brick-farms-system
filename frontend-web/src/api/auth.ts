import { api } from './client'

type TokenResp = { access_token: string; refresh_token?: string; token_type?: string }

export type SignupPayload = {
  tenant_name: string
  country: string
  email: string
  password: string
  first_name: string
  last_name: string
  phone: string
  dob: string
}

export async function login(email: string, password: string): Promise<TokenResp> {
  return api.post('/auth/token', { email, password })
}

export async function signup(payload: SignupPayload): Promise<TokenResp> {
  return api.post('/auth/signup', payload)
}

export async function refreshAccessToken(): Promise<TokenResp> {
  return api.post('/auth/refresh', {})
}

export function storeToken(token: string, refreshToken?: string){
  localStorage.setItem('bf_access_token', token)
  if (refreshToken) localStorage.setItem('bf_refresh_token', refreshToken)
}

export function getToken(){
  return localStorage.getItem('bf_access_token')
}

export function getRefreshToken(){
  return localStorage.getItem('bf_refresh_token')
}

export function parseJwt(token?: string){
  if(!token) return null
  try{
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g,'+').replace(/_/g,'/')
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
    const decoded = JSON.parse(atob(padded))
    return decoded
  }catch(e){ return null }
}

export async function logout(){
  try { await api.post('/auth/logout', {}) } catch (e) { /* ignore */ }
  localStorage.removeItem('bf_access_token')
  localStorage.removeItem('bf_refresh_token')
}
