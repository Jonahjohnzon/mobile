import { getToken, getCachedUser } from './screenOppsApi';
import { state } from '../store/state';

// Restores session from AsyncStorage on cold start and app-resume.
// Uses the cached user snapshot saved at login time rather than a
// live endpoint — cheap, works offline, and doesn't depend on a
// getUserDetail route that doesn't exist on mobile yet.
export async function checkAuth() {
  try {
    const token = await getToken();
    if (!token) {
      state.log = false;
      state.id = null;
      state.name = null;
      return;
    }
    const user = await getCachedUser();
    state.log = true;
    state.id = user?.id ?? null;
    state.name = user?.name ?? null;
  } catch (err) {
    console.error('Auth check failed:', err);
    state.log = false;
    state.id = null;
    state.name = null;
  }
}