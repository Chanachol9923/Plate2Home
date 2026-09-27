/**
 * Content-Security-Policy for HTML responses. Built per request in proxy.ts with a fresh nonce.
 * Every origin allowed here must be justified in docs/security-checklist.md.
 */

const TURNSTILE = 'https://challenges.cloudflare.com';

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  /** Supabase project URL. Only needed for admin auth and signed crop image URLs. */
  supabaseUrl?: string;
  /**
   * The page was served over https (default). Over plain http (a production build on
   * localhost, as in CI) upgrading would point every asset at an https server that isn't there.
   */
  secure?: boolean;
}

export function buildCsp({ nonce, isDev, supabaseUrl, secure = true }: CspOptions): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : undefined;
  const n = `'nonce-${nonce}'`;

  // A directive set to `undefined` is omitted entirely; `undefined` values inside are dropped.
  const directives: Record<string, (string | undefined)[] | undefined> = {
    'default-src': ["'self'"],
    // 'strict-dynamic' lets nonce'd scripts load their chunks; host entries are CSP2 fallbacks.
    // 'wasm-unsafe-eval' is required by onnxruntime-web / tesseract.js in the found flow.
    'script-src': [
      "'self'",
      n,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      TURNSTILE,
      isDev ? "'unsafe-eval'" : undefined,
    ],
    'style-src': ["'self'", isDev ? "'unsafe-inline'" : n],
    'style-src-elem': ["'self'", isDev ? "'unsafe-inline'" : n],
    // Style attributes cannot execute script; allowing them keeps third-party widgets working.
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'blob:', 'data:', supabase],
    'font-src': ["'self'"],
    'connect-src': ["'self'", supabase, TURNSTILE],
    'frame-src': [TURNSTILE],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': isDev || !secure ? undefined : [],
  };

  return Object.entries(directives)
    .flatMap(([name, values]) => (values ? [[name, ...values.filter(Boolean)].join(' ')] : []))
    .join('; ');
}

/** 128 bits of randomness, base64. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
