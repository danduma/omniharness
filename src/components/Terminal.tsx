"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useQuery } from "@tanstack/react-query";
import { normalizeAppError, requestJson } from "@/lib/app-errors";

interface TerminalProps {
  agentName: string;
}

interface AgentTerminalPayload {
  currentText?: string;
  lastText?: string;
  outputLog?: string;
  displayText?: string;
}

export function Terminal({ agentName }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const renderedTextRef = useRef("");

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: { background: "#1e1e1e" },
      convertEol: true,
      fontSize: 12,
      scrollback: 100_000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    const handleResize = () => fitAddon.fit();
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });

    resizeObserver.observe(terminalRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, []);

  const { data, error } = useQuery({
    queryKey: ["agent", agentName],
    queryFn: async () => {
      return requestJson<AgentTerminalPayload>(`/api/agents/${agentName}`, undefined, {
        source: "Bridge",
        action: `Load terminal output for ${agentName}`,
      });
    },
    refetchInterval: 2000,
  });

  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !data) {
      return;
    }

    const text = data.displayText ?? data.outputLog ?? data.currentText ?? data.lastText ?? "";
    if (text !== renderedTextRef.current) {
      term.reset();
      if (text) {
        term.write(text);
      }
      renderedTextRef.current = text;
      term.scrollToBottom();
    }
  }, [data]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded">
      <div ref={terminalRef} className="h-full w-full overflow-hidden rounded" />
      {error ? (
        <div className="absolute inset-x-0 bottom-0 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {normalizeAppError(error).message}
        </div>
      ) : null}
    </div>
  );
}
