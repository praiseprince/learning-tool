// What can be shared in the chat. Pure, so the composer can check files before uploading them.
import {extname} from "./ext.ts";
export const MAX_FILES = 6, MAX_BYTES = 20 * 1024 * 1024;
const IMAGE = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const DOC = [".pdf", ".docx", ".doc", ".rtf", ".odt"];
const TEXT = [".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml", ".tex", ".bib", ".srt", ".vtt", ".ipynb",
  ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".c", ".h", ".cpp", ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".r", ".m", ".sql", ".sh", ".html", ".css", ".lua", ".hs", ".scala"];
export const ACCEPT = [...IMAGE, ...DOC, ...TEXT];
/** What the file input offers. */
export const ACCEPT_ATTR = ["image/png", "image/jpeg", "image/webp", "image/gif", ...DOC, ...TEXT].join(",");

export type Shared = {name: string; stored: string; size: number; type: "image" | "doc" | "text"; text?: string};
export const kindOf = (name: string): Shared["type"] | null => { const e = extname(name); return IMAGE.includes(e) ? "image" : DOC.includes(e) ? "doc" : TEXT.includes(e) ? "text" : null; };
/** Why a file cannot be shared, or null when it can. Mirrored in the composer so most problems never reach the server. */
export function refuse(name: string, size: number): string | null {
  if (!kindOf(name)) return `${name}: this type isn't supported. Share images, PDF, Word, text, data or code files.`;
  if (size > MAX_BYTES) return `${name} is over 20 MB.`;
  if (size === 0) return `${name} is empty.`;
  return null;
}
export const sizeLabel = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
