# HyperExplorer

一款现代化、高性能的 macOS 文件管理器 — 基于 Rust 和 React 构建。

[English](./README.md) | [中文](./README.zh-CN.md)

HyperExplorer 将 Windows 资源管理器的高效逻辑带到 macOS：可编辑地址栏、常驻文件夹树、Everything 级极速搜索，同时保持原生 macOS 设计风格。

![HyperExplorer Screenshot](./docs/screenshot.png)

## 功能特性

- **可编辑地址栏** — 输入路径导航、复制粘贴、面包屑点击跳转
- **文件夹树状图** — Windows 风格可折叠树，懒加载
- **极速搜索** — SQLite FTS5 + Rust 驱动的毫秒级全盘搜索
- **智能分类** — 图片、视频、文档、音频、压缩包、代码文件快捷筛选
- **多标签页 & 多窗口** — 标签页可跨窗口拖拽，每个标签页独立导航历史
- **Cmd+X 剪切** — 原生剪切支持，告别 Cmd+C → Cmd+Option+V
- **QuickLook 预览** — 按空格键预览文件（文本、图片、视频、音频、PDF）
- **右键菜单** — Windows 风格，20+ 操作："新建文件"、"在终端打开"、"复制路径"等
- **深色模式** — 浅色 / 深色 / 跟随系统
- **国际化** — 英语、简体中文

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | [Tauri 2](https://tauri.app/) |
| 前端 | React 19 + TypeScript 5.8 |
| 后端 | Rust (2021 edition) |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 搜索引擎 | SQLite FTS5 + 并行文件遍历 |
| 构建工具 | Vite 7 |
| 包管理器 | pnpm |

## 从源码编译

**前置依赖：**
- [Node.js](https://nodejs.org/) (LTS)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)
- Xcode Command Line Tools (`xcode-select --install`)

```bash
# 克隆仓库
git clone git@github.com:callback-io/hyperExplorer.git
cd hyperExplorer

# 安装依赖
pnpm install

# 开发模式运行
pnpm tauri dev

# 构建生产版本 (.dmg)
pnpm tauri build
```

## 开发

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm tauri dev` | 启动应用（含热更新） |
| `pnpm tauri build` | 构建生产版本 |
| `pnpm dev` | 仅启动前端开发服务器（端口 1420） |
| `pnpm check` | ESLint + TypeScript 检查 |
| `pnpm cargo:clippy` | Rust 代码检查（警告视为错误） |
| `pnpm check:all` | 全部检查（前端 + Rust） |

### 项目结构

```
src/                    # React 前端
├── components/         # UI 组件（FileList、Sidebar、TabBar、TopBar 等）
├── hooks/              # 自定义 Hooks（useTabs、useSetting、useTheme）
├── stores/             # Zustand 状态（viewMode、clipboard）
├── contexts/           # React Context（tabs、theme）
├── lib/                # 工具库（i18n、设置管理、窗口管理）
└── locales/            # 国际化翻译（en、zh）

src-tauri/src/          # Rust 后端
├── commands/           # Tauri 命令（文件系统、搜索、应用、监听）
├── db/                 # SQLite 层（schema、索引器、搜索引擎）
└── index/              # 内存索引（回退方案）
```

### Git Hooks

通过 [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) 实现提交前自动检查：
- `*.{ts,tsx}` → ESLint 修复 + Prettier 格式化
- `*.{json,css,md}` → Prettier 格式化

## 许可证

[BSL 1.1](./LICENSE) — 非商业用途免费使用。详见 LICENSE 文件。
