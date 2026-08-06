'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { dict, LANGS, LANG_STORAGE_KEY, type Lang } from './dict'

interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: string) => string
}

const LangContext = createContext<LangContextValue | undefined>(undefined)

function resolveKey(tree: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = tree
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

interface LangProviderProps {
  children: ReactNode
  defaultLang?: Lang
}

export function LangProvider({ children, defaultLang = 'fr' }: LangProviderProps) {
  const [lang, setLangState] = useState<Lang>(defaultLang)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY) as Lang | null
      if (saved && LANGS.some((l) => l.code === saved)) setLangState(saved)
    } catch {
      /* localStorage unavailable; keep default */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  // Cycles through every available language in LANGS order — kept for
  // callers that predate the 4-language dropdown.
  const toggleLang = useCallback(() => {
    const i = LANGS.findIndex((l) => l.code === lang)
    const next = LANGS[(i + 1) % LANGS.length]
    if (next) setLang(next.code)
  }, [lang, setLang])

  const t = useCallback(
    (key: string): string => {
      const primary = resolveKey(dict[lang], key)
      if (primary !== undefined) return primary
      const fallback = resolveKey(dict.en, key)
      return fallback ?? key
    },
    [lang],
  )

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) {
    throw new Error('useLang must be used within a LangProvider')
  }
  return ctx
}
