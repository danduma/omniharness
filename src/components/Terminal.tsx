"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useQuery } from "@tanstack/react-query";

interface TerminalProps {
  agentName: string;
}

export function Terminal({ agentName }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const lastTextLengthRef = useRef(0);

  useEffect(() => {
    if (!terminalRef.current) return;
    
    const term = new XTerm({
      theme: { background: "#1e1e1e" },
      convertEol: true,
      fontSize: 12,
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

  useQuery({
    queryKey: ["agent", agentName],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentName}`);
      if (!res.ok) return null;
      const data = await res.json();
      
      const term = xtermRef.current;
      if (term && data) {
        // Simple append logic based on length
        const text = data.currentText || data.lastText || "";
        if (text.length > lastTextLengthRef.current) {
          const newText = text.slice(lastTextLengthRef.current);
          term.write(newText);
          lastTextLengthRef.current = text.length;
        } else if (text.length < lastTextLengthRef.current) {
          // If text shrank (e.g. new prompt started), reset
          term.clear();
          term.write(text);
          lastTextLengthRef.current = text.length;
        }
      }
      return data;
    },
    refetchInterval: 2000,
  });

  return <div ref={terminalRef} className="h-full w-full overflow-hidden rounded" />;
}
