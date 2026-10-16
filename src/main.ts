import { createApp } from 'vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import router from './router'
import './assets/styles/main.scss'
import App from './App.vue'
import { globalPlugins } from './plugins'

const app = createApp(App)

// installs PrimeVue, i18n, toast and Pinia (with $router on every store)
globalPlugins(app)

app.use(VueQueryPlugin, {
  queryClient: new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
  }),
})
app.use(router)
app.mount('#app')
