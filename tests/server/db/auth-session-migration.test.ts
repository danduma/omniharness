import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabaseSchema } from "@/server/db";

const roots: string[] = [];

describe("auth session database migration", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("upgrades existing cookie sessions with provenance metadata without invalidating them", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "omni-auth-migration-"));
    roots.push(root);
    const client = createClient({ url: `file:${path.join(root, "sqlite.db")}` });
    const now = Date.now();
    await client.executeMultiple(`
      CREATE TABLE auth_sessions (
        id text PRIMARY KEY NOT NULL,
        token_hash text NOT NULL,
        label text,
        user_agent text,
        auth_method text NOT NULL,
        created_by_session_id text,
        last_seen_at integer NOT NULL,
        expires_at integer NOT NULL,
        absolute_expires_at integer NOT NULL,
        revoked_at integer,
        created_at integer NOT NULL,
        updated_at integer NOT NULL
      );
      INSERT INTO auth_sessions (
        id, token_hash, label, user_agent, auth_method, created_by_session_id,
        last_seen_at, expires_at, absolute_expires_at, revoked_at, created_at, updated_at
      ) VALUES (
        'legacy-session', 'legacy-hash', 'Existing browser', 'Existing UA',
        'password_login', NULL, ${now}, ${now + 10000}, ${now + 20000},
        NULL, ${now}, ${now}
      );
    `);

    await initializeDatabaseSchema(client);

    const columns = await client.execute("PRAGMA table_info(auth_sessions)");
    expect(columns.rows.map((row) => row.name)).toEqual(expect.arrayContaining([
      "transport",
      "bound_origin",
      "client_kind",
    ]));
    const migrated = await client.execute(
      "SELECT id, transport, bound_origin, client_kind, label, user_agent FROM auth_sessions WHERE id = 'legacy-session'",
    );
    expect(migrated.rows[0]).toMatchObject({
      id: "legacy-session",
      transport: "cookie",
      bound_origin: null,
      client_kind: "browser",
      label: "Existing browser",
      user_agent: "Existing UA",
    });
    await client.close();
  });
});
