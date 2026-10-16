import { defineStore } from 'pinia'
import { ref } from 'vue'
export type UserTheme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<UserTheme>(getTheme() || getMediaPreferences())

  const setTheme = (theme: UserTheme) => {
    localStorage.setItem('theme', theme)
    currentTheme.value = theme
    document.documentElement.className = theme
  }

  function getTheme() {
    return localStorage.getItem('theme') as UserTheme
  }

  function getMediaPreferences() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const toggleTheme = () => {
    const activeTheme = localStorage.getItem('theme')
    if (activeTheme === 'light') {
      setTheme('dark')
    } else {
      setTheme('light')
    }
  }

  return { toggleTheme, currentTheme, setTheme, getTheme }
})
