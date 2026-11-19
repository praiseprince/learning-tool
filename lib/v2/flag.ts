/** Server-side, opt-in release switch for the Atlas, Guide and Notebook. */
export function v2Enabled(): boolean {
  return process.env.MARGINALIA_V2 === "1";
}
