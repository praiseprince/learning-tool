// Sets the sign-in PIN (and clears a lockout). Run on the Mac, in the project folder:
//   node scripts/pin.mjs            asks for the PIN
//   node scripts/pin.mjs --unlock   only clears a lockout after wrong guesses
// The PIN is stored as a scrypt hash in the database, never in the repository.
import {createInterface} from "node:readline/promises";
import {spawnSync} from "node:child_process";
const unlock = process.argv.includes("--unlock");
let pin = "";
if (!unlock) {
  const rl = createInterface({input: process.stdin, output: process.stdout});
  pin = (await rl.question("New PIN (4 to 12 digits): ")).trim();
  const again = (await rl.question("Again: ")).trim(); rl.close();
  if (pin !== again) { console.error("The two PINs differ. Nothing changed."); process.exit(1); }
  if (!/^\d{4,12}$/.test(pin)) { console.error("Use 4 to 12 digits. Nothing changed."); process.exit(1); }
}
const code = `const a=await import("./lib/auth.ts"); ${unlock ? "a.clearLock();" : "a.setPin(process.env.MG_PIN);"}`;
const r = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], {stdio: "inherit", env: {...process.env, MG_PIN: pin}});
if (r.status === 0) console.log(unlock ? "Sign-in unlocked." : "PIN saved. Devices that are already signed in stay signed in.");
process.exit(r.status ?? 1);
