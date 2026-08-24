# 💰 dsh-token-cost

> Live token usage & estimated cost panel for DeepSeek Harness Web — a floating 💰 button that expands into a per-session token/cost dashboard.

DSH Web 的 Token 成本面板：右下角浮动按钮实时显示当前会话的 token 用量与估算成本，点击展开详细面板。

## ✨ 功能

- **实时统计**：输入（非缓存）/ 缓存读 / 缓存写 / 输出 token，随会话流实时刷新
- **上下文使用率**：当前上下文占用（已用 / 窗口大小）
- **会话统计**：轮数 / 步数 / LLM 耗时 / 工具耗时
- **估算成本**：按模型价格表估算 USD 成本 + 人民币换算
- **一键展开/收起**：浮动按钮点击切换，`×` 或再次点击收起
- **会话跟随**：切换会话自动跟随当前会话

## 📊 面板内容

| 字段 | 说明 |
|---|---|
| 模型 | 当前 provider/model（从会话模型选择读取） |
| 输入（非缓存） | uncached input tokens |
| 缓存读 / 写 | cache-read / cache-write tokens |
| 输出 | output tokens |
| 总计 | 全部 token 之和 |
| 上下文 | 已用 / 窗口大小（百分比） |
| 轮 / 步 | turns / steps |
| LLM / 工具耗时 | llm 耗时 / 工具耗时 |
| 估算成本 | USD + ≈CNY（含输入/输出/缓存分解） |

## 📦 安装

在 web profile（`~/.dsh/profiles/web/package.json`）中注册：

```json
{
  "dependencies": {
    "dsh-token-cost": "file:C:/Users/<you>/.dsh/plugins/DSH/plugins/dsh-token-cost"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-token-cost"
      ]
    }
  }
}
```

```sh
cd ~/.dsh/profiles/web
pnpm install
# 重启 DSH Web（或重新加载插件）后刷新页面
```

## ⚙️ 价格配置

成本为**估算值**。价格表在 `client.js` 顶部的 `PRICES` 常量中（USD / 1M tokens）：

```js
const PRICES = {
  'deepseek-v4-flash': { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0.14 },
  // ... 按你的模型与官方价格调整
}
```

- 未知模型自动使用 `default` 价格，并在面板中提示"按默认价估算"
- 人民币汇率：`CNY_PER_USD = 7.2`，可按需修改

## 🗑️ 卸载

1. 从 web profile 的 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 中删除 `dsh-token-cost`
2. 在 profile 目录运行 `pnpm install`
3. 重启 DSH Web

## 📄 License

MIT
