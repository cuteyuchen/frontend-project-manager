# Frontend Project Manager

轻量级前端项目管理器，基于 Tauri v2 + Vue 3 + Rust 开发。

## 🛠️ 前置要求

1.  **安装 Rust**: 请访问 [rust-lang.org](https://www.rust-lang.org/tools/install) 下载 `rustup-init.exe` 并安装。
2.  **安装 C++ 生成工具**: 安装 Visual Studio Build Tools (选中 "Desktop development with C++")。
3.  **Node.js**: 确保已安装 Node.js 和 npm。

## 🚀 快速开始

1.  进入项目目录：
    ```bash
    cd frontend-manager
    ```

2.  安装依赖：
    ```bash
    npm install
    # 补充安装必要的 UI 和 Tauri 插件依赖
    npm install pinia
    npm install -D unocss @iconify-json/mdi
    npm install @tauri-apps/plugin-dialog
    ```

3.  启动开发环境：
    ```bash
    npm run tauri dev
    ```

## 📦 功能特性

*   **自动识别 Node 版本**: 自动读取 `NVM_HOME` 环境变量下的 Node 版本。
*   **多版本并行运行**: 通过 Rust 进程注入技术，支持不同项目使用不同 Node 版本运行，互不干扰。
*   **轻量级**: 使用系统原生 WebView2，体积小，启动快。
*   **可视化管理**: 自动识别 `package.json` 脚本，一键运行。

## 🏗️ 构建发布

构建 Windows 安装包：
```bash
npm run tauri build
```
