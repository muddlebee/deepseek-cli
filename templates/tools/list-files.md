## ListFiles

List files and directories at a given path. Returns structured JSON with separate arrays for files and directories — faster and more structured than using `bash ls` or `bash find`.

Usage:
- Use this tool instead of `bash ls` or `bash find` for directory exploration.
- Results are relative to the project root.
- Hidden files (dotfiles) and `node_modules` are excluded automatically.
- Use `pattern` to filter by filename glob (e.g. `*.ts`, `*.test.*`).
- Set `recursive: false` to list only the immediate contents of a directory.
- Use `max_depth` to control how deep the walk goes (default 5, max 20).
- Results are capped at 500 entries. If `truncated` is true, narrow with `pattern` or reduce `max_depth`.
- Always run multiple independent ListFiles calls in parallel when mapping the codebase structure.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "description": "Directory to list. Defaults to the project root.",
      "type": "string"
    },
    "pattern": {
      "description": "Optional glob to filter entries by name (e.g. \"*.ts\", \"*.test.*\").",
      "type": "string"
    },
    "recursive": {
      "description": "Whether to walk subdirectories. Default true.",
      "type": "boolean"
    },
    "max_depth": {
      "description": "Maximum directory depth when recursive is true (default 5, max 20).",
      "type": "number"
    }
  },
  "additionalProperties": false
}
```
