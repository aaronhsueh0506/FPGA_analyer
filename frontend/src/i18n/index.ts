import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhTW from './zh-TW.json'
import en from './en.json'

const STORAGE_KEY = 'fpga-analyzer-lang'
const defaultLang = (localStorage.getItem(STORAGE_KEY) as 'zh-TW' | 'en') || 'zh-TW'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-TW': { translation: zhTW },
      en: { translation: en }
    },
    lng: defaultLang,
    fallbackLng: 'zh-TW',
    interpolation: {
      escapeValue: false
    }
  })

export function setLanguage(lang: 'zh-TW' | 'en') {
  i18n.changeLanguage(lang)
  localStorage.setItem(STORAGE_KEY, lang)
  document.documentElement.lang = lang
}

document.documentElement.lang = defaultLang

export default i18n
