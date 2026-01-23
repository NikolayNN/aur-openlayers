import {toOlFitOptions} from './fit-layer.utils';

describe('toOlFitOptions', () => {
  it('returns defaults when opts is undefined', () => {
    expect(toOlFitOptions()).toEqual({
      padding: [48, 48, 48, 48],
      duration: 500,
    });
  });

  it('uses default padding when padding is not provided', () => {
    expect(toOlFitOptions({ duration: 123 })).toEqual({
      padding: [48, 48, 48, 48],
      duration: 123,
    });
  });

  it('converts padding {all} to [t,r,b,l]', () => {
    expect(toOlFitOptions({ padding: { all: 10 } })).toEqual({
      padding: [10, 10, 10, 10],
      duration: 500,
    });
  });

  it('converts padding {vertical,horizontal} to [t,r,b,l]', () => {
    expect(toOlFitOptions({ padding: { vertical: 12, horizontal: 7 } })).toEqual({
      padding: [12, 7, 12, 7],
      duration: 500,
    });
  });

  it('converts padding {top,right,bottom,left} to [t,r,b,l]', () => {
    expect(
      toOlFitOptions({ padding: { top: 1, right: 2, bottom: 3, left: 4 } }),
    ).toEqual({
      padding: [1, 2, 3, 4],
      duration: 500,
    });
  });

  it('passes maxZoom when provided', () => {
    expect(toOlFitOptions({ maxZoom: 16 })).toEqual({
      padding: [48, 48, 48, 48],
      duration: 500,
      maxZoom: 16,
    });
  });

  it('does not include maxZoom when it is null/undefined', () => {
    expect(toOlFitOptions({ maxZoom: undefined })).toEqual({
      padding: [48, 48, 48, 48],
      duration: 500,
    });

    // as any to simulate a runtime null (TS type is number | undefined)
    expect(toOlFitOptions({ maxZoom: null } as any)).toEqual({
      padding: [48, 48, 48, 48],
      duration: 500,
    });
  });

  it('allows duration=0 (no animation)', () => {
    expect(toOlFitOptions({ duration: 0 })).toEqual({
      padding: [48, 48, 48, 48],
      duration: 0,
    });
  });
});
