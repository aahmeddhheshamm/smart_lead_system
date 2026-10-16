import {type App, markRaw} from 'vue'
import ToastPlugin from './toast';

import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { createPinia } from 'pinia'

import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import i18n from '@/plugins/i18n'
import router from "@/router";

// Aura re-tinted to the LeadFlow palette so PrimeVue internals (focus, selected, checked) match our tokens
const LeadFlowPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#F1F2FF',
      100: '#E6E8FE',
      200: '#D7DAFD',
      300: '#BDC1FB',
      400: '#9CA2F8',
      500: '#4F5BEA',
      600: '#4651DB',
      700: '#3D47C2',
      800: '#2E3592',
      900: '#1F2563',
      950: '#0E1233'
    },
    formField: {
      borderRadius: '5px',
      paddingX: '0.625rem',
      paddingY: '0.5rem'
    },
    colorScheme: {
      light: {
        formField: {
          borderColor: '#E6E8F1',
          hoverBorderColor: '#BDC1FB',
          focusBorderColor: '#4F5BEA',
          color: '#0E1233',
          placeholderColor: '#9499B8'
        }
      },
      dark: {
        primary: {
          color: '#7C83F5',
          contrastColor: '#0E1233',
          hoverColor: '#9CA2F8',
          activeColor: '#BDC1FB'
        },
        formField: {
          background: '#0E1233',
          borderColor: '#222852',
          hoverBorderColor: '#4048AA',
          focusBorderColor: '#7C83F5',
          color: '#FFFFFF',
          placeholderColor: '#6E749B'
        }
      }
    }
  }
})

export function globalPlugins(app: App<Element>) {
  app.use(PrimeVue, {
    theme: {
      preset: LeadFlowPreset,
      options: {
        darkModeSelector: '.dark'
      }
    }
  })

  app.directive('tooltip', Tooltip)
  app.use(i18n)
  app.use(ToastPlugin,{
    autoClose: 3000,
    position: 'top-center',
    clearOnUrlChange:false
  })

  const pinia = createPinia()

  pinia.use(({ store }) => {
    store.$router = markRaw(router)
  })

  app.use(pinia)
}
