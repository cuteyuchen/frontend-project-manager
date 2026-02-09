import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Settings } from '../types';
import i18n from '../i18n';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({
    editorPath: 'code',
    defaultTerminal: 'cmd',
    locale: 'zh',
    themeMode: 'auto',
    autoUpdate: true
  });

  const stored = localStorage.getItem('settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Migrate old themeColor to themeMode if needed, or just ignore
      if (parsed.themeColor && !parsed.themeMode) {
          delete parsed.themeColor;
          parsed.themeMode = 'auto';
      }
      settings.value = { ...settings.value, ...parsed };
    } catch (e) {
      console.error(e);
    }
  }
  
  const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  
  const updateTheme = (e?: MediaQueryListEvent) => {
      const mode = settings.value.themeMode;
      const isDark = mode === 'dark' || (mode === 'auto' && (e ? e.matches : systemThemeMedia.matches));
      
      if (isDark) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  };

  // Listen for system changes
  systemThemeMedia.addEventListener('change', (e) => {
      if (settings.value.themeMode === 'auto') {
          updateTheme(e);
      }
  });

  const applySettings = () => {
    // Locale
    if (settings.value.locale) {
      // @ts-ignore
      i18n.global.locale.value = settings.value.locale;
    }
    
    // Theme Mode
    updateTheme();
  };

  // Apply on init
  applySettings();

  watch(settings, (newVal) => {
    localStorage.setItem('settings', JSON.stringify(newVal));
    applySettings();
  }, { deep: true });

  return {
    settings
  };
});
