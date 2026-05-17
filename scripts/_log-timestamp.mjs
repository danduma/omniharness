#!/usr/bin/env node
// Reads stdin, writes each line to stdout prefixed with [YYYY-MM-DD HH:MM:SS].
// Used by remote-restart.ts to keep timestamped logs even after a daemon restart.
// Must not die under load or on transient stream errors — if this process exits,
// the upstream dev server gets EPIPE and stops emitting output until restart.

function pad(n, w = 2) { return String(n).padStart(w, "0"); }
function stamp() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

// Swallow signals/errors that would otherwise kill the process.
process.on("SIGPIPE", () => {});
process.on("uncaughtException", (err) => {
  try { process.stderr.write("[_log-timestamp] uncaught: " + err.stack + "\n"); } catch {}
});
process.on("unhandledRejection", (err) => {
  try { process.stderr.write("[_log-timestamp] unhandled: " + String(err) + "\n"); } catch {}
});
process.stdin.on("error", () => {});
process.stdout.on("error", () => {});

let buf = "";
let pendingTail = false;
let tailTimer = null;
process.stdin.setEncoding("utf8");

function writeLine(line) {
  // PTY output uses \r\n; strip trailing CR so logs are clean.
  if (line.length > 0 && line.charCodeAt(line.length - 1) === 13) {
    line = line.slice(0, -1);
  }
  try {
    process.stdout.write("[" + stamp() + "] " + line + "\n");
  } catch {
    // ignore — keep reading even if a single write fails
  }
}

function flushBuffered(force) {
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) writeLine(line);
  if (force && buf.length > 0) {
    writeLine(buf);
    buf = "";
  }
}

function scheduleTailFlush() {
  if (tailTimer) return;
  // Some programs emit prompts/progress without newlines. Flush partial
  // buffer if no newline arrives within 500ms so output isn't held hostage.
  tailTimer = setTimeout(() => {
    tailTimer = null;
    if (buf.length > 0) {
      writeLine(buf);
      buf = "";
    }
  }, 500);
}

process.stdin.on("data", (chunk) => {
  buf += chunk;
  if (buf.indexOf("\n") !== -1) {
    flushBuffered(false);
  } else if (buf.length > 0) {
    scheduleTailFlush();
  }
  if (buf.length > 1024 * 64) {
    // Don't accumulate unbounded — emit what we have as a partial line.
    writeLine(buf);
    buf = "";
  }
});

process.stdin.on("end", () => {
  if (tailTimer) { clearTimeout(tailTimer); tailTimer = null; }
  flushBuffered(true);
  process.exit(0);
});
