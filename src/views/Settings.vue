<script setup lang="ts">
import { useSettingsStore } from '../stores/settings';
import { useProjectStore } from '../stores/project';
import { useNodeStore } from '../stores/node';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { ElMessage } from 'element-plus';

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const nodeStore = useNodeStore();

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
            ElMessage.success('导出成功');
        }
    } catch (e) {
        console.error(e);
        ElMessage.error(`导出失败: ${e}`);
    }
}

async function importData() {
    try {
        const path = await open({
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
            ElMessage.success('导入成功');
        }
    } catch (e) {
        console.error(e);
        ElMessage.error(`导入失败: ${e}`);
    }
}
</script>

<template>
  <div class="p-6 h-full flex flex-col">
    <h1 class="text-2xl font-bold text-white mb-6">设置</h1>
    
    <div class="max-w-2xl space-y-6">
        <el-card class="!bg-gray-800 !border-gray-700">
            <template #header>
                <div class="font-bold">通用设置</div>
            </template>
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

        <el-card class="!bg-gray-800 !border-gray-700">
            <template #header>
                <div class="font-bold">数据管理</div>
            </template>
            <div class="flex gap-4">
                <el-button type="primary" @click="exportData">
                    <el-icon class="mr-1"><div class="i-mdi-export" /></el-icon>
                    导出数据
                </el-button>
                <el-button @click="importData">
                    <el-icon class="mr-1"><div class="i-mdi-import" /></el-icon>
                    导入数据
                </el-button>
            </div>
            <div class="text-xs text-gray-400 mt-2">
                导出所有项目配置、设置和自定义 Node 版本。
            </div>
        </el-card>
    </div>
  </div>
</template>
