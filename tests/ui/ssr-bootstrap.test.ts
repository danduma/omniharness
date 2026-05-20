import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("home SSR bootstrap", () => {
  it("builds and passes a server bootstrap payload into the client app", () => {
    const pageSource = readSource("src/app/page.tsx");
    const omniAppSource = readSource("src/ui/OmniApp.tsx");

    expect(pageSource).toContain("buildHomeBootstrap");
    expect(pageSource).toContain("<OmniApp bootstrap={bootstrap}");
    expect(omniAppSource).not.toContain('import { HomeApp } from "@/app/home/HomeApp"');
    expect(omniAppSource).toContain('import("@/app/home/HomeApp")');
    expect(omniAppSource).toContain("<HomeApp bootstrap={bootstrap}");
  });

  it("hydrates route and available initial queries before HomeApp subscribes to managers", () => {
    const homeSource = readSource("src/app/home/HomeApp.tsx");
    const queriesSource = readSource("src/app/home/useHomeQueries.ts");

    expect(homeSource).toContain("applyHomeBootstrap(bootstrap, false)");
    expect(homeSource.indexOf("applyHomeBootstrap(bootstrap, false)")).toBeLessThan(
      homeSource.indexOf("useManagerSelector(homeUiStateManager"),
    );
    expect(homeSource).toContain("initialEventState");
    expect(homeSource).toContain("initialQueries");
    expect(queriesSource).toContain('queryClient.setQueryData(["auth-session"], initialQueries.session)');
    expect(queriesSource).not.toContain('typeof window !== "undefined"');
  });

  it("keeps event snapshots and the slow worker catalog out of the blocking page SSR bootstrap", () => {
    const homeBootstrapSource = readSource("src/app/home/bootstrap.server.ts");
    const bootstrapSource = readSource("src/runtime/bootstrap.ts");

    expect(homeBootstrapSource).toContain("includeInitialData: false");
    expect(bootstrapSource).toContain("buildPersistedEventPayload");
    expect(bootstrapSource).toContain("includeInitialData = true");
    expect(bootstrapSource).not.toContain("agents/catalog");
    expect(bootstrapSource).not.toContain("buildRuntimeEnrichedEventPayload");
  });

  it("keeps worker stream route database work out of the module import and unauthenticated path", () => {
    const workerEntriesSource = readSource("src/runtime/http/routes/worker-entries.ts");
    const authGuardsSource = readSource("src/server/auth/guards.ts");
    const sessionStateSource = readSource("src/server/auth/session-state.ts");

    expect(workerEntriesSource).not.toContain('from "@/server/db"');
    expect(workerEntriesSource).not.toContain('from "@/server/db/schema"');
    expect(workerEntriesSource).toContain('import("@/server/db")');
    expect(authGuardsSource).not.toContain('import { getSessionFromRequest } from "@/server/auth/session"');
    expect(authGuardsSource.indexOf("!request.cookies.get(AUTH_SESSION_COOKIE)")).toBeLessThan(
      authGuardsSource.indexOf('import("@/server/auth/session")'),
    );
    expect(sessionStateSource).not.toContain('import { getSessionFromTokenValue');
    expect(sessionStateSource).toContain('import type { ActiveAuthSession } from "@/server/auth/session"');
    expect(sessionStateSource.indexOf("if (!cookie)")).toBeLessThan(
      sessionStateSource.indexOf('import("@/server/auth/session")'),
    );
  });
});
