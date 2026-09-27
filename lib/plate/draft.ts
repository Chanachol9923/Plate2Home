import { isAsciiDigit } from './chars';
import { plateDisplay } from './canonical';
import { cleanChars } from './normalize';
import type { Plate, PlateInput, PlateType } from './types';

/**
 * What the plate-shaped input edits. People type the top line as they see it ("1กข"), so the
 * leading digit and the letters live in one `series` field and are split here.
 */
export interface PlateDraft {
  type: PlateType;
  series: string;
  number: string;
  provinceCode: string | null;
}

export const EMPTY_DRAFT: PlateDraft = { type: 'car', series: '', number: '', provinceCode: null };

export function draftToInput(draft: PlateDraft): PlateInput {
  const chars = cleanChars(draft.series);
  const allDigits = chars.length > 0 && chars.every(isAsciiDigit);
  // "70" on an "other" plate is a numeric bus/truck series, not a leading digit.
  const hasPrefix =
    chars.length > 1 && isAsciiDigit(chars[0]!) && !(draft.type === 'other' && allDigits);
  return {
    type: draft.type,
    prefixDigit: hasPrefix ? chars[0]! : null,
    letters: (hasPrefix ? chars.slice(1) : chars).join(''),
    number: draft.number,
    provinceCode: draft.provinceCode,
  };
}

export function plateToDraft(plate: Plate): PlateDraft {
  return {
    type: plate.type,
    series: `${plate.prefixDigit ?? ''}${plate.letters}`,
    number: plate.number,
    provinceCode: plate.provinceCode,
  };
}

/** Screen-reader friendly text: characters spaced so "กข" isn't read as a word. */
export function plateSpoken(plate: Plate, unknownChar: string): string {
  return [...plateDisplay(plate)]
    .map((c) => (c === '?' ? unknownChar : c))
    .join(' ')
    .replace(/\s{3,}/g, ', ');
}
