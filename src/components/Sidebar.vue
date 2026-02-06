<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  (e: 'navigate', view: 'dashboard' | 'settings' | 'nodes'): void
}>();

const activeIndex = ref('dashboard');

function handleSelect(key: string) {
  activeIndex.value = key;
  emit('navigate', key as any);
}
</script>

<template>
  <el-menu :default-active="activeIndex"
    class="h-full border-r-0 !bg-white/80 dark:!bg-[#0f172a]/80 backdrop-blur-md transition-colors duration-300"
    :collapse="true" @select="handleSelect">
    <div class="h-4"></div> <!-- Top spacing -->

    <el-menu-item index="dashboard">
      <el-icon>
        <div class="i-mdi-view-dashboard" />
      </el-icon>
    </el-menu-item>

    <el-menu-item index="nodes">
      <el-icon>
        <div class="i-mdi-nodejs" />
      </el-icon>
    </el-menu-item>

    <div class="flex-1"></div> <!-- Spacer -->

    <el-menu-item index="settings">
      <el-icon>
        <div class="i-mdi-cog" />
      </el-icon>
    </el-menu-item>

    <div class="h-4"></div> <!-- Bottom spacing -->
  </el-menu>
</template>

<style scoped>
:deep(.el-menu-item) {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 56px;
  margin: 8px 12px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #64748b;
  /* slate-500 */
}

:global(html.dark) :deep(.el-menu-item) {
  color: #94a3b8;
  /* slate-400 */
}

:deep(.el-menu-item:hover) {
  background-color: #f1f5f9 !important;
  color: #0f172a !important;
  transform: translateX(4px);
}

:global(html.dark) :deep(.el-menu-item:hover) {
  background-color: rgba(51, 65, 85, 0.5) !important;
  color: #f1f5f9 !important;
}

:deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05)) !important;
  color: #2563eb !important;
  /* blue-600 */
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
  font-weight: 600;
}

:global(html.dark) :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1)) !important;
  color: #60a5fa !important;
  /* blue-400 */
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
}

:deep(.el-icon) {
  font-size: 24px !important;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

:global(html.dark) :deep(.el-icon) {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}
</style>
