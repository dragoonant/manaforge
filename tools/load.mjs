// Loads the engine half of index.html's script list into a Node vm context, so the tools and the
// page run the same files in the same order.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function scriptList(file = 'index.html') {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>|<!-- ui -->/g)].map(m => m[1] || '<!-- ui -->');
}
export function loadEngine() {
  const list = scriptList(); const cut = list.indexOf('<!-- ui -->');
  const ctx = { console, Math, JSON, Set, Map, Date, Object, Array, Error }; ctx.window = ctx; vm.createContext(ctx);
  for (const f of list.slice(0, cut)) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  ctx.MF.validate();
  return ctx.MF;
}
