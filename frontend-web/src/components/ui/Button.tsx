import React from 'react'

export default function Button({
  children,
  className = '',
  disabled = false,
  icon,
  isLoading = false,
  onClick,
  variant='primary',
  type='button',
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  icon?: React.ReactNode
  isLoading?: boolean
  onClick?: ()=>void
  variant?: 'primary'|'secondary'|'ghost'
  type?: 'button'|'submit'
}){
  const base = {
    primary: { background: 'var(--green-700)', color:'#fff', border:'none' },
    secondary: { background: 'var(--brown-500)', color:'#fff', border:'none' },
    ghost: { background:'transparent', color:'var(--text)', border:'1px solid rgba(0,0,0,0.08)'}
  } as any
  const style = { padding:'8px 12px', borderRadius:8, fontWeight:600, cursor: disabled || isLoading ? 'not-allowed' : 'pointer', opacity: disabled ? .65 : 1, ...base[variant] }
  return (
    <button className={`button-with-icon ${className}`} disabled={disabled || isLoading} type={type} onClick={onClick} style={style}>
      <span className={`button-icon ${isLoading ? 'button-spinner' : ''}`} aria-hidden="true">{isLoading ? '' : icon}</span>
      <span>{children}</span>
    </button>
  )
}
