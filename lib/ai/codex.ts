import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export async function codexJson<T extends z.ZodType>(schema: T, prompt: string): Promise<z.output<T>> {
  const directory = await mkdtemp(join(tmpdir(), "marginalia-"));
  try {
    await writeFile(join(directory, "schema.json"), JSON.stringify(z.toJSONSchema(schema)));
    await new Promise<void>((resolve, reject) => {
      const child = execFile("codex", [
        "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--skip-git-repo-check",
        "--sandbox", "read-only", "-c", 'features.shell_tool=false',
        "--output-schema", "schema.json", "--output-last-message", "answer.json", "-"
      ], { cwd: directory, timeout: 60000 }, error => {
        if (error) reject(new Error("Codex could not complete the request."));
        else resolve();
      });
      child.stdin?.on("error", reject);
      child.stdin?.end(prompt);
    });
    return schema.parse(JSON.parse(await readFile(join(directory, "answer.json"), "utf8")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
