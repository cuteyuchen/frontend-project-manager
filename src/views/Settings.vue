<script setup lang="ts">
import { useSettingsStore } from '../stores/settings';
import { useProjectStore } from '../stores/project';
import { useNodeStore } from '../stores/node';
import { open as openDialog, save } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const nodeStore = useNodeStore();

async function selectEditor() {
    try {
        const selected = await openDialog({
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

async function exportData() {
    try {
        const path = await save({
            filters: [{
                name: 'JSON',
                extensions: ['json']
            }],
            defaultPath: 'frontend-manager-backup.json'
        });

        if (path) {
            const data = {
                projects: projectStore.projects,
                settings: settingsStore.settings,
                customNodes: nodeStore.versions.filter(v => v.source === 'custom')
            };
            await writeTextFile(path, JSON.stringify(data, null, 2));
            ElMessage.success(t('settings.exportSuccess'));
        }
    } catch (e) {
        console.error(e);
        ElMessage.error(`${t('settings.exportError')}: ${e}`);
    }
}

async function importData() {
    try {
        const path = await openDialog({
            multiple: false,
            filters: [{
                name: 'JSON',
                extensions: ['json']
            }]
        });

        if (path && typeof path === 'string') {
            const content = await readTextFile(path);
            const data = JSON.parse(content);
            
            if (data.projects) projectStore.projects = data.projects;
            if (data.settings) settingsStore.settings = data.settings;
            if (data.customNodes) {
                // Merge custom nodes
                const existing = new Set(nodeStore.versions.map(v => v.path));
                data.customNodes.forEach((n: any) => {
                    if (!existing.has(n.path)) {
                        nodeStore.versions.push(n);
                    }
                });
            }
            ElMessage.success(t('settings.importSuccess'));
        }
    } catch (e) {
        console.error(e);
        ElMessage.error(`${t('settings.importError')}: ${e}`);
    }
}

function openReleases() {
    openUrl('https://github.com/cuteyuchen/frontend-project-manager/releases');
}
</script>

<template>
  <div class="p-6 h-full flex flex-col overflow-y-auto">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-6">{{ t('settings.title') }}</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        <el-card class="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 shadow-sm h-full flex flex-col">
            <template #header>
                <div class="font-bold">{{ t('settings.general') }}</div>
            </template>
            <el-form label-position="top">
                <el-form-item :label="t('settings.editorPath')">
                    <div class="flex gap-2 w-full">
                        <el-input v-model="settingsStore.settings.editorPath" :placeholder="t('settings.editorPathPlaceholder')">
                            <template #prepend>
                                <el-icon><div class="i-mdi-console" /></el-icon>
                            </template>
                            <template #append>
                                <el-button @click="selectEditor">{{ t('settings.selectFile') }}</el-button>
                            </template>
                        </el-input>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {{ t('settings.editorPathHint') }}
                    </div>
                </el-form-item>

                <el-form-item :label="t('settings.defaultTerminal')">
                    <el-select v-model="settingsStore.settings.defaultTerminal" class="w-full">
                        <el-option label="Command Prompt (cmd.exe)" value="cmd" />
                        <el-option label="PowerShell" value="powershell" />
                        <el-option label="Git Bash" value="git-bash" />
                    </el-select>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {{ t('settings.terminalHint') }}
                    </div>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 shadow-sm h-full flex flex-col">
            <template #header>
                <div class="font-bold">{{ t('settings.appearance') }}</div>
            </template>
            <el-form label-position="top">
                <el-form-item :label="t('settings.language')">
                    <el-select v-model="settingsStore.settings.locale" class="w-full">
                        <el-option label="中文" value="zh" />
                        <el-option label="English" value="en" />
                    </el-select>
                </el-form-item>

                <el-form-item :label="t('settings.theme')">
                    <el-select v-model="settingsStore.settings.themeMode" class="w-full">
                        <el-option :label="t('settings.themeMode.dark')" value="dark" />
                        <el-option :label="t('settings.themeMode.light')" value="light" />
                        <el-option :label="t('settings.themeMode.system')" value="auto" />
                    </el-select>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 shadow-sm h-full flex flex-col">
            <template #header>
                <div class="font-bold">{{ t('settings.update') }}</div>
            </template>
            <el-form label-position="top">
                <el-form-item :label="t('settings.autoUpdate')">
                    <el-switch v-model="settingsStore.settings.autoUpdate" />
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {{ t('settings.autoUpdateHint') }}
                    </div>
                </el-form-item>
                
                <div class="mt-4">
                    <div class="text-sm font-medium mb-2">{{ t('settings.releases') }}</div>
                    <el-button link type="primary" @click="openReleases">
                        https://github.com/cuteyuchen/frontend-project-manager/releases
                        <el-icon class="ml-1"><div class="i-mdi-open-in-new" /></el-icon>
                    </el-button>
                </div>
            </el-form>
        </el-card>

        <el-card class="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 shadow-sm h-full flex flex-col">
            <template #header>
                <div class="font-bold">{{ t('settings.data') }}</div>
            </template>
            <div class="flex gap-4">
                <el-button type="primary" @click="exportData">
                    <el-icon class="mr-1"><div class="i-mdi-export" /></el-icon>
                    {{ t('settings.export') }}
                </el-button>
                <el-button @click="importData">
                    <el-icon class="mr-1"><div class="i-mdi-import" /></el-icon>
                    {{ t('settings.import') }}
                </el-button>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {{ t('settings.dataHint') }}
            </div>
        </el-card>
    </div>
  </div>
</template>
