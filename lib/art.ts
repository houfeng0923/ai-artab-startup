export interface Artwork {
  artistLink: string;
  attribution: string;
  attributionLink: string;
  creator: string;
  image: string;
  link: string;
  source: string;
  title: string;
}

interface RawArtwork {
  artist_link?: string;
  attribution?: string;
  attribution_link?: string;
  creator?: string;
  image?: string;
  link?: string;
  source?: string;
  title?: string;
}

const ARTAB_COLLECTION_URL = 'https://www.gstatic.com/culturalinstitute/tabext/imax_2_2.json';
const ART_CACHE_KEY = 'artab-collection-cache-v1';
const ART_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const fallbackArtworks: Artwork[] = [
  {
    title: 'House in Provence',
    creator: 'Paul Cézanne',
    attribution: 'Indianapolis Museum of Art at Newfields',
    artistLink: 'https://www.google.com/search?q=Paul+C%C3%A9zanne',
    attributionLink: 'https://artsandculture.google.com/partner/indianapolis-museum-of-art',
    link: 'https://artsandculture.google.com/asset/HAEcLEiIhDAl-Q',
    image:
      'https://artab-files.owenyoung.com/file/artab-files/images/ci/AL18g_SOomPViKjtyRqmNkz6q0TlNV9mlUZh4POOgN9RIONtdkdELdlPnetGiYLk4Ccepi7xuIeqqQ.webp',
    source: 'CI_TAB',
  },
  {
    title: 'Wild Apple Orchard',
    creator: 'Nyapanyapa Yunupingu',
    attribution: 'Art Gallery of New South Wales',
    artistLink: 'https://www.google.com/search?q=Nyapanyapa+Yunupingu',
    attributionLink: 'https://artsandculture.google.com/partner/art-gallery-of-new-south-wales',
    link: 'https://artsandculture.google.com/asset/xQGhkBUyBXAihw',
    image:
      'https://artab-files.owenyoung.com/file/artab-files/images/ci/AL18g_TmDAwvYmEAs63-kgNvq-n2llaVhtZdDCT56ubOc7krYbeACdHpHWn94PMfKR9z_G87O9gUQA.webp',
    source: 'CI_TAB',
  },
  {
    title: 'The camp, Sirius Cove',
    creator: 'Tom Roberts',
    attribution: 'Art Gallery of New South Wales',
    artistLink: 'https://www.google.com/search?q=Tom+Roberts',
    attributionLink: 'https://artsandculture.google.com/partner/art-gallery-of-new-south-wales',
    link: 'https://artsandculture.google.com/asset/vQEPldpJAUvS4Q',
    image:
      'https://artab-files.owenyoung.com/file/artab-files/images/ci/AL18g_QgraSbQjk2t48JQ9f79WSbw7J0R4bWg0jZVvWJzfd1gSah4g_ieRfTaxsFzo-b8aWp9M8Gowg.webp',
    source: 'CI_TAB',
  },
];

let inMemoryCollection: Artwork[] | null = null;
let loadPromise: Promise<Artwork[]> | null = null;

function composeArtsLink(link: string): string {
  if (!link) {
    return '#';
  }

  if (link.startsWith('http')) {
    return link;
  }

  return `https://artsandculture.google.com/${link}`;
}

function normalizeArtwork(item: RawArtwork): Artwork | null {
  if (!item.title || !item.image || !item.creator || !item.attribution || !item.link) {
    return null;
  }

  return {
    title: item.title,
    creator: item.creator,
    attribution: item.attribution,
    artistLink: composeArtsLink(item.artist_link ?? ''),
    attributionLink: composeArtsLink(item.attribution_link ?? ''),
    link: composeArtsLink(item.link),
    image: item.image,
    source: item.source ?? 'unknown',
  };
}

async function readCachedCollection(): Promise<Artwork[] | null> {
  const result = await browser.storage.local.get(ART_CACHE_KEY);
  const cache = result[ART_CACHE_KEY] as { fetchedAt?: number; items?: Artwork[] } | undefined;
  if (!cache?.fetchedAt || !Array.isArray(cache.items)) {
    return null;
  }

  if (Date.now() - cache.fetchedAt > ART_CACHE_MAX_AGE_MS) {
    return null;
  }

  return cache.items;
}

async function writeCachedCollection(items: Artwork[]): Promise<void> {
  await browser.storage.local.set({
    [ART_CACHE_KEY]: {
      fetchedAt: Date.now(),
      items,
    },
  });
}

async function fetchArtabCollection(): Promise<Artwork[]> {
  const response = await fetch(ARTAB_COLLECTION_URL, {
    method: 'GET',
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(`Failed to load Artab collection: ${response.status}`);
  }

  const payload = (await response.json()) as RawArtwork[];
  const items = payload.map(normalizeArtwork).filter((item): item is Artwork => Boolean(item));
  if (!items.length) {
    throw new Error('Artab collection is empty.');
  }

  return items;
}

export async function loadArtworkCollection(): Promise<Artwork[]> {
  if (inMemoryCollection?.length) {
    return inMemoryCollection;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const cached = await readCachedCollection();
    if (cached?.length) {
      inMemoryCollection = cached;
      return cached;
    }

    try {
      const items = await fetchArtabCollection();
      inMemoryCollection = items;
      await writeCachedCollection(items);
      return items;
    } catch (error) {
      console.error('Failed to fetch remote Artab collection, using fallback artworks.', error);
      inMemoryCollection = fallbackArtworks;
      return fallbackArtworks;
    }
  })();

  const collection = await loadPromise;
  loadPromise = null;
  return collection;
}
