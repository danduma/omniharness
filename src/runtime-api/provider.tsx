"use client";

import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";
import type { RuntimeAPIs } from "./types";
import { createWebRuntimeAPIs } from "./web";

const RuntimeApiContext = createContext<RuntimeAPIs | null>(null);

export function RuntimeApiProvider({
  apis,
  children,
}: PropsWithChildren<{ apis: RuntimeAPIs }>) {
  return (
    <RuntimeApiContext.Provider value={apis}>
      {children}
    </RuntimeApiContext.Provider>
  );
}

export function useRuntimeAPIs() {
  const apis = useContext(RuntimeApiContext);
  if (!apis) {
    throw new Error("Runtime APIs are not available in this renderer tree.");
  }
  return apis;
}

export function createDefaultWebRuntimeAPIs() {
  return createWebRuntimeAPIs();
}
