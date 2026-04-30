// @ts-nocheck
import { requireEnv } from './env.ts';

const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_PATH = '/api/token';
const SPOTIFY_AUTHORIZE_PATH = '/authorize';

type StatePayload = {
  u: string;
  t: number;
  n: string;
};

function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signStatePayload(payload: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function verifyStatePayload(payload: string, signature: string, secret: string): Promise<boolean> {
  return crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    fromBase64Url(signature),
    new TextEncoder().encode(payload)
  );
}

export async function createSpotifyState(userId: string): Promise<string> {
  const secret = requireEnv('SPOTIFY_STATE_SECRET');
  const payload: StatePayload = {
    u: userId,
    t: Date.now(),
    n: crypto.randomUUID()
  };

  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const encodedSignature = await signStatePayload(encodedPayload, secret);
  return `${encodedPayload}.${encodedSignature}`;
}

export async function parseSpotifyState(state: string, { maxAgeMs = 10 * 60 * 1000 } = {}): Promise<StatePayload> {
  const secret = requireEnv('SPOTIFY_STATE_SECRET');
  const [encodedPayload, encodedSignature] = String(state || '').split('.');
  if (!encodedPayload || !encodedSignature) {
    throw new Error('Invalid OAuth state format.');
  }

  const valid = await verifyStatePayload(encodedPayload, encodedSignature, secret);
  if (!valid) {
    throw new Error('Invalid OAuth state signature.');
  }

  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as StatePayload;
  if (!payload?.u || typeof payload.t !== 'number') {
    throw new Error('Malformed OAuth state payload.');
  }

  if ((Date.now() - payload.t) > maxAgeMs) {
    throw new Error('OAuth state has expired.');
  }

  return payload;
}

export function buildSpotifyAuthorizeUrl(userId: string): Promise<string> {
  return createSpotifyState(userId).then((state) => {
    const clientId = requireEnv('SPOTIFY_CLIENT_ID');
    const redirectUri = requireEnv('SPOTIFY_REDIRECT_URI');
    const configuredScopes = Deno.env.get('SPOTIFY_SCOPES')?.trim() || '';
    const requiredScopes = ['user-read-email', 'user-read-private', 'streaming', 'user-modify-playback-state', 'user-read-playback-state', 'user-read-currently-playing'];
    const scopeSet = new Set([...requiredScopes, ...(configuredScopes ? configuredScopes.split(/\s+/) : [])]);
    const scope = [...scopeSet].join(' ');

    const url = new URL(`${SPOTIFY_ACCOUNTS_BASE}${SPOTIFY_AUTHORIZE_PATH}`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', scope);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    return url.toString();
  });
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

async function requestSpotifyToken(body: URLSearchParams): Promise<TokenResponse> {
  const clientId = requireEnv('SPOTIFY_CLIENT_ID');
  const clientSecret = requireEnv('SPOTIFY_CLIENT_SECRET');
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}${SPOTIFY_TOKEN_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const message = typeof payload?.error_description === 'string' ? payload.error_description : 'Failed to acquire Spotify token.';
    throw new Error(message);
  }

  return payload as TokenResponse;
}

export async function exchangeSpotifyCodeForToken(code: string): Promise<TokenResponse> {
  const redirectUri = requireEnv('SPOTIFY_REDIRECT_URI');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  return requestSpotifyToken(body);
}

export async function refreshSpotifyToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  return requestSpotifyToken(body);
}

export async function fetchSpotifyUser(accessToken: string): Promise<{ id: string | null }> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return { id: null };
  }

  const payload = await response.json().catch(() => ({}));
  return {
    id: typeof payload?.id === 'string' ? payload.id : null
  };
}

