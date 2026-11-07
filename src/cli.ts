/**
 * Where a provider's CLI is, inside the dashboard container.
 *
 * The container has no package manager run at request time: a CLI gets there by being mounted
 * from the host (the plugin's compose file maps `~/.local/bin` to `/host-local-bin`, and the CLI's
 * own config directory beside it) or by being in the image. The first executable wins.
 */

import fs from 'fs';
import path from 'path';

export function findCli(name: string, extra: string[] = []): string | null {
  const home = process.env.HOME || '';
  const candidates = [
    ...extra,
    `/host-local-bin/${name}`,
    path.join(home, '.local', 'bin', name),
    ...String(process.env.PATH || '').split(':').filter(Boolean).map((d) => path.join(d, name)),
  ];
  for (const c of candidates) {
    try { fs.accessSync(c, fs.constants.X_OK); if (fs.statSync(c).isFile()) return c; } catch (_) { /* next */ }
  }
  return null;
}

/** A settings value that is set: not empty, not the CHANGE_ME placeholder. */
export function configured(v: unknown): string | null {
  const s = String(v == null ? '' : v).trim();
  return s && s !== 'CHANGE_ME' ? s : null;
}
