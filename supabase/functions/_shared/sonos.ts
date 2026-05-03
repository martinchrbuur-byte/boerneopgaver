// @ts-nocheck
import { requireEnv } from './env.ts';

const SONOS_ACCOUNTS_BASE = 'https://api.sonos.com';
const SONOS_CONTROL_BASE = 'https://api.ws.sonos.com/control/api/v1';

type SonosStatePayload = {
  u: string;
  t: number;
  n: string;
};

type SonosTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
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

export async function createSonosState(userId: string): Promise<string> {
  const secret = requireEnv('SONOS_STATE_SECRET');
  const payload: SonosStatePayload = {
    u: userId,
    t: Date.now(),
    n: crypto.randomUUID()
  };

  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const encodedSignature = await signStatePayload(encodedPayload, secret);
  return `${encodedPayload}.${encodedSignature}`;
}

export async function parseSonosState(state: string, { maxAgeMs = 10 * 60 * 1000 } = {}): Promise<SonosStatePayload> {
  const secret = requireEnv('SONOS_STATE_SECRET');
  const [encodedPayload, encodedSignature] = String(state || '').split('.');
  if (!encodedPayload || !encodedSignature) {
    throw new Error('Invalid Sonos OAuth state format.');
  }

  const valid = await verifyStatePayload(encodedPayload, encodedSignature, secret);
  if (!valid) {
    throw new Error('Invalid Sonos OAuth state signature.');
  }

  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as SonosStatePayload;
  if (!payload?.u || typeof payload.t !== 'number') {
    throw new Error('Malformed Sonos OAuth state payload.');
  }

  if ((Date.now() - payload.t) > maxAgeMs) {
    throw new Error('Sonos OAuth state has expired.');
  }

  return payload;
}

export function buildSonosAuthorizeUrl(userId: string): Promise<string> {
  return createSonosState(userId).then((state) => {
    const clientId = requireEnv('SONOS_CLIENT_ID');
    const redirectUri = requireEnv('SONOS_REDIRECT_URI');
    const configuredScopes = Deno.env.get('SONOS_SCOPES')?.trim() || '';
    const defaultScopes = 'household-read-all playback-control-all';
    const scope = configuredScopes || defaultScopes;

    const url = new URL(`${SONOS_ACCOUNTS_BASE}/login/v3/oauth`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scope);
    url.searchParams.set('redirect_uri', redirectUri);
    return url.toString();
  });
}

function computeExpiresAtIso(expiresInSeconds: number | null | undefined): string {
  const lifetimeSeconds = Number.isFinite(Number(expiresInSeconds)) ? Number(expiresInSeconds) : 3600;
  return new Date(Date.now() + lifetimeSeconds * 1000).toISOString();
}

async function requestSonosToken(params: URLSearchParams): Promise<SonosTokenResponse> {
  const clientId = requireEnv('SONOS_CLIENT_ID');
  const clientSecret = requireEnv('SONOS_CLIENT_SECRET');
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${SONOS_ACCOUNTS_BASE}/login/v3/oauth/access?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const message = typeof payload?.message === 'string'
      ? payload.message
      : 'Failed to acquire Sonos token.';
    throw new Error(message);
  }

  return payload as SonosTokenResponse;
}

export async function exchangeSonosCodeForToken(code: string): Promise<SonosTokenResponse> {
  const redirectUri = requireEnv('SONOS_REDIRECT_URI');
  return requestSonosToken(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  }));
}

export async function refreshSonosToken(refreshToken: string): Promise<SonosTokenResponse> {
  return requestSonosToken(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  }));
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) {
    return true;
  }

  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) {
    return true;
  }

  return ms <= (Date.now() + 30_000);
}

export async function resolveSonosAccessToken(userId: string, supabase: any): Promise<{ accessToken: string; reconnectUrl?: string }> {
  const { data: connection, error } = await supabase
    .from('sonos_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !connection) {
    return { accessToken: '', reconnectUrl: await buildSonosAuthorizeUrl(userId) };
  }

  let { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt } = connection;
  if (!accessToken || !refreshToken) {
    return { accessToken: '', reconnectUrl: await buildSonosAuthorizeUrl(userId) };
  }

  if (isExpired(expiresAt)) {
    try {
      const refreshed = await refreshSonosToken(refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token || refreshToken;
      expiresAt = computeExpiresAtIso(refreshed.expires_in);

      await supabase
        .from('sonos_connections')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          scope: refreshed.scope || null,
          token_type: refreshed.token_type || null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } catch {
      return { accessToken: '', reconnectUrl: await buildSonosAuthorizeUrl(userId) };
    }
  }

  return { accessToken };
}

export async function sonosControlRequest(path: string, {
  accessToken,
  method = 'GET',
  body
}: {
  accessToken: string;
  method?: string;
  body?: Record<string, unknown> | null;
}): Promise<Response> {
  return fetch(`${SONOS_CONTROL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

export function computeSonosExpiresAtIso(expiresInSeconds: number | null | undefined): string {
  return computeExpiresAtIso(expiresInSeconds);
}
