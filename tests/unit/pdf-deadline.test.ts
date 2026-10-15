import { describe, expect, it } from 'vitest';
import { withDeadline } from '@/lib/pdf/browser';

describe('withDeadline', () => {
  it('rejects with a TimeoutError after the deadline', async () => {
    const never = new Promise<string>(() => {});
    await expect(withDeadline(never, 20)).rejects.toMatchObject({ name: 'TimeoutError' });
  });
  it('resolves when the promise wins', async () => {
    await expect(withDeadline(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });
});
