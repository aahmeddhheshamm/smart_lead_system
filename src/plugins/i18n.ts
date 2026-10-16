// plugins/i18n.ts
import { createI18n } from 'vue-i18n'
import ar from '@/locales/ar.json'
import en from '@/locales/en.json'

const savedLocale = localStorage.getItem('locale') || 'EN'

export const i18n = createI18n({
  legacy: false,
  allowComposition: true,
  locale: savedLocale,
  fallbackLocale: 'EN',
  globalInjection: true,
  messages: {
   AR: ar,
   EN: en,
  },
})

export default i18n
