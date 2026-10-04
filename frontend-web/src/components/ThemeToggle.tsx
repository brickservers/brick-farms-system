import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

export default function ThemeToggle(){
  const { theme, toggle } = useTheme()
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" type="button">
      <span aria-hidden="true">{theme === 'dark' ? 'D' : 'L'}</span>
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
