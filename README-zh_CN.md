<div align="center">

# doku

### 面向终端的 DeepSeek AI 编程助手

[![][github-stars-shield]][github-stars-link] [![][github-issues-shield]][github-issues-link] [![][github-license-shield]][github-license-link]

[English](README.md) · 中文

*坏代码的毒药。*

</div>

---

**doku** 是专为 [DeepSeek](https://deepseek.com) 模型打造的终端 AI 编程助手。支持深度思考、推理强度控制、Agent Skills 以及 MCP 集成——一切尽在终端。

```bash
npm install -g deepseek-cli
doku
```

## 功能特性

- **DeepSeek 深度优化** — 专为 DeepSeek v4 Pro/Flash 调优，原生支持思考模式和推理强度控制
- **上下文缓存** — 通过 [KV 缓存](https://api-docs.deepseek.com/guides/kv_cache) 降低 API 成本
- **Agent Skills** — 通过用户级或项目级 skill 文件扩展助手能力
- **MCP 支持** — 通过 Model Context Protocol 连接 GitHub、浏览器、数据库等
- **撤销 / 检查点** — 随时将代码和对话恢复到任意历史状态
- **OpenAI 兼容** — 支持任意 OpenAI 兼容的 API 端点

## 安装

```bash
npm install -g deepseek-cli
```

在任意项目目录下运行：

```bash
doku
```

## 配置

创建 `~/.doku/settings.json`：

```json
{
  "env": {
    "MODEL": "deepseek-v4-pro",
    "BASE_URL": "https://api.deepseek.com",
    "API_KEY": "sk-..."
  },
  "thinkingEnabled": true,
  "reasoningEffort": "max"
}
```

项目级配置请在项目根目录创建 `./.doku/settings.json`。

也可以使用环境变量——任意 `DOKU_*` 环境变量都会映射到对应配置项：

```bash
DOKU_API_KEY=sk-... DOKU_MODEL=deepseek-v4-flash doku
```

## 斜杠命令

| 命令 | 操作 |
|------|------|
| `/` | 打开 skills / 命令菜单 |
| `/new` | 开始新对话 |
| `/resume` | 选择历史对话继续 |
| `/continue` | 继续当前对话，或恢复历史对话 |
| `/model` | 切换模型、思考模式和推理强度 |
| `/skills` | 列出可用 skills |
| `/mcp` | 查看 MCP 服务器状态和可用工具 |
| `/undo` | 将代码和/或对话恢复到之前的状态 |
| `/raw` | 切换显示模式（Normal / Lite / Raw） |
| `/exit` | 退出 |

## 按键说明

| 按键 | 操作 |
|------|------|
| `Enter` | 发送消息 |
| `Shift+Enter` | 插入换行 |
| `Ctrl+V` | 从剪贴板粘贴图片 |
| `Esc` | 中断当前模型回复 |
| `@` | 提及文件 |
| `/` | 打开命令菜单 |
| 连续 `Ctrl+D` | 退出 |

## 支持的模型

| 模型 | 说明 |
|------|------|
| `deepseek-v4-pro` | 推荐——质量最佳 |
| `deepseek-v4-flash` | 更快，成本更低 |
| 任意 OpenAI 兼容模型 | 相应设置 `BASE_URL` 即可 |

## Agent Skills

doku 支持 skills——通过 markdown 文件扩展助手能力。

**用户级 skills**（适用于所有项目）：
```
~/.agents/skills/<skill-name>/SKILL.md
```

**项目级 skills**（适用于当前项目）：
```
./.agents/skills/<skill-name>/SKILL.md
```

## MCP 集成

通过 [Model Context Protocol](https://modelcontextprotocol.io) 连接外部工具。在 `~/.doku/settings.json` 中添加：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "..." }
    }
  }
}
```

在 doku 内使用 `/mcp` 查看已连接的服务器和可用工具。

## 开发

```bash
# 克隆仓库
git clone https://github.com/muddlebee/deepseek-cli.git
cd deepseek-cli

# 安装依赖
npm install

# 直接运行（无需构建）
npm run dev

# 构建
npm run bundle

# 类型检查 + lint + 格式检查
npm run check

# 测试
npm test
```

## 贡献

欢迎提交 PR。提交前请确保 `npm run check` 通过。

## 协议

MIT © [muddlebee](https://github.com/muddlebee)

---

<!-- LINK GROUP -->
<!-- npm badges temporarily removed until package is published -->
[github-stars-link]: https://github.com/muddlebee/deepseek-cli/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/muddlebee/deepseek-cli?color=0ea5e9&labelColor=18181b&style=flat-square
[github-issues-link]: https://github.com/muddlebee/deepseek-cli/issues
[github-issues-shield]: https://img.shields.io/github/issues/muddlebee/deepseek-cli?color=0ea5e9&labelColor=18181b&style=flat-square
[github-license-link]: https://github.com/muddlebee/deepseek-cli/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/github/license/muddlebee/deepseek-cli?color=0ea5e9&labelColor=18181b&style=flat-square
