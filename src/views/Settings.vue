<script setup lang="ts">
import { useSettingsStore } from '../stores/settings';
import { open } from '@tauri-apps/plugin-dialog';

const settingsStore = useSettingsStore();

async function selectEditor() {
    try {
        const selected = await open({
            multiple: false,
            filters: [{
                name: 'Executable',
                extensions: ['exe', 'cmd', 'bat']
            }]
        });
        if (selected && typeof selected === 'string') {
            settingsStore.settings.editorPath = selected;
        }
    } catch (e) {
        console.error(e);
    }
}
</script>

<template>
  <div class="p-6 h-full flex flex-col">
    <h1 class="text-2xl font-bold text-white mb-6">设置</h1>
    
    <div class="max-w-2xl">
        <el-card class="!bg-gray-800 !border-gray-700">
            <el-form label-position="top">
                <el-form-item label="编辑器路径">
                    <div class="flex gap-2 w-full">
                        <el-input v-model="settingsStore.settings.editorPath" placeholder="例如 code">
                            <template #prepend>
                                <el-icon><div class="i-mdi-console" /></el-icon>
                            </template>
                            <template #append>
                                <el-button @click="selectEditor">选择文件</el-button>
                            </template>
                        </el-input>
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                        默认 "code" 适用于已配置环境变量的 VSCode。如未生效，请选择 Code.exe 的完整路径。
                    </div>
                </el-form-item>

                <el-form-item label="默认终端">
                    <el-select v-model="settingsStore.settings.defaultTerminal" class="w-full">
                        <el-option label="Command Prompt (cmd.exe)" value="cmd" />
                        <el-option label="PowerShell" value="powershell" />
                        <el-option label="Git Bash" value="git-bash" />
                    </el-select>
                    <div class="text-xs text-gray-400 mt-1">
                        脚本执行时的包装器。
                    </div>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
  </div>
</template>
