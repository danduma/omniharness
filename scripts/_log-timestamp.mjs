#!/usr/bin/env node
// Reads stdin, writes each line to stdout prefixed with [YYYY-MM-DD HH:MM:SS].
// Used by remote-restart.ts to keep timestamped logs even after a daemon restart.

function pad(n, w = 2) { return String(n).padStart(w, "0"); }
function stamp() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) process.stdout.write("[" + stamp() + "] " + line + "\n");
});
process.stdin.on("end", () => {
  if (buf.length > 0) process.stdout.write("[" + stamp() + "] " + buf + "\n");
});
