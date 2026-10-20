/**
 * One-off scraper: Simply Fitness (ES) exercise guides -> prisma/seed-data/simplyfitness.json
 * Run: pnpm --filter @routine-tracker/api prisma:scrape-exercises
 * NOTE: regenerating the JSON resets imageUrl to the Simply Fitness CDN; rerun
 * prisma:upload-exercise-images afterwards so exercises use Cloudinary URLs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type HTMLElement } from 'node-html-parser';

const ORIGIN = 'https://www.simplyfitness.com';
const SOURCE = `${ORIGIN}/es/pages/workout-exercise-guides`;
const CATEGORIES = ['abdominals', 'back', 'biceps', 'calves', 'chest', 'legs', 'shoulders', 'triceps'];
const USER_AGENT =
  'routine-tracker-personal-scraper/1.0 (personal, non-commercial use; sequential requests)';
const DELAY_MS = 1000;

interface ScrapedExercise {
  slug: string;
  name: string;
  categories: string[];
  startPosition: string;
  execution: string;
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  imageUrl: string | null;
  sourceUrl: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let consecutiveFailures = 0;

async function fetchHtml(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await sleep(DELAY_MS);
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      consecutiveFailures = 0;
      return await res.text();
    } catch (err) {
      console.warn(`  attempt ${attempt} failed for ${url}: ${(err as Error).message}`);
    }
  }
  consecutiveFailures++;
  if (consecutiveFailures >= 3) {
    throw new Error('Aborting: 3 consecutive URLs failed');
  }
  throw new Error(`Failed to fetch ${url}`);
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function categorySlugs(html: string): string[] {
  const root = parse(html);
  const links = root.querySelectorAll('main.exercise-section ul.exo-ol a');
  const slugs: string[] = [];
  for (const a of links) {
    const m = /^\/es\/pages\/([a-z0-9-]+)$/.exec(a.getAttribute('href')?.trim() ?? '');
    if (m && !slugs.includes(m[1])) slugs.push(m[1]);
  }
  return slugs;
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((s) => clean(s).toLowerCase())
    .filter(Boolean);
}

function parseExercise(html: string, slug: string, category: string): ScrapedExercise {
  // Some pages ship malformed markup (e.g. "</a>/span>") that swallows the rest of the DOM.
  const root = parse(html.replace(/<\/a>\/span>/g, '</a></span>'));
  const name = clean(root.querySelector('h1.exo-h1')?.text ?? '');
  const img = root.querySelector('h1.exo-h1')?.parentNode?.parentNode?.querySelector('img');
  const imageUrl = img?.getAttribute('src') ?? null;

  const sections = new Map<string, HTMLElement[]>();
  for (const block of root.querySelectorAll('.exo-info > div')) {
    let current: string | null = null;
    for (const el of block.childNodes) {
      if (!('tagName' in el)) continue;
      const node = el as HTMLElement;
      if (node.tagName === 'H3') {
        current = clean(node.text);
        sections.set(current, []);
      } else if (current) {
        sections.get(current)!.push(node);
      }
    }
  }

  const textLines = (nodes: HTMLElement[] = []): string[] =>
    nodes.flatMap((n) =>
      n.tagName === 'UL' || n.tagName === 'OL'
        ? n.querySelectorAll('li').map((li) => clean(li.text))
        : [clean(n.text)],
    ).filter(Boolean);
  const spanList = (key: string) => splitList((sections.get(key) ?? []).map((n) => n.text).join(','));

  return {
    slug,
    name,
    categories: [category],
    startPosition: textLines(sections.get('Posición inicial')).join('\n'),
    execution: textLines(sections.get('Ejecución')).join('\n'),
    equipment: spanList('Equipo Necesario'),
    primaryMuscles: spanList('Músculos principales'),
    secondaryMuscles: spanList('Músculos secundarios'),
    imageUrl,
    sourceUrl: `${ORIGIN}/es/pages/${slug}`,
  };
}

const MIN_EXERCISES = 100;

// Fail before writing so a broken scrape never overwrites a good snapshot.
function validate(exercises: ScrapedExercise[]) {
  if (exercises.length < MIN_EXERCISES) {
    throw new Error(`Aborting: only ${exercises.length} exercises scraped (expected >= ${MIN_EXERCISES})`);
  }
  const problems: string[] = [];
  for (const ex of exercises) {
    for (const field of ['name', 'startPosition', 'execution'] as const) {
      if (!ex[field]) problems.push(`${ex.slug}: empty ${field}`);
    }
    if (ex.primaryMuscles.length === 0) problems.push(`${ex.slug}: empty primaryMuscles`);
  }
  if (problems.length > 0) {
    throw new Error(`Aborting: invalid scrape output, not writing file:\n${problems.join('\n')}`);
  }
}

async function main() {
  const bySlug = new Map<string, ScrapedExercise>();
  const order: { slug: string; category: string }[] = [];

  for (const category of CATEGORIES) {
    const html = await fetchHtml(`${ORIGIN}/es/pages/${category}-exercise-guides`);
    const slugs = categorySlugs(html);
    console.log(`${category}: ${slugs.length} exercises`);
    if (slugs.length === 0) throw new Error(`Aborting: category "${category}" yielded 0 links; layout may have changed`);
    for (const slug of slugs) order.push({ slug, category });
  }

  const seen = new Set<string>();
  const firstCategory = new Map<string, string[]>();
  for (const { slug, category } of order) {
    firstCategory.set(slug, [...(firstCategory.get(slug) ?? []), category]);
  }

  let i = 0;
  for (const { slug, category } of order) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    i++;
    try {
      const html = await fetchHtml(`${ORIGIN}/es/pages/${slug}`);
      const ex = parseExercise(html, slug, category);
      ex.categories = firstCategory.get(slug)!;
      bySlug.set(slug, ex);
      console.log(`[${i}/${firstCategory.size}] ${slug}`);
    } catch (err) {
      console.error(`[${i}] skipped ${slug}: ${(err as Error).message}`);
    }
  }

  const exercises = [...bySlug.values()];
  validate(exercises);
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-data');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'simplyfitness.json'),
    JSON.stringify({ meta: { source: SOURCE, scrapedAt: new Date().toISOString(), count: exercises.length }, exercises }, null, 2) + '\n',
  );
  console.log(`Wrote ${exercises.length} exercises`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
