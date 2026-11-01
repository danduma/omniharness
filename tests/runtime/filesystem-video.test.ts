import fs from "fs";
import { Readable } from "stream";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { __resetNamedEventsForTests, __setStreamEpochForTests, getNamedEventsSince } from "@/server/events/named-events";
import { handleProjectFilesRequest } from "@/runtime/http/routes/filesystem";

vi.mock("@/server/auth/guards", () => ({ requireApiSession: vi.fn(async () => ({})) }));
vi.mock("@/server/fs/allowed-roots", () => ({
  findAllowedRootFor: (root: string) => root,
  getDefaultAllowedRoot: () => process.cwd(),
  describeAllowedRoots: () => [],
}));
beforeEach(() => {
  __resetNamedEventsForTests();
  __setStreamEpochForTests("video-test");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

function request(range?: string, file = "clip.mp4") {
  const query = new URLSearchParams({ root: process.cwd(), file, video: "1" });
  return new Request(`http://localhost/api/fs/files?${query}`, { headers: range ? { range } : {} });
}
function mockVideo() {
  vi.spyOn(fs, "realpathSync").mockImplementation((value) => String(value));
  vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true, size: 10 } as fs.Stats);
  return vi.spyOn(fs, "createReadStream").mockImplementation((_path, options) => {
    const { start = 0, end = 9 } = options as { start?: number; end?: number };
    return Readable.from([Buffer.from("0123456789").subarray(start, end + 1)]) as fs.ReadStream;
  });
}

test("serves video bytes without sending binary data through the text reader", async () => {
  mockVideo();
  const response = await handleProjectFilesRequest(request(), { surface: "test" });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("video/mp4");
  expect(response.headers.get("accept-ranges")).toBe("bytes");
  expect(await response.text()).toBe("0123456789");
});

test.each([["bytes=2-5", "2345", "bytes 2-5/10"], ["bytes=-3", "789", "bytes 7-9/10"], ["bytes=7-", "789", "bytes 7-9/10"]])("supports seeking with %s", async (range, body, contentRange) => {
  mockVideo();
  const response = await handleProjectFilesRequest(request(range), { surface: "test" });
  expect(response.status).toBe(206);
  expect(response.headers.get("content-range")).toBe(contentRange);
  expect(await response.text()).toBe(body);
});

test.each(["bytes=99-", "bytes=5-2", "bytes=-0", "invalid"])("rejects invalid range %s without streaming", async (range) => {
  const stream = mockVideo();
  const response = await handleProjectFilesRequest(request(range), { surface: "test" });
  expect(response.status).toBe(416);
  expect(response.headers.get("content-range")).toBe("bytes */10");
  expect(stream).not.toHaveBeenCalled();
});

test.each(["../outside.mp4", "index.html"])("rejects unsafe video path %s", async (file) => {
  const stream = mockVideo();
  const response = await handleProjectFilesRequest(request(undefined, file), { surface: "test" });
  expect(response.status).toBe(400);
  expect(stream).not.toHaveBeenCalled();
});

test("rejects symlinks outside the selected project", async () => {
  const stream = mockVideo();
  vi.mocked(fs.realpathSync).mockImplementation((value) => String(value).endsWith("clip.mp4") ? "/outside/clip.mp4" : String(value));
  const response = await handleProjectFilesRequest(request(), { surface: "test" });
  expect(response.status).toBe(400);
  expect(stream).not.toHaveBeenCalled();
});

test("download fallback uses an attachment disposition", async () => {
  mockVideo();
  const input = request();
  const response = await handleProjectFilesRequest(new Request(`${input.url}&download=1`), { surface: "test" });
  expect(response.headers.get("content-disposition")).toContain("attachment;");
  expect(await response.text()).toBe("0123456789");
});

test("read failures emit a named event and a stable surfaced error", async () => {
  mockVideo();
  await handleProjectFilesRequest(request(undefined, "index.html"), { surface: "test" });
  const events = getNamedEventsSince(0).events.map((entry) => entry.event);
  expect(events.some((event) => event.kind === "filesystem.video_read_failed")).toBe(true);
  expect(events.some((event) => event.kind === "error.surfaced" && event.code === "filesystem.video_read_failed")).toBe(true);
});
