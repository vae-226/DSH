# 🧩 DSH Plugin & Skill Collection

> A growing collection of plugins and skills for **DeepSeek Harness (DSH) Web** — each one is a small, focused enhancement. Currently: one plugin, more on the way.

DeepSeek Harness Web GUI 的插件与技能合集仓库。每个插件/技能都是独立的小功能，按目录组织，随用随装。

## 📁 仓库结构

```
DSH/
├── plugins/                  # DSH 插件（Cordis bundle + 浏览器端 client）
│   ├── dsh-hide-tool-noise/  # 🧹 隐藏聊天流中的工具调用噪音（含一键开关）
│   ├── dsh-token-cost/       # 💰 Token 用量与估算成本面板
│   └── dsh-file-preview/     # 📂 文件侧边栏：预览、全屏查看、在资源管理器打开
└── skills/                   # DSH 技能（预留，规划中）
```

## 📦 现有插件

### 🧹 dsh-hide-tool-noise

给 DSH Web 聊天界面装上"静音键"：一键隐藏工具调用卡片（Pwsh / Read / Write / Edit / Search …）、工具结果、Think 行和「上下文注入」日志，右下角浮动按钮随时切换开/关，状态自动记住。

- 详见 [`plugins/dsh-hide-tool-noise/README.md`](plugins/dsh-hide-tool-noise/README.md)

### 💰 dsh-token-cost

右下角浮动 💰 面板：实时显示当前会话 token 用量（输入/输出/缓存）、上下文使用率、会话统计与估算成本，点击展开详情。

- 详见 [`plugins/dsh-token-cost/README.md`](plugins/dsh-token-cost/README.md)

### 📂 dsh-file-preview

右下角 📂 浮动按钮，展开工作区文件树：点击文件全屏预览内容，一键在 Windows 资源管理器打开。

- 详见 [`plugins/dsh-file-preview/README.md`](plugins/dsh-file-preview/README.md)

## 🛠️ 安装插件

在 web profile（`~/.dsh/profiles/web/package.json`）中注册：

```json
{
  "dependencies": {
    "dsh-hide-tool-noise": "github:vae-226/DSH"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-hide-tool-noise"
      ]
    }
  }
}
```

```sh
cd ~/.dsh/profiles/web
pnpm install
# 重启 DSH Web 后刷新页面生效
```

## ➕ 添加新插件 / 技能

- **新插件**：在 `plugins/<name>/` 下创建包（含 `package.json` 声明 `dsh.client` 与 `dsh.bundle.patch`、`index.js` 服务端入口、`client.js` 浏览器端），参考 `plugins/dsh-hide-tool-noise/` 的结构。
- **新技能**：在 `skills/<name>/` 下组织，遵循 DSH 技能规范（规划中）。

## 📄 License

[MIT](LICENSE) — 所有子插件/技能沿用 MIT，除非另有说明。
