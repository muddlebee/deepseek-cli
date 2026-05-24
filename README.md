<div align="center">

# doku

### DeepSeek AI coding assistant for your terminal

[![][npm-release-shield]][npm-release-link] [![][npm-downloads-shield]][npm-downloads-link] [![][github-stars-shield]][github-stars-link] [![][github-issues-shield]][github-issues-link] [![][github-license-shield]][github-license-link]

English · [中文](README-zh_CN.md)

*Poison to bad code.*

</div>

---

**doku** is a terminal AI coding assistant built for [DeepSeek](https://deepseek.com) models. It supports deep thinking, reasoning effort control, Agent Skills, and MCP integration — all from your terminal.

```bash
npm install -g deepseek-cli
doku
```

## Features

- **DeepSeek-optimized** — tuned for DeepSeek v4 Pro/Flash with native thinking mode and reasoning effort control
- **Context caching** — reduces API costs via [KV cache](https://api-docs.deepseek.com/guides/kv_cache)
- **Agent Skills** — extend the assistant with custom skill files at user or project level
- **MCP support** — connect GitHub, browsers, databases, and more via Model Context Protocol
- **Undo / checkpoints** — restore code and conversation to any previous state
- **OpenAI-compatible** — works with any OpenAI-compatible API endpoint

## Install

```bash
npm install -g deepseek-cli
```

Then run in any project directory:

```bash
doku
```

## Configuration

Create `~/.doku/settings.json`:

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

For project-level settings, create `./.doku/settings.json` in your project root.

You can also use environment variables — any `DOKU_*` env var maps to the corresponding setting:

```bash
DOKU_API_KEY=sk-... DOKU_MODEL=deepseek-v4-flash doku
```

## Slash Commands

| Command | Action |
|---------|--------|
| `/` | Open skills / commands menu |
| `/new` | Start a fresh conversation |
| `/resume` | Pick a previous conversation to continue |
| `/continue` | Continue the active conversation |
| `/model` | Switch model, thinking mode, and reasoning effort |
| `/skills` | List available skills |
| `/mcp` | Show MCP server status and tools |
| `/undo` | Restore code and/or conversation to a previous state |
| `/raw` | Toggle display mode (Normal / Lite / Raw) |
| `/exit` | Quit |

## Key Bindings

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | Insert newline |
| `Ctrl+V` | Paste image from clipboard |
| `Esc` | Interrupt current model turn |
| `@` | Mention a file |
| `/` | Open commands menu |
| `Ctrl+D` twice | Quit |

## Supported Models

| Model | Notes |
|-------|-------|
| `deepseek-v4-pro` | Recommended — best quality |
| `deepseek-v4-flash` | Faster, lower cost |
| Any OpenAI-compatible model | Set `BASE_URL` accordingly |

## Agent Skills

doku supports skills — markdown files that extend the assistant's capabilities.

**User-level skills** (apply to all projects):
```
~/.agents/skills/<skill-name>/SKILL.md
```

**Project-level skills** (apply to current project):
```
./.agents/skills/<skill-name>/SKILL.md
```

## MCP Integration

Connect external tools via [Model Context Protocol](https://modelcontextprotocol.io). Add to `~/.doku/settings.json`:

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

Then use `/mcp` inside doku to view connected servers and available tools.

## Development

```bash
# Clone
git clone https://github.com/muddlebee/deepseek-cli.git
cd deepseek-cli

# Install dependencies
npm install

# Run directly (no build step)
npm run dev

# Build
npm run bundle

# Type check + lint + format
npm run check

# Tests
npm test
```

## Contributing

PRs welcome. Please ensure `npm run check` passes before submitting.

## License

MIT © [muddlebee](https://github.com/muddlebee)

---

<!-- LINK GROUP -->
[npm-release-link]: https://www.npmjs.com/package/deepseek-cli
[npm-release-shield]: https://img.shields.io/npm/v/deepseek-cli?color=0ea5e9&labelColor=18181b&logo=npm&logoColor=white&style=flat-square
[npm-downloads-link]: https://www.npmjs.com/package/deepseek-cli
[npm-downloads-shield]: https://img.shields.io/npm/dt/deepseek-cli?labelColor=18181b&style=flat-square&color=0ea5e9
[github-stars-link]: https://github.com/muddlebee/deepseek-cli/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/muddlebee/deepseek-cli?color=0ea5e9&labelColor=18181b&style=flat-square
[github-issues-link]: https://github.com/muddlebee/deepseek-cli/issues
[github-issues-shield]: https://img.shields.io/github/issues/muddlebee/deepseek-cli?color=0ea5e9&labelColor=18181b&style=flat-square
[github-license-link]: https://github.com/muddlebee/deepseek-cli/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/github/license/muddlebee/deepseek-cli?color=0ea5e9&labelColor=18181b&style=flat-square
