import { describe, expect, it } from 'vitest';
import { draftToInput, plateSpoken, plateToDraft } from './draft';
import { normalizePlate } from './normalize';

describe('draftToInput', () => {
  it('splits a leading digit off the series', () => {
    expect(
      draftToInput({ type: 'car', series: '1กข', number: '1234', provinceCode: 'TH-10' }),
    ).toEqual({
      type: 'car',
      prefixDigit: '1',
      letters: 'กข',
      number: '1234',
      provinceCode: 'TH-10',
    });
  });

  it('handles spaces and Thai digits in the series', () => {
    expect(
      draftToInput({ type: 'motorcycle', series: '๒ ก ข', number: '1', provinceCode: null }),
    ).toMatchObject({
      prefixDigit: '2',
      letters: 'กข',
    });
  });

  it('keeps a series without a digit as letters', () => {
    expect(
      draftToInput({ type: 'car', series: 'กข', number: '1', provinceCode: null }).prefixDigit,
    ).toBeNull();
  });

  it('keeps numeric bus/truck series on "other" plates as letters', () => {
    expect(
      draftToInput({ type: 'other', series: '70', number: '1234', provinceCode: null }),
    ).toMatchObject({
      prefixDigit: null,
      letters: '70',
    });
  });

  it('does not treat a lone digit as a prefix', () => {
    expect(
      draftToInput({ type: 'car', series: '1', number: '1', provinceCode: null }),
    ).toMatchObject({
      prefixDigit: null,
      letters: '1',
    });
  });

  it('round-trips through plateToDraft', () => {
    const plate = normalizePlate({
      type: 'car',
      prefixDigit: '1',
      letters: 'กข',
      number: '1234',
      provinceCode: 'TH-10',
    });
    expect(normalizePlate(draftToInput(plateToDraft(plate)))).toEqual(plate);
  });
});

describe('plateSpoken', () => {
  it('spaces characters and names unknown ones', () => {
    const plate = normalizePlate({ type: 'car', letters: 'ก?', number: '12' });
    expect(plateSpoken(plate, 'ไม่ทราบ')).toBe('ก ไม่ทราบ, 1 2');
  });
});
