/** Generates public/music/LICENSES.md from the asset registries (tracks.json, sfx.json, voice script). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface RawTrack {
  id: string;
  title: string;
  artist: string;
  sourceUrl: string;
  license: string;
  loops?: number;
}
interface SfxRegistry {
  packs: Record<string, { name: string; url: string; license: string }>;
  samples: Record<string, { pack: string; file: string; role: string }>;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sourceName = (url: string): string => (url.includes('freemusicarchive.org') ? 'Free Music Archive' : 'OpenGameArt');
const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];
const sfx = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'sfx.json'), 'utf8')) as SfxRegistry;
/** The tutorial's song — a CC0 track kept only for the tutorial (assets-src/tutorial.json). */
const tutorial = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tutorial.json'), 'utf8')) as RawTrack;

const md: string[] = [
  '# Asset licenses',
  '',
  '## Music',
  '',
  'Built-in tracks come from OpenGameArt.org (**CC0 1.0**, public domain dedication) and the Free Music Archive (**CC BY 4.0**).',
  'Files were trimmed to ≤ 150 s and loudness-normalised for the game (short loops repeated to reach 90–150 s); in play the song',
  'may run up to 1.2× faster on the later levels. Attribution is required by CC BY and given here (the author is also named on the',
  'track card); for CC0 it is listed out of respect for the authors.',
  '',
  '| File | Title | Author | Source | License |',
  '|---|---|---|---|---|',
  ...tracks.map((t) => `| \`${t.id}.mp3\` | ${t.title} | ${t.artist} | [${sourceName(t.sourceUrl)}](${t.sourceUrl}) | ${t.license} |`),
  `| \`tutorial.mp3\` | Apparatus Overlord (the tutorial song) | ${tutorial.artist} | [${sourceName(tutorial.sourceUrl)}](${tutorial.sourceUrl}) | ${tutorial.license} |`,
  '',
  '## Sound effects',
  '',
  'Samples from the **Kenney** CC0 packs, converted to MP3 and peak-normalised (`scripts/prepare-sfx.ts`).',
  '',
  '| Pack | License |',
  '|---|---|',
  ...Object.values(sfx.packs).map((p) => `| [${p.name}](${p.url}) | ${p.license} |`),
  '',
  '| File | Source | Used for |',
  '|---|---|---|',
  ...Object.entries(sfx.samples).map(([name, s]) => `| \`sfx/${name}.mp3\` | ${sfx.packs[s.pack].name} / \`${s.file}\` | ${s.role} |`),
  '',
  '## Voice',
  '',
  'Russian voice lines in `public/voice/<voice>/` were synthesised with Microsoft neural TTS voices',
  '**ru-RU-DmitryNeural** and **ru-RU-SvetlanaNeural** through the open-source `msedge-tts` client (`scripts/generate-voice.ts`),',
  'then silence-trimmed and loudness-normalised. The voices belong to Microsoft; the generated clips are used here',
  'in a non-commercial portfolio project. A Web Speech API fallback is used when the clips cannot be loaded.',
  '',
];
writeFileSync(join(ROOT, 'public', 'music', 'LICENSES.md'), md.join('\n'));
console.log('public/music/LICENSES.md written');
