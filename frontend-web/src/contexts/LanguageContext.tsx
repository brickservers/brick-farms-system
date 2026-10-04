import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { LanguageCode, messages } from '../i18n/languages'

type LanguageContextValue = {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: key => messages.en[key] || key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('bf:language') : null
    return (saved as LanguageCode) || 'en'
  })

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem('bf:language', language)
  }, [language])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) => messages[language][key] || messages.en[key] || key,
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
