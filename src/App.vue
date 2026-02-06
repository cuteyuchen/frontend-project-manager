<script setup lang="ts">
import { ref } from 'vue';
import Sidebar from './components/Sidebar.vue';
import Dashboard from './views/Dashboard.vue';
import Settings from './views/Settings.vue';
import NodeManager from './views/NodeManager.vue';

const currentView = ref<'dashboard' | 'settings' | 'nodes'>('dashboard');
</script>

<template>
  <div class="flex h-screen w-screen bg-[#0f172a] text-gray-100 font-sans overflow-hidden select-none">
    <Sidebar @navigate="v => currentView = v" />
    <main class="flex-1 h-full overflow-hidden relative">
        <!-- Modern deep gradient background -->
        <div class="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] opacity-100 pointer-events-none" />
        <!-- Subtle accent glow -->
        <div class="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div class="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div class="relative h-full z-10 backdrop-blur-[0px]">
            <Dashboard v-if="currentView === 'dashboard'" />
            <Settings v-if="currentView === 'settings'" />
            <NodeManager v-if="currentView === 'nodes'" />
        </div>
    </main>
  </div>
</template>

<style>
:root {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  color-scheme: dark;
  --el-bg-color: #1e293b !important;
  --el-bg-color-overlay: #1e293b !important;
  --el-border-color: #334155 !important;
  --el-border-color-light: #334155 !important;
  --el-border-color-lighter: #334155 !important;
  --el-text-color-primary: #f1f5f9 !important;
  --el-text-color-regular: #cbd5e1 !important;
  --el-fill-color-blank: #0f172a !important;
}

html, body, #app {
  height: 100%;
  margin: 0;
  overflow: hidden;
  background-color: #0f172a;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
