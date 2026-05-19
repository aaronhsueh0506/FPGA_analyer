import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import VersionModal from './VersionModal'

export default function Sidebar() {
  const { t } = useTranslation()
  const [versionOpen, setVersionOpen] = useState(false)

  const navItems = [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/registers', label: t('nav.registers'), end: false },
    { to: '/analyze', label: t('nav.analyze'), end: false },
    { to: '/history', label: t('nav.history'), end: false }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">FPGA Analyzer</div>
        <div className="brand-sub">{t('app.subtitle')}</div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="version-button" onClick={() => setVersionOpen(true)}>
          {t('nav.version')}
        </button>
      </div>
      <VersionModal open={versionOpen} onClose={() => setVersionOpen(false)} />
    </aside>
  )
}
