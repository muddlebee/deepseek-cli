import json
import os
import shlex
from pathlib import Path
from typing import Any

from harbor.agents.installed.base import BaseInstalledAgent, CliFlag, with_prompt_template
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


class DokuAgent(BaseInstalledAgent):
    """Run doku via ``doku exec`` inside Harbor task containers."""

    SUPPORTS_ATIF: bool = False

    CLI_FLAGS = [
        CliFlag("max_turns", cli="--max-turns", type="int"),
        CliFlag("timeout_sec", cli="--timeout-sec", type="int"),
        CliFlag("enable_mcp", cli="--mcp", type="bool"),
    ]

    _OUTPUT_FILENAME = "doku.jsonl"
    _TEXT_LOG_FILENAME = "doku.txt"

    def __init__(self, *args, npm_spec: str = "doku-deepseek-cli", **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._npm_spec = npm_spec

    @staticmethod
    def name() -> str:
        return "doku"

    def get_version_command(self) -> str | None:
        return "doku --version"

    def parse_version(self, stdout: str) -> str:
        return stdout.strip() or "unknown"

    async def install(self, environment: BaseEnvironment) -> None:
        await self.exec_as_root(
            environment,
            command=(
                "set -euo pipefail; "
                "if command -v apt-get >/dev/null 2>&1; then "
                "apt-get update && apt-get install -y curl ca-certificates; "
                "elif command -v apk >/dev/null 2>&1; then "
                "apk add --no-cache curl ca-certificates bash; "
                "else echo 'Unsupported base image: need apt-get or apk' >&2; exit 1; "
                "fi"
            ),
            env={"DEBIAN_FRONTEND": "noninteractive"},
        )
        await self.exec_as_root(
            environment,
            command="curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs",
            env={"DEBIAN_FRONTEND": "noninteractive"},
        )
        await self.exec_as_agent(
            environment,
            command=f"npm install -g {shlex.quote(self._npm_spec)} && doku --version",
        )

    @with_prompt_template
    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        escaped_instruction = shlex.quote(instruction)
        output_path = self.logs_dir / self._OUTPUT_FILENAME
        text_log_path = self.logs_dir / self._TEXT_LOG_FILENAME
        cli_flags = self.build_cli_flags()
        flag_suffix = f"{cli_flags} " if cli_flags else ""

        env = self._build_doku_env()
        command = (
            "set -euo pipefail; "
            f"doku exec --non-interactive --prompt {escaped_instruction} "
            f"--output {shlex.quote(str(output_path))} "
            f"{flag_suffix}"
            f"2>&1 | tee {shlex.quote(str(text_log_path))}"
        )

        result = await self.exec_as_agent(environment, command=command, env=env)
        context.exit_code = result.return_code

    def populate_context_post_run(self, context: AgentContext) -> None:
        log_path = self.logs_dir / self._OUTPUT_FILENAME
        if not log_path.exists():
            return

        for line in log_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") != "session_end":
                continue

            usage = event.get("usage")
            if isinstance(usage, dict):
                prompt_tokens = usage.get("prompt_tokens")
                completion_tokens = usage.get("completion_tokens")
                if isinstance(prompt_tokens, int):
                    context.n_input_tokens = prompt_tokens
                if isinstance(completion_tokens, int):
                    context.n_output_tokens = completion_tokens

            exit_code = event.get("exitCode")
            if isinstance(exit_code, int):
                context.exit_code = exit_code
            break

    def _build_doku_env(self) -> dict[str, str]:
        env: dict[str, str] = {}

        api_key = (
            os.environ.get("DOKU_API_KEY")
            or os.environ.get("DEEPSEEK_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
        )
        if api_key:
            env["DOKU_API_KEY"] = api_key

        if self.model_name:
            if "/" in self.model_name:
                _, model = self.model_name.split("/", 1)
            else:
                model = self.model_name
            env["DOKU_MODEL"] = model

        base_url = os.environ.get("DOKU_BASE_URL") or os.environ.get("DEEPSEEK_BASE_URL")
        if base_url:
            env["DOKU_BASE_URL"] = base_url

        for key, value in os.environ.items():
            if key.startswith("DOKU_") and key not in env:
                env[key] = value

        return env
