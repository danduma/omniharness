import fs from "fs";
import { afterEach, expect, test, vi } from "vitest";
import { handleProjectFilesRequest } from "@/runtime/http/routes/filesystem";

vi.mock("@/server/auth/guards", () => ({ requireApiSession: vi.fn(async () => ({})) }));
vi.mock("@/server/fs/allowed-roots", () => ({
  findAllowedRootFor: (root: string) => root,
  getDefaultAllowedRoot: () => process.cwd(),
  describeAllowedRoots: () => [],
}));

afterEach(() => vi.restoreAllMocks());

test("HTML browser previews return the complete document with an isolated origin", async () => {
  vi.spyOn(fs, "realpathSync").mockImplementation((value) => String(value));
  vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true, size: 20 } as fs.Stats);
  vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("<h1>Preview</h1>"));
  const url = new URL("http://localhost/api/fs/files");
  url.search = new URLSearchParams({ root: process.cwd(), file: "demo.html", browser: "1" }).toString();
  const response = await handleProjectFilesRequest(new Request(url), { surface: "test" });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(response.headers.get("content-security-policy")).toContain("sandbox allow-scripts");
  expect(await response.text()).toBe("<h1>Preview</h1>");
});

test.each(["../outside.html", "demo.txt"])("rejects unsupported preview path %s", async (file) => {
  const query = new URLSearchParams({ root: process.cwd(), file, browser: "1" });
  const response = await handleProjectFilesRequest(new Request(`http://localhost/api/fs/files?${query}`), { surface: "test" });
  expect(response.status).toBe(400);
});

test("rejects HTML symlinks that escape the project root", async () => {
  const root = process.cwd();
  vi.spyOn(fs, "realpathSync").mockImplementation((value) => String(value).endsWith("linked.html") ? "/outside/secret.html" : String(value));
  const read = vi.spyOn(fs, "readFileSync");
  const query = new URLSearchParams({ root, file: "linked.html", browser: "1" });
  const response = await handleProjectFilesRequest(new Request(`http://localhost/api/fs/files?${query}`), { surface: "test" });
  expect(response.status).toBe(400);
  expect(read).not.toHaveBeenCalled();
});
