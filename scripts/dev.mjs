#!/usr/bin/env node
/**
 * Start the local stack: site shell, editor API, and editor SPA.
 */
import { spawn } from "node:child_process";

const tasks = [
  { name: "site", workspace: "@r-a-i-t-h/tessera-site" },
  { name: "api", workspace: "@r-a-i-t-h/tessera-editor-api" },
  { name: "editor", workspace: "@r-a-i-t-h/tessera-editor" },
];

const children = [];
let shuttingDown = false;

function prefixStream(name, input, output) {
  let buffer = "";
  input.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      output.write(`[${name}] ${line}\n`);
    }
  });
  input.on("end", () => {
    if (buffer.length > 0) output.write(`[${name}] ${buffer}\n`);
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill(signal);
  }
}

function finished() {
  return children.every((child) => child.exitCode !== null || child.signalCode !== null);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const task of tasks) {
  const child = spawn("npm", ["run", "dev", "-w", task.workspace], {
    stdio: ["inherit", "pipe", "pipe"],
  });
  prefixStream(task.name, child.stdout, process.stdout);
  prefixStream(task.name, child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      if (finished()) {
        const interrupted = signal === "SIGINT" || signal === "SIGTERM";
        process.exit(interrupted ? 0 : code ?? 1);
      }
      return;
    }
    shutdown("SIGTERM");
    process.exit(code ?? 1);
  });
  children.push(child);
}
