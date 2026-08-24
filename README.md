# 🧹 dsh-hide-tool-noise

> Hide chat-flow noise in DeepSeek Harness Web — tool-call cards, Think rows and context-injection logs, with a one-click toggle button.

给 DeepSeek Harness Web GUI 的聊天界面装上"静音键"：一键隐藏工具调用卡片（Pwsh / Read / Write / Edit / Search …）、工具结果、Think（思考）折叠行和「上下文注入」日志，让对话只显示正文与最终回答。界面右下角带一个可点击的开关按钮，随时切换隐藏/显示，状态自动记住。

## ✨ 功能

- **一键开关**：聊天页右下角（输入框上方）的浮动按钮 `🧹 隐藏命令：开/关`，点击即时切换，无需刷新
- **状态记忆**：开关状态保存在 `localStorage`，刷新页面、重开会话后保持
- **零侵入**：只通过 CSS 隐藏显示层，DOM 与会话数据不动，分页/锚点逻辑不受影响
- **免配置**：安装即用，默认开启隐藏
- **主题自适应**：按钮样式使用 DSH 的 CSS 变量，自动适配深/浅色主题

## 🎯 隐藏的内容

| 界面元素 | CSS 选择器 |
|---|---|
| 工具调用卡片（Pwsh / Read / Write / Edit / Search …） | `[data-chat-flow-kind="tool-call"]` |
| 工具结果行 | `[data-chat-flow-kind="tool-result"]` |
| 工具调用内层行（兜底） | `[data-chat-anchor-key^="call:"]` |
| Think（reasoning）折叠行 | `[data-variant="think"]` |
| 上下文注入行（子代理 / skill / 工作区注入日志） | `[data-chat-flow-kind="context"]` |

## 📦 安装

### 前提

- DeepSeek Harness 的 Web profile
- Node ≥ 22

### 方式一：本地插件目录（推荐开发用）

把本项目 clone 或下载到本地（例如 `~/.dsh/plugins/dsh-hide-tool-noise`），然后在 web profile 的 `package.json` 中注册：

```json
{
  "dependencies": {
    "dsh-hide-tool-noise": "file:C:/Users/<you>/.dsh/plugins/dsh-hide-tool-noise"
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

然后进入 profile 目录安装：

```sh
cd ~/.dsh/profiles/web
pnpm install
```

> 注意：`pnpm` 对 `file:` 依赖会做副本链接；修改插件源文件后，需要删除 `node_modules/dsh-hide-tool-noise` 再 `pnpm install` 才能同步。

### 方式二：GitHub 依赖

```json
{
  "dependencies": {
    "dsh-hide-tool-noise": "github:vae-226/DSH"
  }
}
```

### 生效

插件集变更后需要**重启一次 DSH Web 进程**（或让 Web 重新加载插件本体），然后刷新页面。

## 🖱️ 使用

1. 刷新页面后，右下角出现浮动按钮 `🧹 隐藏命令：开`
2. 点击按钮切换 开/关：
   - **开**：隐藏工具调用卡片、Think 行、上下文注入行
   - **关**：全部恢复显示（方便排查时查看中间过程）
3. 状态自动保存，下次打开保持上次选择

## ⚙️ 配置

默认开启隐藏。想改默认状态，编辑 `client.js`：

```js
const DEFAULT_ENABLED = true   // 改为 false 则默认关闭隐藏
```

想调整按钮位置，修改 `client.js` 中 `BTN_CSS` 的定位属性：

```css
position:fixed; right:16px; bottom:104px;   /* 右下角，输入框上方 */
```

## 🗑️ 卸载

1. 从 web profile 的 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 中删除 `dsh-hide-tool-noise`
2. 在 profile 目录运行 `pnpm install`
3. 重启 DSH Web

## 📄 License

[MIT](LICENSE)
