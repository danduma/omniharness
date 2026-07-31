import fs from "node:fs";
import path from "node:path";

export class ElectronProfileDocumentStore {
  constructor(private readonly filePath: string) {}

  get() {
    try {
      return fs.readFileSync(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  set(value: string) {
    JSON.parse(value);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporaryPath, value, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporaryPath, this.filePath);
  }

  remove() {
    try {
      fs.unlinkSync(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