export async function fetchFeaturedPlaylists(accessToken: string, { limit = 6, country = 'DK' } = {}) {
  function normalizeItems(items: unknown[]) {
    return items.slice(0, limit).map((item: Record<string, unknown>) => {
      const id = typeof item?.id === 'string' ? item.id : crypto.randomUUID();
      return {
        id,
        title: typeof item?.name === 'string' ? item.name : 'Ukendt playliste',
        subtitle: typeof item?.description === 'string' && item.description.trim().length > 0
          ? item.description
          : 'Spotify-anbefaling',
        href: typeof item?.external_urls === 'object' && item.external_urls && typeof (item.external_urls as Record<string, unknown>).spotify === 'string'
          ? (item.external_urls as Record<string, string>).spotify
          : '',
        uri: typeof item?.uri === 'string' ? item.uri : `spotify:playlist:${id}`
      };
    });
  }

  async function requestPlaylists(endpointUrl: URL): Promise<unknown[]> {
    const response = await fetch(endpointUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : `Spotify request failed with status ${response.status}.`;
      throw new Error(message);
    }

    const items = Array.isArray(payload?.playlists?.items) ? payload.playlists.items : [];
    return items;
  }

  const errors: string[] = [];

  try {
    const featuredUrl = new URL(`${SPOTIFY_API_BASE}/browse/featured-playlists`);
    featuredUrl.searchParams.set('limit', String(limit));
    featuredUrl.searchParams.set('country', country);
    const featuredItems = await requestPlaylists(featuredUrl);
    if (featuredItems.length > 0) {
      return normalizeItems(featuredItems);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Featured playlists failed.');
  }

  try {
    const featuredNoCountryUrl = new URL(`${SPOTIFY_API_BASE}/browse/featured-playlists`);
    featuredNoCountryUrl.searchParams.set('limit', String(limit));
    const featuredItemsNoCountry = await requestPlaylists(featuredNoCountryUrl);
    if (featuredItemsNoCountry.length > 0) {
      return normalizeItems(featuredItemsNoCountry);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Featured playlists without country failed.');
  }

  try {
    const searchUrl = new URL(`${SPOTIFY_API_BASE}/search`);
    searchUrl.searchParams.set('q', 'familie musik');
    searchUrl.searchParams.set('type', 'playlist');
    searchUrl.searchParams.set('limit', String(limit));
    const searchItems = await requestPlaylists(searchUrl);
    if (searchItems.length > 0) {
      return normalizeItems(searchItems);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Playlist search fallback failed.');
  }

  throw new Error(errors[0] || 'Failed to load Spotify playlists.');
}

type SpotifySearchItem = {
  id: string;
  kind: 'track' | 'playlist' | 'album' | 'artist';
  title: string;
  subtitle: string;
  href: string;
  uri: string;
  canPlay: boolean;
};

function asSpotifyLink(input: unknown): string {
  if (typeof input === 'object' && input && typeof (input as Record<string, unknown>).spotify === 'string') {
    return (input as Record<string, string>).spotify;
  }
  return '';
}

function imageUrlFromImages(images: unknown): string {
  if (!Array.isArray(images) || images.length === 0) {
    return '';
  }

  for (const image of images) {
    if (typeof image === 'object' && image && typeof (image as Record<string, unknown>).url === 'string') {
      return (image as Record<string, string>).url;
    }
  }

  return '';
}

export async function searchSpotifyCatalog(accessToken: string, query: string, { limit = 20 } = {}): Promise<SpotifySearchItem[]> {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return [];
  }

  const perTypeLimit = Math.max(1, Math.min(8, Math.ceil(limit / 4)));
  const url = new URL(`${SPOTIFY_API_BASE}/search`);
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('type', 'track,playlist,album,artist');
  url.searchParams.set('limit', String(perTypeLimit));
  url.searchParams.set('market', 'DK');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === 'string'
      ? payload.error.message
      : `Spotify request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const tracks = Array.isArray(payload?.tracks?.items) ? payload.tracks.items : [];
  const playlists = Array.isArray(payload?.playlists?.items) ? payload.playlists.items : [];
  const albums = Array.isArray(payload?.albums?.items) ? payload.albums.items : [];
  const artists = Array.isArray(payload?.artists?.items) ? payload.artists.items : [];

  const results: SpotifySearchItem[] = [];

  for (const track of tracks) {
    const artistsLabel = Array.isArray((track as Record<string, unknown>)?.artists)
      ? ((track as Record<string, unknown>).artists as Array<Record<string, unknown>>)
          .map(artist => typeof artist?.name === 'string' ? artist.name : '')
          .filter(Boolean)
          .join(', ')
      : '';
    const albumImages = typeof (track as Record<string, unknown>)?.album === 'object' && (track as Record<string, unknown>).album
      ? ((track as Record<string, unknown>).album as Record<string, unknown>).images
      : [];
    const imageUrl = imageUrlFromImages(albumImages);

    results.push({
      id: typeof (track as Record<string, unknown>)?.id === 'string' ? (track as Record<string, string>).id : crypto.randomUUID(),
      kind: 'track',
      title: typeof (track as Record<string, unknown>)?.name === 'string' ? (track as Record<string, string>).name : 'Ukendt track',
      subtitle: [artistsLabel, imageUrl ? 'Med cover' : ''].filter(Boolean).join(' · ') || 'Track',
      href: asSpotifyLink((track as Record<string, unknown>)?.external_urls),
      uri: typeof (track as Record<string, unknown>)?.uri === 'string' ? (track as Record<string, string>).uri : '',
      canPlay: true
    });
  }

  for (const playlist of playlists) {
    const ownerName = typeof (playlist as Record<string, unknown>)?.owner === 'object' && (playlist as Record<string, unknown>).owner
      ? ((playlist as Record<string, unknown>).owner as Record<string, unknown>).display_name
      : '';

    results.push({
      id: typeof (playlist as Record<string, unknown>)?.id === 'string' ? (playlist as Record<string, string>).id : crypto.randomUUID(),
      kind: 'playlist',
      title: typeof (playlist as Record<string, unknown>)?.name === 'string' ? (playlist as Record<string, string>).name : 'Ukendt playliste',
      subtitle: typeof ownerName === 'string' && ownerName.trim().length > 0 ? `Af ${ownerName}` : 'Playliste',
      href: asSpotifyLink((playlist as Record<string, unknown>)?.external_urls),
      uri: typeof (playlist as Record<string, unknown>)?.uri === 'string' ? (playlist as Record<string, string>).uri : '',
      canPlay: true
    });
  }

  for (const album of albums) {
    const albumArtists = Array.isArray((album as Record<string, unknown>)?.artists)
      ? ((album as Record<string, unknown>).artists as Array<Record<string, unknown>>)
          .map(artist => typeof artist?.name === 'string' ? artist.name : '')
          .filter(Boolean)
          .join(', ')
      : '';

    results.push({
      id: typeof (album as Record<string, unknown>)?.id === 'string' ? (album as Record<string, string>).id : crypto.randomUUID(),
      kind: 'album',
      title: typeof (album as Record<string, unknown>)?.name === 'string' ? (album as Record<string, string>).name : 'Ukendt album',
      subtitle: albumArtists || 'Album',
      href: asSpotifyLink((album as Record<string, unknown>)?.external_urls),
      uri: typeof (album as Record<string, unknown>)?.uri === 'string' ? (album as Record<string, string>).uri : '',
      canPlay: true
    });
  }

  for (const artist of artists) {
    results.push({
      id: typeof (artist as Record<string, unknown>)?.id === 'string' ? (artist as Record<string, string>).id : crypto.randomUUID(),
      kind: 'artist',
      title: typeof (artist as Record<string, unknown>)?.name === 'string' ? (artist as Record<string, string>).name : 'Ukendt artist',
      subtitle: 'Artist',
      href: asSpotifyLink((artist as Record<string, unknown>)?.external_urls),
      uri: typeof (artist as Record<string, unknown>)?.uri === 'string' ? (artist as Record<string, string>).uri : '',
      canPlay: false
    });
  }

  return results.slice(0, limit);
}

export function computeExpiresAtIso(expiresInSeconds: number): string {
  const safeSeconds = Number.isFinite(expiresInSeconds) ? Math.max(60, Math.floor(expiresInSeconds)) : 3600;
  return new Date(Date.now() + (safeSeconds * 1000)).toISOString();
}
