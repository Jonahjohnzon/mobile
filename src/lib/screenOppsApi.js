import AsyncStorage from '@react-native-async-storage/async-storage';
import { state } from '../store/state';
import { ListServer } from '../constants/servers';
// The `api` client used elsewhere (TMDB calls) is base-URL'd to TMDB.
// Auth/history/wishlist hit your own backend, so this is a separate client.
const BASE_URL = process.env.EXPO_PUBLIC_SCREENOPPS_API_URL || 'https://screenopps.com';
const TOKEN_KEY = 'accessToken';

export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const setToken = (token) => AsyncStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);

async function request(path, { method = 'GET', body, needsAuth = true } = {}) {
  
  const headers = { 'Content-Type': 'application/json' };
  if (needsAuth) {
    const token = await getToken();
    if (!token) return null; // same early-return-when-signed-out pattern as the web version
    headers.accessToken = token;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export const pushHistory = (body) =>
  request('/api/pushhistory', { method: 'PUT', body }).catch((e) => console.log(e));

export const pushWishlist = async (body) => {
  state.wishload = true;
  try {
    const info = await request('/api/pushwishlist', { method: 'PUT', body });
    if (info?.alert) {
      state.publicMsg = info.message;
      state.alert = true;
      setTimeout(() => { state.alert = false; }, 10000);
      return false;
    }
    return true;
  } catch (e) {
    console.log(e);
    return false;
  } finally {
    state.wishload = false;
  }
};

export const deleteWish = (id) =>
  request('/api/deletewishlist', { method: 'DELETE', body: { item_id: id } }).catch((e) => {
    console.log(e);
    return null;
  });

export const getUserHistory = (page = 1) =>
  request(`/api/gethistory?page=${page}`).catch((e) => {
    console.log(e);
    return { data: [], totalPages: 1 };
  });

export const getUserWishlist = (page = 1) =>
  request(`/api/getwishlist?page=${page}`).catch((e) => {
    console.log(e);
    return { data: [], totalPages: 1 };
  });

export const getWishlistId = () =>
  request('/api/wishlistid').then((r) => r?.data).catch((e) => {
    console.log(e);
    return [];
  });


  
  export const fetchServerVideo = async ({ id, type, season, episode, server, includeMeta = true }) => {
        const qp = new URLSearchParams({
          Tmdb_Id: String(id ?? ''),
          Type: String(type ?? ''),
          Server: server,
          Meta: includeMeta ? 'true' : 'false',
        });
        if (type === 'tv') {
          qp.set('Season', String(season ?? '1'));
          qp.set('Episode', String(episode ?? '1'));
        }
        try {
          return await request(`/api/getvideo?${qp.toString()}`, { needsAuth: false });
        } catch (e) {
          console.log(`Server ${server} failed:`, e);
          return null;
        }
      };

// Auto-loop through every server for the *initial* load only, so the
// user isn't staring at a dead first server by default. Manual
// re-selection later never loops — see fetchServerVideo above.
export const getVideo = async ({ id, type, season, episode }, onServerAttempt) => {
  let cachedMeta = null;

  for (let i = 0; i < ListServer.length; i++) {
    const server = ListServer[i];
    onServerAttempt?.(server);

    const res = await fetchServerVideo({
      id, type, season, episode,
      server: server.id,
      includeMeta: i === 0,
    });

    if (i === 0 && res) {
      const { sources, diagnostics, ...meta } = res;
      cachedMeta = meta;
    }

    const workingSource = res?.sources?.find((s) => !!s.url);
    if (workingSource) {
      return {
        ...cachedMeta,
        url: workingSource.url,
        streamType: workingSource.type,
        quality: workingSource.quality,
        subtitles: res.subtitles ?? [],
        server: server.id,
      };
    }
  }

  return null;
};

export const login = (body) => request('/api/login', { method: 'POST', body, needsAuth: false });
export const signUp = (body) => request('/api/createuser', { method: 'POST', body, needsAuth: false });
export const logout = () => clearToken();