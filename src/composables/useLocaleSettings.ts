import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export const useLocaleSettings = () => {
  const { locale, t } = useI18n({ useScope: 'global' })

  const direction = computed(() =>
      locale.value === 'AR' ? 'rtl' : 'ltr'
  )

  const isRtl = computed(() => direction.value === 'rtl')

  const applyUiSettings = () => {
    document.body.setAttribute('dir', direction.value)
    document.body.style.fontFamily =
        locale.value === 'AR' ? 'Cairo' : 'Lexend'
  }

  const changeLocale = (lang: 'AR' | 'EN') => {
    locale.value = lang
    localStorage.setItem('locale', lang)
    applyUiSettings()
  }

  watch(locale, applyUiSettings, { immediate: true })

  return {
    t,
    locale,
    direction,
    isRtl,
    changeLocale,
  }
}
