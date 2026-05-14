import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("home SSR bootstrap", () => {
  it("builds and passes a server bootstrap payload into the client app", () => {
    const pageSource = readSource("src/app/page.tsx");

    expect(pageSource).toContain("buildHomeBootstrap");
    expect(pageSource).toContain("<HomeApp bootstrap={bootstrap}");
  });

  it("hydrates route, auth, settings, and event data before HomeApp subscribes to managers", () => {
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

  it("keeps the slow worker catalog out of the blocking SSR bootstrap", () => {
    const bootstrapSource = readSource("src/app/home/bootstrap.server.ts");

    expect(bootstrapSource).toContain("buildPersistedEventPayload");
    expect(bootstrapSource).not.toContain("agents/catalog");
    expect(bootstrapSource).not.toContain("buildRuntimeEnrichedEventPayload");
  });
});
