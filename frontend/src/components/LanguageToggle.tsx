import { useTranslation } from 'react-i18next'
import { setLanguage } from '../i18n'

export default function LanguageToggle() {
  const { t, i18n } = useTranslation()

  const toggle = () => {
    const next = i18n.language === 'zh-TW' ? 'en' : 'zh-TW'
    setLanguage(next)
  }

  return (
    <button className="lang-toggle" onClick={toggle}>
      {t('language.toggle')}
    </button>
  )
}
