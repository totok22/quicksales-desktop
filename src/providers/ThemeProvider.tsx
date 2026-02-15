import { useEffect } from 'react'
import { useStore } from '../stores/useStore'

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings } = useStore()

  useEffect(() => {
    const root = document.documentElement

    // 应用字号
    root.style.fontSize = `${settings.fontSize}px`

    // 应用主题
    const isDark = settings.theme === 'dark' ||
      (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [settings.fontSize, settings.theme])

  return <>{children}</>
}
