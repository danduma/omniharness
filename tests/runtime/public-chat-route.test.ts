import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { plans, publicApiRateLimits, runs, settings } from "@/server/db/schema";
import {
  handlePublicProjectChatRequest,
  handlePublicProjectChatsRequest,
  handlePublicChatRequest,
} from "@/runtime/http/routes/public-chat";

const { createConversation } = vi.hoisted(() => ({ createConversation: vi.fn() }));
vi.mock("@/server/conversations/create", () => ({ createConversation }));

const projectPath = "/tmp/public-api-project";
const otherProjectPath = "/tmp/other-project";
const request = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, {
  ...init,
  headers: { authorization: "Bearer public-test-key", "content-type": "application/json", ...init.headers },
});

describe("public chat API", () => {
  beforeEach(async () => {
    await db.delete(settings).where(inArray(settings.key, [
      "OMNIHARNESS_PUBLIC_API_KEY",
      "OMNIHARNESS_PUBLIC_API_PROJECTS",
      "OMNIHARNESS_PUBLIC_API_PROJECT_PATH",
    ]));
    process.env.OMNIHARNESS_PUBLIC_API_KEY = "public-test-key";
    process.env.OMNIHARNESS_PUBLIC_API_PROJECTS = JSON.stringify([{ id: "project", path: projectPath }]);
    await db.delete(publicApiRateLimits);
    createConversation.mockReset();
    createConversation.mockResolvedValue({ runId: "public-api-created" });
    await db.insert(plans).values({ id: "public-api-plan", path: "public-api-plan.md", status: "done", createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  });

  afterEach(async () => {
    await db.delete(runs).where(inArray(runs.id, ["aaaaaaaaaaaa", "public-api-other"]));
    await db.delete(publicApiRateLimits);
    await db.delete(settings).where(inArray(settings.key, [
      "OMNIHARNESS_PUBLIC_API_KEY",
      "OMNIHARNESS_PUBLIC_API_PROJECTS",
      "OMNIHARNESS_PUBLIC_API_PROJECT_PATH",
    ]));
    delete process.env.OMNIHARNESS_PUBLIC_API_KEY;
    delete process.env.OMNIHARNESS_PUBLIC_API_PROJECTS;
  });

  it("rejects requests without a valid bearer key", async () => {
    const response = await handlePublicProjectChatsRequest(new Request("http://localhost/api/public/v1/projects/project/chats"), { surface: "test", params: { projectId: "project" } });
    expect(response.status).toBe(401);
  });

  it("does not expose chats from another configured-project path", async () => {
    await db.insert(runs).values({ id: "public-api-other", planId: "public-api-plan", projectPath: otherProjectPath, status: "done", createdAt: new Date(), updatedAt: new Date() });
    const response = await handlePublicProjectChatRequest(request("/api/public/v1/projects/project/chats/public-api-other"), { surface: "test", params: { projectId: "project", chatId: "public-api-other" } });
    expect(response.status).toBe(404);
  });

  it("does not register a public delete endpoint", async () => {
    const { createOmniRuntimeHttpRegistry } = await import("@/runtime/http/routes");
    const response = await createOmniRuntimeHttpRegistry().handle(request("/api/public/v1/projects/project/chats/public-api-owned", { method: "DELETE" }), { surface: "test" });
    expect(response.status).toBe(404);
  });

  it("makes a public rename manual and publishes its new title revision", async () => {
    __resetNamedEventsForTests();
    await db.insert(runs).values({
      id: "aaaaaaaaaaaa",
      planId: "public-api-plan",
      projectPath,
      title: "Automatic title",
      titleOwnership: "automatic",
      titleSource: "initial",
      titleRevision: 3,
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await handlePublicProjectChatRequest(
      request("/api/public/v1/projects/project/chats/aaaaaaaaaaaa", {
        method: "PATCH",
        body: JSON.stringify({ title: "Chosen by a person" }),
      }),
      { surface: "test", params: { projectId: "project", chatId: "aaaaaaaaaaaa" } },
    );

    expect(response.status).toBe(200);
    expect(await db.select().from(runs).where(eq(runs.id, "aaaaaaaaaaaa")).get()).toMatchObject({
      title: "Chosen by a person",
      titleOwnership: "manual",
      titleSource: "manual",
      titleRevision: 4,
    });
    expect(getNamedEventsSince(0, { runId: "aaaaaaaaaaaa" }).events).toContainEqual(expect.objectContaining({
      event: expect.objectContaining({
        kind: "conversation.title_updated",
        source: "public_api",
        revision: 4,
      }),
    }));
  });

  it("rate limits chat creation per project", async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await handlePublicProjectChatsRequest(request("/api/public/v1/projects/project/chats", { method: "POST", body: JSON.stringify({ message: `message ${index}` }) }), { surface: "test", params: { projectId: "project" } });
      expect(response.status).toBe(202);
    }
    const response = await handlePublicProjectChatsRequest(request("/api/public/v1/projects/project/chats", { method: "POST", body: JSON.stringify({ message: "limited" }) }), { surface: "test", params: { projectId: "project" } });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("shares the public work limit with the legacy chat-create endpoint", async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await handlePublicProjectChatsRequest(request("/api/public/v1/projects/project/chats", {
        method: "POST",
        body: JSON.stringify({ message: `message ${index}` }),
      }), { surface: "test", params: { projectId: "project" } });
      expect(response.status).toBe(202);
    }

    const response = await handlePublicChatRequest(request("/api/public/v1/chat", {
      method: "POST",
      body: JSON.stringify({ message: "bypasses the project route" }),
    }), { surface: "test" });

    expect(response.status).toBe(429);
    expect(createConversation).toHaveBeenCalledTimes(10);
  });
});
