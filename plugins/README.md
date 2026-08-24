# plugins

DSH 插件目录。每个子目录是一个独立的 DSH 插件包（Cordis bundle + 浏览器端 client），可单独安装。

## 现有插件

| 插件 | 说明 |
|---|---|
| [`dsh-hide-tool-noise`](dsh-hide-tool-noise/) | 🧹 隐藏聊天流中的工具调用噪音（Pwsh/Read/Think/上下文注入），带一键开关按钮 |

## 插件结构约定

每个插件目录应包含：

```
plugins/<name>/
├── package.json      # 声明 dsh.client（浏览器端）与 dsh.bundle.patch（服务端挂载）
├── index.js          # 服务端 Cordis 插件入口（可为空壳，仅让 bundle 被加载）
├── client.js         # 浏览器端 client 插件（window.__ModuleLoader__.load）
├── cordis.patch.yml  # bundle patch：自动挂载插件行
└── README.md         # 插件说明
```

## 添加新插件

1. 复制 `dsh-hide-tool-noise/` 作为模板
2. 修改 `package.json`（name、description、版本号）
3. 实现 `index.js`（服务端逻辑）与 `client.js`（浏览器端逻辑）
4. 在根 `README.md` 的插件列表登记

所有插件默认 MIT 协议。
