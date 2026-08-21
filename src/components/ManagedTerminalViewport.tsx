"use client";

import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { t, useI18nSnapshot } from "@/lib/i18n";

/**
 * Attaches xterm to a lifecycle-owned PTY. Unlike InteractiveTerminal, this
 * component does not create or close the process; unmounting only detaches
 * this browser's stream and leaves the sign-in operation resumable.
 */
export function ManagedTerminalViewport({ terminalId, className, onExit }: {
  terminalId: string;
  className?: string;
  onExit?: () => void;
}) {
  useI18nSnapshot();
  const runtimeApis = useRuntimeAPIs();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let eventStream: { close(): void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let term: any = null;
    let fitAddon: any = null;
    let pendingInput = "";
    let inputInFlight = false;

    const flushInput = () => {
      if (inputInFlight || pendingInput === "") return;
      inputInFlight = true;
      const data = pendingInput;
      pendingInput = "";
      void runtimeApis.terminals.input({ terminalId, body: { data } }).catch(() => undefined).finally(() => {
        inputInFlight = false;
        if (pendingInput !== "") flushInput();
      });
    };

    void (async () => {
      const container = containerRef.current;
      if (!container) return;
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) return;

      term = new Terminal({
        cursorBlink: true,
        fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
        fontSize: 13,
        scrollback: 5000,
        theme: { background: "#050505" },
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      term.registerLinkProvider({
        provideLinks: (lineNumber: number, callback: (links: unknown[]) => void) => {
          const line = term?.buffer.active.getLine(lineNumber - 1)?.translateToString(true) ?? "";
          const links: Array<Record<string, unknown>> = [];
          const pattern = /https?:\/\/[^\s<>"']+/g;
          for (const match of line.matchAll(pattern)) {
            const start = match.index ?? 0;
            const link = match[0];
            links.push({
              range: {
                start: { x: start + 1, y: lineNumber },
                end: { x: start + link.length, y: lineNumber },
              },
              text: link,
              activate: () => {
                if (runtimeApis.native?.openExternal) {
                  void runtimeApis.native.openExternal({ url: link });
                } else {
                  window.open(link, "_blank", "noopener,noreferrer");
                }
              },
            });
          }
          callback(links);
        },
      });
      try { fitAddon.fit(); } catch { /* layout is not ready yet */ }

      term.onData((data: string) => {
        pendingInput += data;
        flushInput();
      });
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        void runtimeApis.terminals.resize({ terminalId, body: { cols, rows } }).catch(() => undefined);
      });

      eventStream = runtimeApis.terminals.openStream({ terminalId }, {
        onEvent: (event) => {
          if (!event || typeof event !== "object") return;
          const streamEvent = event as { kind?: string; payload?: unknown };
          if (streamEvent.kind === "data" && typeof streamEvent.payload === "string") {
            term?.write(streamEvent.payload);
          } else if (streamEvent.kind === "terminal.resync_required") {
            term?.write(`\r\n\x1b[33m${t("settings.agents.claudeAuth.terminalHistoryTruncated")}\x1b[0m\r\n`);
          } else if (streamEvent.kind === "exit") {
            term?.write(`\r\n\x1b[90m${t("settings.agents.claudeAuth.terminalExited")}\x1b[0m\r\n`);
            eventStream?.close();
            eventStream = null;
            onExit?.();
          }
        },
        onError: () => {
          term?.write(`\r\n\x1b[31m${t("settings.agents.claudeAuth.terminalDisconnected")}\x1b[0m\r\n`);
        },
      });

      resizeObserver = new ResizeObserver(() => {
        try { fitAddon?.fit(); } catch { /* transient layout state */ }
      });
      resizeObserver.observe(container);
      term.focus();
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      eventStream?.close();
      term?.dispose();
    };
  }, [onExit, runtimeApis.terminals, terminalId]);

  return <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
