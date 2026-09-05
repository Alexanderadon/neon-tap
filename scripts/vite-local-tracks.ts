/**
 * Vite plugin for the dev-only local tracks (`public/local`, written by `npm run assets:local`).
 *
 * The folder lives inside `public/` so `npm run dev` serves it with no extra setup. Two things are
 * needed to keep it off production:
 *  - `vite build` copies the whole `public/` into `dist/` — after the bundle is written the plugin
 *    removes `dist/local`, so `dist/`, `.vercel/output` (built from it) and every deploy stay clean;
 *  - `vite preview` serves `dist/` — since `dist/local` is gone, the plugin serves `public/local`
 *    straight from disk (GET/HEAD, Range requests for audio).
 */
import { createReadStream, existsSync, rmSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, normalize, resolve, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export const LOCAL_DIR = 'local';

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

export function localTracksPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'neon-tap:local-tracks',
    configResolved(c) {
      config = c;
    },
    closeBundle() {
      if (config.command !== 'build') return;
      const dir = resolve(config.root, config.build.outDir, LOCAL_DIR);
      if (!existsSync(dir)) return;
      rmSync(dir, { recursive: true, force: true });
      config.logger.info(`[local-tracks] removed ${LOCAL_DIR}/ from ${config.build.outDir}/ (dev-only files never ship)`);
    },
    configurePreviewServer(server) {
      const root = resolve(config.publicDir, LOCAL_DIR);
      server.middlewares.use(`/${LOCAL_DIR}`, serveDir(root));
    },
  };
}

/** Minimal static handler: no directory listings, no path escapes, `Range` for audio seeking. */
export function serveDir(root: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = normalize(join(root, urlPath));
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
    const ext = /\.[^.]+$/.exec(file)?.[0].toLowerCase() ?? '';
    const size = statSync(file).size;
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
    let start = 0;
    let end = size - 1;
    if (range && size > 0) {
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : end;
      if (start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${size}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file, { start, end }).pipe(res);
  };
}
