<script setup lang="ts">
import { ref } from 'vue';
import { useNodeStore } from '../stores/node';
import AddNodeModal from '../components/AddNodeModal.vue';
import { ElMessageBox, ElMessage } from 'element-plus';

const nodeStore = useNodeStore();
const showAddModal = ref(false);

function refresh() {
    nodeStore.loadNvmNodes();
    ElMessage.success('已刷新 NVM 列表');
}

function handleRemove(path: string) {
    ElMessageBox.confirm(
        '确定要移除这个自定义 Node 版本吗?',
        '警告',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
    ).then(() => {
        nodeStore.removeNode(path);
        ElMessage.success('移除成功');
    });
}

function editDefault() {
    ElMessageBox.prompt('请输入默认 Node 的路径 (例如 C:\\Program Files\\nodejs)', '编辑默认 Node', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: nodeStore.versions.find(v => v.source === 'system')?.path || '',
    }).then((result) => {
        const value = result?.value;
        nodeStore.updateSystemNode(value);
        ElMessage.success('默认 Node 路径已更新');
    }).catch(() => {});
}
</script>

<template>
  <div class="p-8 h-full flex flex-col">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-1">Node 版本管理</h1>
        <p class="text-slate-400 text-sm">切换和管理 Node.js 环境</p>
      </div>
      <div class="flex gap-3">
        <el-button type="success" @click="showAddModal = true" class="!rounded-lg">
             <el-icon class="mr-1"><div class="i-mdi-plus" /></el-icon> 手动添加
        </el-button>
        <el-button type="primary" @click="refresh" class="!rounded-lg">
             <el-icon class="mr-1"><div class="i-mdi-refresh" /></el-icon> 从 NVM 获取
        </el-button>
      </div>
    </div>

    <div class="flex-1 bg-[#1e293b]/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
        <el-table 
            :data="nodeStore.versions" 
            style="width: 100%" 
            height="100%"
            :header-cell-style="{ background: '#1e293b', color: '#94a3b8', borderColor: '#334155' }"
            :cell-style="{ background: 'transparent', borderColor: '#334155' }"
            :row-style="{ background: 'transparent' }"
        >
            <el-table-column prop="version" label="版本号" width="180">
                <template #default="{ row }">
                    <span class="font-bold text-lg font-mono text-slate-200">{{ row.version }}</span>
                </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="120">
                <template #default="{ row }">
                    <el-tag v-if="row.source === 'system'" type="info" effect="dark" class="!bg-slate-700/50 !border-slate-600">默认</el-tag>
                    <el-tag v-else-if="row.source === 'nvm'" effect="dark" class="!bg-purple-500/20 !text-purple-300 !border-purple-500/30">NVM</el-tag>
                    <el-tag v-else effect="dark" class="!bg-amber-500/20 !text-amber-300 !border-amber-500/30">自定义</el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="path" label="路径" show-overflow-tooltip>
                <template #default="{ row }">
                    <span class="text-slate-400 font-mono text-xs">{{ row.path }}</span>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="150" align="right">
                <template #default="{ row }">
                    <el-button 
                        v-if="row.source === 'custom'" 
                        type="danger" 
                        size="small" 
                        plain
                        @click="handleRemove(row.path)"
                        class="!rounded-md"
                    >移除</el-button>
                    <el-button 
                        v-if="row.source === 'system'" 
                        type="primary" 
                        size="small" 
                        plain
                        @click="editDefault"
                        class="!rounded-md"
                    >编辑</el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>

    <AddNodeModal v-model="showAddModal" />
  </div>
</template>

<style scoped>
:deep(.el-table__inner-wrapper::before) {
    background-color: #334155 !important;
}
:deep(.el-table__border-left-patch) {
    background-color: #334155 !important;
}
</style>
