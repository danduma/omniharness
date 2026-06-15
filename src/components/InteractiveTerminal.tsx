"use client";

import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

interface InteractiveTerminalProps {
  /** Conversation (run) id whose working directory the shell opens in. */
  conversationId: string | null;
  className?: string;
}

/**
 * A real interactive terminal backed by a server-side pty.
 *
 * Output streams in over SSE (`/api/terminals/:id/stream`); keystrokes and
 * resizes are POSTed back (`/input`, `/resize`). The pty is created on mount
 * and killed (`DELETE`) on unmount. xterm touches `window`, so it is loaded
 * lazily inside the effect to stay SSR-safe.
 */
export function InteractiveTerminal({ conversationId, className }: InteractiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let terminalId: string | null = null;
    let eventSource: EventSource | null = null;
    let resizeObserver: ResizeObserver | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fitAddon: any = null;

    const post = (path: string, body: unknown) =>
      fetch(`/api/terminals/${terminalId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {
        // best-effort; the stream will surface a closed pty
      });

    (async () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) {
        return;
      }

      term = new Terminal({
        cursorBlink: true,
        fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
        fontSize: 13,
        scrollback: 5000,
        theme: { background: "#000000" },
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      try {
        fitAddon.fit();
      } catch {
        // container not laid out yet
      }

      const created = await fetch("/api/terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, cols: term.cols, rows: term.rows }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      if (disposed || !created?.terminalId) {
        if (!created?.terminalId) {
          term?.write("\r\n\x1b[31mFailed to open terminal.\x1b[0m\r\n");
        }
        return;
      }
      terminalId = created.terminalId;

      term.onData((data: string) => {
        void post("/input", { data });
      });
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        void post("/resize", { cols, rows });
      });

      eventSource = new EventSource(`/api/terminals/${terminalId}/stream`);
      eventSource.addEventListener("data", (event) => {
        try {
          term?.write(JSON.parse((event as MessageEvent).data));
        } catch {
          // malformed frame; skip
        }
      });
      eventSource.addEventListener("exit", () => {
        term?.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
        eventSource?.close();
        eventSource = null;
      });

      resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon?.fit();
        } catch {
          // ignore transient layout errors
        }
      });
      resizeObserver.observe(container);
      term.focus();
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      eventSource?.close();
      if (terminalId) {
        fetch(`/api/terminals/${terminalId}`, {
          method: "DELETE",
          credentials: "include",
          keepalive: true,
        }).catch(() => {});
      }
      term?.dispose();
    };
  }, [conversationId]);

  return <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
