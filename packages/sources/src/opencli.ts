import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runOpenCli(
  bin: string,
  argv: string[],
  timeoutMs: number,
): Promise<string> {
  const { stdout } = await execFileAsync(bin, argv, {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trim();
}

export async function runOpenCliJson<T>(
  bin: string,
  argv: string[],
  timeoutMs: number,
): Promise<T> {
  const output = await runOpenCli(bin, argv, timeoutMs);
  return JSON.parse(output) as T;
}
