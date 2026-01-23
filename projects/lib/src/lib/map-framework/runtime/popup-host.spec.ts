import { PopupHost } from './popup-host';

describe('PopupHost', () => {
  it('does not accept items when disabled', () => {
    const target = document.createElement('div');
    const host = new PopupHost({ enabled: false });
    host.mount(target);
    host.push([{ model: { id: '1' }, content: 'a' }]);

    expect(host.getItems()).toEqual([]);
    expect(target.querySelector('.mf-popup-host')).toBeNull();
  });

  it('applies sort before maxItems limit', () => {
    const host = new PopupHost({
      maxItems: 2,
      sort: (a, b) => String(a.content).localeCompare(String(b.content)),
    });
    host.push([
      { model: { id: '1' }, content: 'b' },
      { model: { id: '2' }, content: 'a' },
      { model: { id: '3' }, content: 'c' },
    ]);

    expect(host.getItems().map((item) => item.content)).toEqual(['a', 'b']);
  });

  it('deduplicates items with last-win strategy', () => {
    const host = new PopupHost();
    host.push([
      { model: { id: '1' }, content: 'first', dedupKey: 'key-1', source: 'feature' },
      { model: { id: '1' }, content: 'second', dedupKey: 'key-1', source: 'cluster' },
    ]);

    expect(host.getItems()).toEqual([
      { model: { id: '1' }, content: 'second', dedupKey: 'key-1', source: 'cluster' },
    ]);
  });

  it('supports set vs push', () => {
    const host = new PopupHost();
    host.push([{ model: { id: '1' }, content: 'first' }]);
    host.set([{ model: { id: '2' }, content: 'second' }]);

    expect(host.getItems().map((item) => item.content)).toEqual(['second']);
  });

  it('mounts, renders, and remounts', () => {
    const targetA = document.createElement('div');
    const targetB = document.createElement('div');
    const host = new PopupHost();
    host.mount(targetA);
    host.push([{ model: { id: '1' }, content: 'first' }]);

    expect(targetA.querySelectorAll('.mf-popup-item').length).toBe(1);

    host.clear();
    expect(targetA.querySelectorAll('.mf-popup-item').length).toBe(0);

    host.dispose();
    expect(targetA.querySelector('.mf-popup-host')).toBeNull();

    host.mount(targetB);
    host.push([{ model: { id: '2' }, content: 'second' }]);
    expect(targetB.querySelectorAll('.mf-popup-item').length).toBe(1);
  });

  it('limits DOM and supports close/remove', () => {
    const target = document.createElement('div');
    const host = new PopupHost({ maxItems: 1 });
    host.mount(target);
    host.push([
      { model: { id: '1' }, content: 'first', dedupKey: '1' },
      { model: { id: '2' }, content: 'second', dedupKey: '2' },
    ]);

    expect(target.querySelectorAll('.mf-popup-item').length).toBe(1);

    const close = target.querySelector<HTMLButtonElement>('[data-popup-close]');
    expect(close).not.toBeNull();
    close?.click();

    expect(target.querySelectorAll('.mf-popup-item').length).toBe(0);
  });
});
