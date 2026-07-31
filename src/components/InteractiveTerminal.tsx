"use client";

import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { useRuntimeAPIs } from "@/runtime-api/provider";

interface InteractiveTerminalProps {
  /** Conversation (run) id whose working directory the shell opens in. */
  conversationId: string | null;
  className?: string;
}

/**
 * A real interactive terminal backed by a server-side pty.
 *
 * Output streams through the typed terminal API; keystrokes and
 * resizes are POSTed back (`/input`, `/resize`). The pty is created on mount
 * and killed (`DELETE`) on unmount. xterm touches `window`, so it is loaded
 * lazily inside the effect to stay SSR-safe.
 */
export function InteractiveTerminal({ conversationId, className }: InteractiveTerminalProps) {
  const runtimeApis = useRuntimeAPIs();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let terminalId: string | null = null;
    let eventStream: { close(): void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let term: any = null;
    let fitAddon: any = null;

    const post = (operation: "input" | "resize", body: unknown) => {
      if (!terminalId) {
        return Promise.resolve();
      }
      return runtimeApis.terminals[operation]({ terminalId, body }).catch(() => {
        // best-effort; the stream will surface a closed pty
      });
    };

    // Coalescing input pump: send the first keystroke immediately, and batch
    // anything typed during the in-flight round trip into the next POST. This
    // adds no artificial delay but collapses bursts (held keys, paste, fast
    // typing) from one POST per char into one POST per round trip.
    let pendingInput = "";
    let inputInFlight = false;
    const flushInput = () => {
      if (inputInFlight || pendingInput === "" || !terminalId) {
        return;
      }
      inputInFlight = true;
      const data = pendingInput;
      pendingInput = "";
      void post("input", { data }).finally(() => {
        inputInFlight = false;
        if (pendingInput !== "") {
          flushInput();
        }
      });
    };

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

      const created = await runtimeApis.terminals.create({
        conversationId,
        cols: term.cols,
        rows: term.rows,
      }).catch(() => null) as { terminalId?: string } | null;

      if (disposed || !created?.terminalId) {
        if (!created?.terminalId) {
          term?.write("\r\n\x1b[31mFailed to open terminal.\x1b[0m\r\n");
        }
        return;
      }
      terminalId = created.terminalId;
      const activeTerminalId = terminalId;

      term.onData((data: string) => {
        pendingInput += data;
        flushInput();
      });
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        void post("resize", { cols, rows });
      });

      eventStream = runtimeApis.terminals.openStream({ terminalId: activeTerminalId }, {
        onEvent: (event) => {
          if (!event || typeof event !== "object") {
            return;
          }
          const streamEvent = event as { kind?: string; payload?: unknown };
          if (streamEvent.kind === "data" && typeof streamEvent.payload === "string") {
            term?.write(streamEvent.payload);
          } else if (streamEvent.kind === "exit") {
            term?.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
            eventStream?.close();
            eventStream = null;
          }
        }
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
      eventStream?.close();
      if (terminalId) {
        void runtimeApis.terminals.close({ terminalId }).catch(() => {});
      }
      term?.dispose();
    };
  }, [conversationId, runtimeApis.terminals]);

  return <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
