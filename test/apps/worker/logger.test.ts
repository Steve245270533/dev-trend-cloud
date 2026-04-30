import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { createWorkerLogger } from "../../../apps/worker/src/services/logger.js";

interface LoggedEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  context: Record<string, unknown>;
}

interface WaitedLogFiles {
  allFiles: string[];
  rotatedFiles: string[];
}

async function waitForLogFiles(logsDir: string): Promise<WaitedLogFiles> {
  for (let index = 0; index < 20; index += 1) {
    const files = await readdir(logsDir).catch(() => []);
    const rotatedFiles = files.filter((file) =>
      /^worker\.\d{4}-\d{2}-\d{2}\.\d+\.log$/.test(file),
    );

    if (rotatedFiles.length > 0) {
      return {
        allFiles: files,
        rotatedFiles,
      };
    }

    await sleep(25);
  }

  throw new Error("Timed out waiting for worker log file generation");
}

async function waitForLogContent(logFilePath: string): Promise<string> {
  for (let index = 0; index < 20; index += 1) {
    const content = await readFile(logFilePath, "utf8").catch(() => "");
    if (content.trim().length > 0) {
      return content;
    }
    await sleep(25);
  }

  throw new Error("Timed out waiting for worker log writes");
}

test("createWorkerLogger creates logs directory and writes JSON lines to the daily file", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "worker-logger-"));
  const fixedDate = new Date("2026-04-30T10:00:00.000+08:00");
  const logger = createWorkerLogger({
    rootDir,
    now: () => fixedDate,
  });

  await logger.info("worker.boot.start", { queuePrefix: "devtrend" });
  await logger.warn("worker.boot.warn", { retrying: true });

  const logsDir = join(rootDir, "logs");
  const waitedFiles = await waitForLogFiles(logsDir);
  const logsDirStat = await stat(logsDir);
  assert.equal(logsDirStat.isDirectory(), true);

  assert.equal(waitedFiles.rotatedFiles.length, 1);
  assert.match(
    waitedFiles.rotatedFiles[0] ?? "",
    /^worker\.\d{4}-\d{2}-\d{2}\.1\.log$/,
  );
  assert.equal(waitedFiles.allFiles.includes("current.log"), true);

  const content = await waitForLogContent(
    join(logsDir, waitedFiles.rotatedFiles[0] ?? ""),
  );
  const lines = content
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as LoggedEntry);

  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.event, "worker.boot.start");
  assert.equal(lines[1]?.event, "worker.boot.warn");
  assert.equal(lines[0]?.context.queuePrefix, "devtrend");
  assert.equal(lines[1]?.level, "warn");
});

test("createWorkerLogger child merges base context", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "worker-logger-child-"));
  const fixedDate = new Date("2026-04-30T11:00:00.000+08:00");
  const logger = createWorkerLogger({
    rootDir,
    now: () => fixedDate,
  });

  await logger
    .child({ queue: "score", source: "stackoverflow" })
    .error("job.fail", {
      attemptsMade: 1,
      durationMs: 234,
    });

  const logsDir = join(rootDir, "logs");
  const waitedFiles = await waitForLogFiles(logsDir);
  assert.equal(waitedFiles.rotatedFiles.length, 1);
  assert.equal(waitedFiles.allFiles.includes("current.log"), true);

  const content = await waitForLogContent(
    join(logsDir, waitedFiles.rotatedFiles[0] ?? ""),
  );
  const parsed = JSON.parse(content.trim()) as LoggedEntry;

  assert.equal(parsed.event, "job.fail");
  assert.equal(parsed.level, "error");
  assert.equal(parsed.context.queue, "score");
  assert.equal(parsed.context.source, "stackoverflow");
  assert.equal(parsed.context.attemptsMade, 1);
  assert.equal(parsed.context.durationMs, 234);
});
