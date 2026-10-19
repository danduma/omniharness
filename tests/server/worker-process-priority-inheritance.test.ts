import { fork } from "node:child_process";
import { getPriority } from "node:os";
import { once } from "node:events";
import { expect, it } from "vitest";
import { lowerWorkerProcessPriority } from "@/server/worker-process-priority";

it.skipIf(process.platform === "win32")("lowers a real worker and its tools without changing its parent", async () => {
  const parentPriority = getPriority(process.pid);
  const child = fork("-", [], { silent: true, execArgv: [] });
  try {
    child.stdin!.end(`
      process.once('message', async () => {
        const { getPriority } = await import('node:os');
        const { execFileSync } = await import('node:child_process');
        const descendant = execFileSync(process.execPath, ['-e',
          'import("node:os").then(os => process.stdout.write(String(os.getPriority(process.pid))))'
        ], { encoding: 'utf8' });
        process.send({ worker: getPriority(process.pid), descendant: Number(descendant) });
      });
    `);
    lowerWorkerProcessPriority(child.pid);
    const result = once(child, "message");
    child.send("inspect");
    const [priorities] = await result;
    expect(priorities.worker).toBeGreaterThanOrEqual(10);
    expect(priorities.descendant).toBe(priorities.worker);
    expect(getPriority(process.pid)).toBe(parentPriority);
  } finally {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
});
