import AsyncStorage from '@react-native-async-storage/async-storage';

// Free, no-API-key dataset mapping TMDB IDs -> AniList IDs (and other
// anime trackers). ~5-7MB, ~43k entries. We fetch it once, build a small
// lookup index, and cache the index (not the raw file) in AsyncStorage.
const MAPPING_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json';
const CACHE_KEY = 'anilistMappingIndex.v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // refresh weekly

let inMemoryIndex = null; // { "tv-26209": [{ anilist_id, season }], "movie-...": [...] }
let inFlightFetch = null;

/**
 * Heuristic: is this TMDB detail object anime?
 * Anime on TMDB is (almost) always: Animation genre (id 16) + Japanese
 * origin. Checking both avoids flagging Western/Korean animation as anime.
 */
export function isAnime(detail) {
  if (!detail) return false;
  const genreIds = (detail.genres ?? []).map((g) => g.id);
  const isAnimation = genreIds.includes(16);
  const isJapanese =
    detail.original_language === 'ja' ||
    (detail.origin_country ?? []).includes('JP');
  return isAnimation && isJapanese;
}

function buildIndex(rawList) {
  const index = {};
  for (const entry of rawList) {
    const tmdb = entry.themoviedb_id;
    if (!tmdb) continue;

    if (tmdb.tv != null) {
      const key = `tv-${tmdb.tv}`;
      if (!index[key]) index[key] = [];
      index[key].push({
        anilist_id: entry.anilist_id,
        // Which TMDB season number this AniList entry corresponds to.
        // Some entries won't have this (single-season shows) — treat as
        // season 1 in that case.
        season: entry.season?.tmdb ?? 1,
      });
    }
    if (tmdb.movie != null) {
      const key = `movie-${tmdb.movie}`;
      if (!index[key]) index[key] = [];
      index[key].push({ anilist_id: entry.anilist_id, season: null });
    }
  }
  return index;
}

async function loadIndex() {
  if (inMemoryIndex) return inMemoryIndex;
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = (async () => {
    try {
      const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
          inMemoryIndex = cached.index;
          return inMemoryIndex;
        }
      }
    } catch (err) {
      console.warn('[anilist] Failed to read cached mapping index:', err);
    }

    const res = await fetch(MAPPING_URL);
    if (!res.ok) throw new Error(`Mapping fetch failed: ${res.status}`);
    const rawList = await res.json();
    const index = buildIndex(rawList);

    inMemoryIndex = index;
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ fetchedAt: Date.now(), index })
      );
    } catch (err) {
      console.warn('[anilist] Failed to cache mapping index:', err);
    }

    return index;
  })();

  try {
    return await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}

/**
 * Resolve a TMDB id/type (+ optional season, for tv) to an AniList id.
 * Returns null if no mapping is found.
 *
 * @param {number|string} tmdbId
 * @param {'movie'|'tv'} type
 * @param {number|string} [season] - TMDB season number (tv only)
 */
export async function getAnilistId(tmdbId, type, season) {
  try {
    const index = await loadIndex();
    const key = `${type}-${tmdbId}`;
    const matches = index[key];
    if (!matches || matches.length === 0) return null;

    if (type === 'movie' || season == null) {
      return matches[0].anilist_id;
    }

    const seasonNum = Number(season);
    const seasonMatch = matches.find((m) => m.season === seasonNum);
    return (seasonMatch ?? matches[0]).anilist_id;
  } catch (err) {
    console.error('[anilist] getAnilistId failed:', err);
    return null;
  }
}