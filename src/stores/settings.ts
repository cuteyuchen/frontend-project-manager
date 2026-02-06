import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Settings } from '../types';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({
    editorPath: 'code',
    defaultTerminal: 'cmd'
  });

  const stored = localStorage.getItem('settings');
  if (stored) {
    try {
      settings.value = JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
  }

  watch(settings, (newVal) => {
    localStorage.setItem('settings', JSON.stringify(newVal));
  }, { deep: true });

  return {
    settings
  };
});
