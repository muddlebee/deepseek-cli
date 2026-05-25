import * as fs from "fs";
import * as path from "path";

export type RunLogEvent = {
  type: string;
  timestamp: string;
  [key: string]: unknown;
};

export class RunLogger {
  private readonly outputPath: string;

  constructor(outputPath: string) {
    this.outputPath = outputPath;
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  emit(event: Record<string, unknown> & { type: string }): void {
    const line: RunLogEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(this.outputPath, `${JSON.stringify(line)}\n`, "utf8");
  }
}
