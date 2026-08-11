import { proxy } from 'valtio';

export const state = proxy({
  log: false,
  id: null,
  name: null,
});
