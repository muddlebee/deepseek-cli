# Repository Guidelines

## Project Identity

- **Brand name**: `doku` — the terminal AI coding assistant
- **npm package**: `doku-deepseek-cli` (for SEO discoverability; `npm install -g doku-deepseek-cli`)
- **Binary**: `doku` (what users type daily)
- **Config directory**: `~/.doku/settings.json` (user-level), `./.doku/settings.json` (project-level)
- **Environment variables**: `DOKU_*` prefix (e.g. `DOKU_API_KEY`, `DOKU_MODEL`)
- **Internal env sentinels**: `__DOKU_STATUS__`, `__DOKU_PWD__` (used in bash-handler output parsing)
- **MCP client name**: `"doku"` (in `src/mcp/mcp-client.ts`)
- **File history manifest**: `.doku-file-history.json`; git checkpoint author is `doku checkpoint <doku-checkpoint@localhost>`

Do not introduce any references to the old names: `deepcode`, `Deep Code`, `DEEPCODE_`, or `~/.deepcode`.

## Project Structure & Module Organization

- `src/cli.tsx` — entrypoint; parses CLI args, renders the Ink app
- `src/ui/` — all Ink/React UI: `App.tsx`, `WelcomeScreen.tsx`, `PromptInput.tsx`, `UpdatePrompt.tsx`, `ThemedGradient.tsx`, and `components/MessageView/`
- `src/tools/` — one handler file per tool (`bash-handler.ts`, `edit-handler.ts`, `write-handler.ts`, `read-handler.ts`, `grep-handler.ts`, `list-files-handler.ts`, `web-search-handler.ts`, `update-plan-handler.ts`, `ask-user-question-handler.ts`), plus `executor.ts` which dispatches tool calls
- `src/mcp/` — MCP client and manager (`mcp-client.ts`, `mcp-manager.ts`)
- `src/common/` — shared helpers: settings, file history, shell utils, model capabilities, etc.
- `src/session.ts` — session lifecycle: create, reply, continue, undo, checkpoints
- `src/prompt.ts` — system prompt construction; identity string is `"You are doku, an interactive CLI tool..."`
- `src/tests/` — Node test files (`*.test.ts`); run with `tsx --test`
- `templates/prompts/` — EJS prompt templates
- `templates/tools/` — Markdown tool instruction files loaded into the system prompt (`bash.md`, `edit.md`, `write.md`, `read.md.ejs`, `grep.md`, `list-files.md`, `web-search.md`, `update-plan.md`, `ask-user-question.md`)
- `templates/skills/` — built-in skill templates (`plan-and-execute.md`, `agent-drift-guard.md`)
- `docs/` — user-facing documentation: `configuration.md`, `configuration_en.md`, `mcp.md`, `mcp_en.md`, `notify.md`, `notify_en.md`

## UI & Theming

- Color theme: `#0ea5e9` (sky blue), `#6366f1` (indigo), `#8b5cf6` (violet) — used as a gradient across branding surfaces
- `ThemedGradient.tsx` applies this three-stop gradient to text via `ink-gradient`
- `WelcomeScreen.tsx` renders an ASCII logo via `figlet` (`"Slant"` font) + compact inline settings row with `@inkjs/ui` `Badge`
- `PromptInput.tsx` uses braille spinner frames with cycling gradient colors; input border is `"round"` style (`#6366f1` when busy, `#0ea5e9` when idle); idle prefix is `"❯ "`
- `MessageView` uses `◎` (gray) for thinking, `◆` (green/red) for tool results, `❯` for user/system messages, `✦` for assistant messages

## Build, Test, and Development Commands

- `npm run dev` — run directly from source via `tsx` (no build step needed)
- `npm run bundle` — bundle `src/cli.tsx` → `dist/cli.js` via esbuild
- `npm run start` — bundle then run `dist/cli.js`
- `npm run build` — full build: typecheck + lint + format check + bundle + chmod
- `npm test` — run all test files with `tsx --test`
- `npm run test:single -- src/tests/<name>.test.ts` — run one test file
- `npm run typecheck` — TypeScript type check without emit
- `npm run lint` / `npm run lint:fix` — ESLint for `src/`
- `npm run format` / `npm run format:check` — Prettier for `src/`
- `npm run check` — typecheck + lint + format:check (must pass before merging)

## Coding Style & Naming Conventions

- Use TypeScript ES modules; keep imports explicit.
- Prefer small, focused functions; centralize filesystem path construction when a path is reused across files.
- Two-space indentation, Prettier-compatible formatting.
- No comments unless the WHY is non-obvious. No docstrings. No trailing summary comments.
- Standard technical English; no jargon or corporate-speak.

## Testing Guidelines

- Add or update tests in `src/tests/` when changing command behavior, prompt rendering, session flow, tools, or settings.
- Use Node's built-in `node:test` and `node:assert/strict` APIs to match existing tests.
- Keep tests deterministic: use temporary directories (`fs.mkdtempSync`) and mock network calls where needed.
- Temp dir prefixes follow the `doku-<purpose>-` convention.
- Env var overrides in tests use the `DOKU_*` prefix.

## Commit & Pull Request Guidelines

- Keep commits focused on a single change; use concise, imperative commit messages.
- In pull requests, describe the behavior change, list verification commands, and note any packaging or template path changes.
- Run `npm run check && npm test` before opening a PR.
