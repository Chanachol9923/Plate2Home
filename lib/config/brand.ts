/**
 * Product naming lives here and nowhere else, so the product can be renamed in one place.
 * Messages reference it through the `{brand}` placeholder.
 */
export const brand = {
  name: {
    th: 'ป้ายกลับบ้าน',
    en: 'Plate2Home',
  },
  /** Used where one locale-independent identifier is needed (manifest id, storage keys). */
  slug: 'plate2home',
  /** Credit line in the footer ("Plate2Home By AnnoyingDoggo"). */
  author: 'AnnoyingDoggo',
} as const;

export type BrandLocale = keyof typeof brand.name;
