// Assembles what the Mac app carries inside it, in desktop/dist/:
//   server/  the standalone Next server, its static files, and the few files read at runtime (prompts, the tunnel guard,
//            the Firecrawl reader and the Firecrawl Local binary)
//   node/    the official Node.js runtime of the same version that built the server (checked against its SHA-256),
//            so the native SQLite module always matches and nothing depends on Homebrew or this folder.
// Run with `npm run app`, which then lets Tauri package the app and the disk image.
import {execFileSync} from "node:child_process";
import {cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, chmodSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {pipeline} from "node:stream/promises";
import {Readable} from "node:stream";

const root = join(dirname(fileURLToPath(import.meta.url)), ".."), dist = join(root, "desktop", "dist"), cache = join(root, "desktop", ".cache");
const step = m => console.log(`\n▸ ${m}`);

step("Building the standalone server");
execFileSync("npx", ["next", "build"], {cwd: root, stdio: "inherit", env: {...process.env, MARGINALIA_STANDALONE: "1"}});

step("Assembling desktop/dist/server");
rmSync(dist, {recursive: true, force: true});
const server = join(dist, "server");
cpSync(join(root, ".next", "standalone"), server, {recursive: true, verbatimSymlinks: false, dereference: true});
cpSync(join(root, ".next", "static"), join(server, ".next", "static"), {recursive: true});
cpSync(join(root, "public"), join(server, "public"), {recursive: true});
cpSync(join(root, "prompts"), join(server, "prompts"), {recursive: true});
mkdirSync(join(server, "scripts"), {recursive: true}); cpSync(join(root, "scripts", "guard.mjs"), join(server, "scripts", "guard.mjs"));
mkdirSync(join(server, "lib", "agent"), {recursive: true});
for (const f of ["firecrawl.ts", "firecrawl-mcp.ts"]) cpSync(join(root, "lib", "agent", f), join(server, "lib", "agent", f));
const fc = join(root, ".tools", "bin", "firecrawl-local");
if (existsSync(fc)) { mkdirSync(join(server, ".tools", "bin"), {recursive: true}); cpSync(fc, join(server, ".tools", "bin", "firecrawl-local")); }
else console.warn("  Firecrawl Local is not built (.tools/bin); the app will use the engines' own web search.");
// the app bundle cannot carry symlinks (Turbopack aliases native modules as .next/node_modules/<name>-<hash> links):
// replace each one with a real copy of what it points to
for (const l of execFileSync("find", [server, "-type", "l"]).toString().trim().split("\n").filter(Boolean)) {
  const target = realpathSync(l); rmSync(l, {force: true}); cpSync(target, l, {recursive: true, dereference: true});
}
if (execFileSync("find", [server, "-type", "l"]).toString().trim()) throw Error("Symlinks are left in the server bundle.");
// nothing from a developer's machine goes in: no database, workspaces or env files
for (const p of ["data", ".env", ".env.local"]) rmSync(join(server, p), {recursive: true, force: true});
if (!existsSync(join(server, "server.js"))) throw Error("The standalone build has no server.js.");
const sqliteNative = execFileSync("find", [join(server, "node_modules", "better-sqlite3"), "-name", "*.node"]).toString().trim();
if (!sqliteNative) throw Error("better-sqlite3's native module is missing from the standalone build.");

step(`Fetching Node.js ${process.version} (darwin-${process.arch})`);
const name = `node-${process.version}-darwin-${process.arch}`, tar = join(cache, `${name}.tar.gz`), base = `https://nodejs.org/dist/${process.version}`;
mkdirSync(cache, {recursive: true});
if (!existsSync(tar)) {
  const r = await fetch(`${base}/${name}.tar.gz`); if (!r.ok) throw Error(`Download failed: ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(tar + ".part")); execFileSync("mv", [tar + ".part", tar]);
}
const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text(), want = sums.split("\n").find(l => l.endsWith(`  ${name}.tar.gz`))?.split(/\s+/)[0];
const got = createHash("sha256").update(readFileSync(tar)).digest("hex");
if (!want || want !== got) { rmSync(tar, {force: true}); throw Error(`Node.js checksum mismatch (want ${want}, got ${got}).`); }
console.log(`  checksum ok (${got.slice(0, 16)}…)`);
const node = join(dist, "node", "bin"); mkdirSync(node, {recursive: true});
execFileSync("tar", ["-xzf", tar, "-C", node, "--strip-components", "2", `${name}/bin/node`]); chmodSync(join(node, "node"), 0o755);
const v = execFileSync(join(node, "node"), ["-e", "require(process.argv[1]); console.log(process.version)", join(server, "node_modules", "better-sqlite3")]).toString().trim();
console.log(`  bundled ${v}; it loads the SQLite module`);
console.log(`\n✓ desktop/dist is ready (${execFileSync("du", ["-sh", dist]).toString().split("\t")[0]})`);
