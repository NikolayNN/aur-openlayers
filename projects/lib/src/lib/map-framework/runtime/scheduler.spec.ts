import { FlushScheduler } from './scheduler';

const flushMicrotasks = () =>
  new Promise<void>((resolve) => queueMicrotask(() => resolve()));

describe('FlushScheduler', () => {
  it('does not schedule a flush for empty batches', () => {
    const queueSpy = spyOn(globalThis, 'queueMicrotask').and.callThrough();
    const rafSpy = spyOn(window, 'requestAnimationFrame').and.callThrough();
    const scheduler = new FlushScheduler('microtask');

    scheduler.batch(() => {});

    expect(queueSpy).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('does not schedule RAF for empty batches with policy override', () => {
    const queueSpy = spyOn(globalThis, 'queueMicrotask').and.callThrough();
    const rafSpy = spyOn(window, 'requestAnimationFrame').and.callThrough();
    const scheduler = new FlushScheduler('microtask');

    scheduler.batch(() => {}, { policy: 'raf' });

    expect(queueSpy).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('coalesces multiple schedules into one flush', async () => {
    const scheduler = new FlushScheduler('microtask');
    let count = 0;
    const key = {};
    for (let i = 0; i < 100; i += 1) {
      scheduler.schedule(key, () => {
        count += 1;
      });
    }
    expect(count).toBe(0);
    await flushMicrotasks();
    expect(count).toBe(1);
  });

  it('defers flush until batch completes', async () => {
    const scheduler = new FlushScheduler('microtask');
    let count = 0;
    scheduler.batch(() => {
      scheduler.batch(() => {
        scheduler.schedule('a', () => {
          count += 1;
        });
      });
      scheduler.schedule('a', () => {
        count += 1;
      });
      expect(count).toBe(0);
    });
    await flushMicrotasks();
    expect(count).toBe(1);
  });

  it('flushes on requestAnimationFrame when policy is raf', () => {
    const callbacks: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    spyOn(window, 'cancelAnimationFrame').and.stub();

    const scheduler = new FlushScheduler('raf');
    let count = 0;
    scheduler.schedule('a', () => {
      count += 1;
    });

    expect(count).toBe(0);
    expect(callbacks.length).toBe(1);
    callbacks[0](0);
    expect(count).toBe(1);
  });

  it('honors batch policy overrides', () => {
    const queueSpy = spyOn(globalThis, 'queueMicrotask').and.callThrough();
    const rafCallbacks: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    spyOn(window, 'cancelAnimationFrame').and.stub();

    const scheduler = new FlushScheduler('microtask');
    scheduler.batch(
      () => {
        scheduler.schedule('a', () => undefined);
      },
      { policy: 'raf' },
    );

    expect(queueSpy).not.toHaveBeenCalled();
    expect(rafCallbacks.length).toBe(1);
  });
});
