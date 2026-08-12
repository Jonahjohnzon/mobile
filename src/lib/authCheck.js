import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserDetail } from './screenOppsApi';
import { state } from '../store/state';

// Mirrors the web Navbar's checkAuth, but reads a stored token instead of
// a cookie. Called on cold start AND on app-resume-from-background, since
// RN apps don't remount when backgrounded — a mount-only effect would miss
// a login/logout that happened while the app was away.
export async function checkAuth() {
  try {
    const token = await AsyncStorage.getItem('authToken'); // adjust key if your login flow uses a different one
    if (!token) {
      state.log = false;
      state.id = null;
      state.name = null;
      return;
    }
    const user = await getUserDetail();
    state.log = true;
    state.id = user?.user_id;
    state.name = user?.user_name;
  } catch (err) {
    console.error('Auth check failed:', err);
    state.log = false;
    state.id = null;
    state.name = null;
  }
}