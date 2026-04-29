import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "@devtrend/config";
import { collectLiveSourcePayloads } from "../collectors/index.js";
import { sourceCommands } from "../command-registry.js";

async function main() {
  const config = loadConfig();
  const outputDir = resolve(process.cwd(), "docs/reports/contract-audit");
  await mkdir(outputDir, { recursive: true });

  const payloads = await collectLiveSourcePayloads(
    config.OPENCLI_BIN,
    config.OPENCLI_TIMEOUT_MS,
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    commands: sourceCommands,
    samples: payloads.map((payload) => ({
      source: payload.source,
      commandName: payload.commandName,
      argv: payload.argv,
      status: payload.status,
      startedAt: payload.startedAt,
      finishedAt: payload.finishedAt,
      latencyMs: payload.latencyMs,
      errorText: payload.errorText,
      helpOutput: payload.helpOutput,
      payload: payload.payload,
    })),
  };

  const filePath = resolve(outputDir, "latest.json");
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  process.stdout.write(`${filePath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
