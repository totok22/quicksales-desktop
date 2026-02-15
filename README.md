# QuickSales Desktop

基于 Tauri 2.x + React 19 + Rust 构建的跨平台桌面销售订单管理系统。

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 特性

- **极速启动** - Rust 驱动的核心引擎，冷启动 < 1s
- **本地优先** - 所有数据存储在本地 SQLite，无需联网，保护隐私
- **模板驱动** - 自定义 Excel 模板配置，支持自定义字段映射和验证规则
- **智能搜索** - 支持拼音首字母/全拼搜索商品和客户
- **多标签页** - 最多 4 个订单并行编辑，互不干扰
- **深色模式** - 自动跟随系统或手动切换
- **跨平台** - 支持 Windows、macOS、Linux

## 📸 功能模块

| 模块 | 说明 |
|------|------|
| 订单录入 | 购物车式操作，支持临时客户、快捷备注、实时计算 |
| 订单历史 | 按日期/客户/金额筛选，支持 JSON 导入导出 |
| 商品管理 | 分类树、批量操作、库存跟踪、拼音索引 |
| 客户管理 | 去重合并、搜索过滤、历史订单关联 |
| 销售统计 | 多维度筛选、趋势图、Top 排行、CSV 导出 |
| 分类管理 | 无限层级、拖拽排序 |
| 预设管理 | 备注预设、单位预设，提升录入效率 |
| 系统设置 | 模板配置、订单号规则、导出选项 |

## 🛠️ 技术栈

**前端**
- React 19 + TypeScript
- Vite 7 + Tailwind CSS
- Zustand 状态管理
- ExcelJS 导出

**后端**
- Tauri 2.x
- Rust + SQLite (rusqlite)
- 拼音转换 (pinyin crate)

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- Rust >= 1.70
- 系统依赖：参考 [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建发布

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`：
- Windows: `.msi` / `.exe` (NSIS)
- macOS: `.dmg` / `.app`
- Linux: `.deb` / `.AppImage`

## 📁 项目结构

```
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   │   ├── layout/         # 布局组件 (TopNav, Sidebar)
│   │   ├── order/          # 订单相关组件
│   │   └── ui/             # 基础 UI 组件
│   ├── pages/              # 页面组件
│   ├── stores/             # Zustand 状态管理
│   ├── services/           # 服务层 (Excel 导出等)
│   ├── hooks/              # 自定义 Hooks
│   ├── types/              # TypeScript 类型定义
│   └── constants/          # 常量 (内置模板 Base64)
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands/       # Tauri 命令 (IPC 接口)
│   │   ├── database/       # 数据库连接与 Schema
│   │   ├── models/         # 数据模型
│   │   └── utils/          # 工具函数
│   ├── icons/              # 应用图标
│   └── Cargo.toml          # Rust 依赖
├── package.json
└── tauri.conf.json         # Tauri 配置
```

## 🎨 更换应用图标

1. 准备 1024x1024 PNG 图片
2. 执行命令自动生成多尺寸图标：

```bash
npm run tauri icon ./your-icon.png
```

3. 重新构建应用

## 📦 数据存储

数据库文件位置：
- Windows: `%APPDATA%/com.quicksales.app/quicksales.db`
- macOS: `~/Library/Application Support/com.quicksales.app/quicksales.db`
- Linux: `~/.local/share/com.quicksales.app/quicksales.db`

## 📋 订单数据导入导出

支持 JSON 格式导入导出订单历史：

```json
{
  "version": "1.0",
  "exportedAt": "2026-02-15T00:00:00.000Z",
  "orders": [
    {
      "orderNumber": "NO.000001",
      "date": "2026-02-15",
      "customer": { "name": "张三", "phone": "13800138000", "licensePlate": "京A12345" },
      "items": [{ "name": "商品A", "unit": "件", "price": 10, "quantity": 2 }],
      "totalAmount": 20,
      "status": "completed"
    }
  ]
}
```

## 🔧 开发注意事项

1. **数据库变更**：修改 `models/mod.rs` 后需同步更新 `database/schema.rs`
2. **模板修改**：Excel 模板以 Base64 存储在 `constants/defaultTemplateBase64.ts`
3. **命令新增**：在 `commands/` 添加后需在 `lib.rs` 注册

## 📄 License

MIT License

## 🔗 相关链接

- [Tauri 官方文档](https://tauri.app/)
- [React 文档](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
