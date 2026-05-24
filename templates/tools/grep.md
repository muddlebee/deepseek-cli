## Grep

Search file contents using ripgrep (rg). Returns structured JSON with file paths, line numbers, and matched content — purpose-built for codebase exploration.

Usage:
- Use this tool instead of `bash rg/grep` whenever you need to find symbols, patterns, or text across the codebase. It returns structured output the model can act on directly.
- Prefer `Grep` over `bash` for all search operations — it is faster, returns structured results, and does not require shell escaping.
- Use `include` to narrow searches to specific file types (e.g. `*.ts`, `*.py`).
- Use `context_lines` when you need surrounding lines to understand the match without reading the full file.
- Results are capped at 200 matches. If `truncated` is true, narrow the search with a more specific `pattern` or `include` filter.
- File paths in results are relative to the project root.
- Always run multiple independent Grep calls in parallel when exploring the codebase.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pattern": {
      "description": "Regex or literal string to search for.",
      "type": "string"
    },
    "path": {
      "description": "Directory or file to search. Defaults to the project root.",
      "type": "string"
    },
    "include": {
      "description": "Glob pattern to filter files (e.g. \"*.ts\", \"src/**/*.py\").",
      "type": "string"
    },
    "case_sensitive": {
      "description": "Whether to match case-sensitively. Default false.",
      "type": "boolean"
    },
    "context_lines": {
      "description": "Number of lines to include before and after each match (0–10). Default 0.",
      "type": "number"
    }
  },
  "required": ["pattern"],
  "additionalProperties": false
}
```
