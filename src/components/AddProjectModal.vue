<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { Project } from '../types';

const props = defineProps<{ 
    modelValue: boolean,
    editProject?: Project | null
}>();
const emit = defineEmits(['update:modelValue', 'add', 'update']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const isEdit = computed(() => !!props.editProject);

const form = ref({
  id: '',
  name: '',
  path: '',
  type: 'node' as const,
  nodeVersion: '',
  packageManager: 'npm' as const,
  scripts: [] as string[]
});

watch(() => props.editProject, (newVal) => {
    if (newVal) {
        form.value = { ...newVal };
    } else {
        resetForm();
    }
}, { immediate: true });

function resetForm() {
    form.value = {
        id: '',
        name: '',
        path: '',
        type: 'node',
        nodeVersion: nodeVersions.value[0] || '',
        packageManager: 'npm',
        scripts: []
    };
}

const nodeVersions = ref<string[]>([]);
const loading = ref(false);

onMounted(async () => {
  try {
    const list: any[] = await invoke('get_nvm_list');
    nodeVersions.value = list.map(v => v.version);
    if (nodeVersions.value.length > 0) {
      form.value.nodeVersion = nodeVersions.value[0];
    }
  } catch (e) {
    console.error('Failed to load node versions', e);
  }
});

async function selectFolder() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    
    if (selected && typeof selected === 'string') {
      form.value.path = selected;
      // Auto scan
      try {
        loading.value = true;
        const info: any = await invoke('scan_project', { path: selected });
        form.value.name = info.name;
        form.value.scripts = info.scripts;
      } catch (e) {
        console.error('Failed to scan project', e);
      } finally {
        loading.value = false;
      }
    }
  } catch (err) {
    console.error('Failed to open dialog:', err);
  }
}

function submit() {
  if (!form.value.name || !form.value.path) return;
  
  const project: Project = {
    id: isEdit.value ? form.value.id : crypto.randomUUID(),
    name: form.value.name,
    path: form.value.path,
    type: form.value.type,
    nodeVersion: form.value.nodeVersion,
    packageManager: form.value.packageManager,
    scripts: form.value.scripts
  };
  
  if (isEdit.value) {
      emit('update', project);
  } else {
      emit('add', project);
  }
  visible.value = false;
  // Reset form will be handled by watch or next open if we clear editProject
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑项目' : '添加项目'"
    width="500px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-position="top" :model="form">
        <el-form-item label="项目名称" required>
            <el-input v-model="form.name" placeholder="请输入名称" />
        </el-form-item>
        
        <el-form-item label="项目文件夹" required>
            <div class="flex gap-2 w-full">
                <el-input v-model="form.path" placeholder="请选择文件夹" readonly>
                    <template #append>
                        <el-button @click="selectFolder">
                             <el-icon><div class="i-mdi-folder" /></el-icon>
                        </el-button>
                    </template>
                </el-input>
            </div>
        </el-form-item>

        <el-row :gutter="20">
            <el-col :span="12">
                <el-form-item label="类型">
                    <el-select v-model="form.type">
                        <el-option label="Node 服务" value="node" />
                        <el-option label="静态站点" value="static" />
                    </el-select>
                </el-form-item>
            </el-col>
            <el-col :span="12">
                <el-form-item label="Node 版本">
                    <el-select v-model="form.nodeVersion">
                        <el-option label="默认" value="" />
                        <el-option v-for="v in nodeVersions" :key="v" :label="v" :value="v" />
                    </el-select>
                </el-form-item>
            </el-col>
        </el-row>

        <el-form-item label="包管理器">
            <el-select v-model="form.packageManager">
                <el-option label="npm" value="npm" />
                <el-option label="yarn" value="yarn" />
                <el-option label="pnpm" value="pnpm" />
                <el-option label="cnpm" value="cnpm" />
            </el-select>
        </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="submit" :disabled="!form.name || !form.path" :loading="loading">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>
