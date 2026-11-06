import { request, type FullConfig } from '@playwright/test';

/** Unlocks the passcode gate once and saves the cookie for every project. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/unlock', { data: { passcode: process.env.APP_PASSCODE } });
  if (res.status() !== 200) {
    throw new Error(`Gate setup failed (${res.status()}): running dev server uses a different APP_PASSCODE`);
  }
  await ctx.storageState({ path: 'tests/.auth/state.json' });
  await ctx.dispose();
}
