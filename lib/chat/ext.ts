/** The lower-case extension of a file name, with the dot ("" if none). Works in the browser too. */
export const extname = (name: string) => { const m = /\.[^./\\]+$/.exec(name); return m ? m[0].toLowerCase() : ""; };
