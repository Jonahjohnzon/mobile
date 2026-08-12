import { getToken, getUserDetail } from './screenOppsApi';
import { state } from '../store/state';

// Mirrors the web Navbar's checkAuth. Called on cold start AND on
// app-resume-from-background (see App.js) since RN apps don't remount
// when backgrounded — a mount-only effect would miss a login/logout
// that happened while the app was away.
export async function checkAuth() {
  try {
    const token = await getToken();
    if (!token) {
      state.log = false;
      state.id = null;
      state.name = null;
      return;
    }
    const user = await getUserDetail();
    state.log = true;
    state.id = user?.user_id ?? user?._id ?? null;
    state.name = user?.user_name ?? user?.name ?? null;
  } catch (err) {
    console.error('Auth check failed:', err);
    state.log = false;
    state.id = null;
    state.name = null;
  }
}