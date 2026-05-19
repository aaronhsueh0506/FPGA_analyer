import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from './Sidebar'
import LanguageToggle from './LanguageToggle'

const routeTitleKey: Record<string, string> = {
  '/': 'nav.dashboard',
  '/registers': 'nav.registers',
  '/analyze': 'nav.analyze',
  '/history': 'nav.history'
}

export default function Layout() {
  const { t } = useTranslation()
  const location = useLocation()
  const baseKey = '/' + (location.pathname.split('/')[1] || '')
  let titleKey = routeTitleKey[baseKey] || routeTitleKey['/']
  if (location.pathname.startsWith('/results')) {
    titleKey = 'results.title'
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{t(titleKey)}</div>
          <LanguageToggle />
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
