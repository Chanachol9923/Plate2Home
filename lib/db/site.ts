import 'server-only';
import { toDbError } from './errors';
import { serviceClient } from './server';

export interface SiteSettings {
  mode: 'active' | 'dormant';
  bannerTh: string | null;
  bannerEn: string | null;
}

const TTL_MS = 30_000;
let cache: { at: number; value: SiteSettings } | undefined;

/** Site mode and banner, cached briefly per server instance (admin changes apply within 30 s). */
export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { data, error } = await serviceClient()
    .from('site_settings')
    .select('mode, banner_th, banner_en')
    .eq('id', 1)
    .single();
  if (error) throw toDbError('site_settings', error);
  const value: SiteSettings = {
    mode: data.mode,
    bannerTh: data.banner_th,
    bannerEn: data.banner_en,
  };
  cache = { at: Date.now(), value };
  return value;
}
