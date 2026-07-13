import { createHash } from 'crypto';

export type HotelbedsSuite = 'hotels' | 'activities' | 'transfers';

function suiteKeyCandidates(suite: HotelbedsSuite): string[] {
  if (suite === 'hotels') {
    return ['HOTELBEDS_API_KEY'];
  }

  if (suite === 'activities') {
    return ['HOTELBEDS_ACTIVITIES_API_KEY', 'ACTIVITY_API_KEY', 'HOTELBEDS_API_KEY'];
  }

  return ['HOTELBEDS_TRANSFERS_API_KEY', 'TRANSFERS_API_KEY', 'HOTELBEDS_API_KEY'];
}

function suiteSecretCandidates(suite: HotelbedsSuite): string[] {
  if (suite === 'hotels') {
    return ['HOTELBEDS_API_SECRET'];
  }

  if (suite === 'activities') {
    return ['HOTELBEDS_ACTIVITIES_API_SECRET', 'HOTELBEDS_API_SECRET'];
  }

  return ['HOTELBEDS_TRANSFERS_API_SECRET', 'HOTELBEDS_API_SECRET'];
}

function resolveEnvValue(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && !value.includes('REPLACE_WITH')) {
      return value;
    }
  }
  return undefined;
}

export function getHotelbedsConfig(suite: HotelbedsSuite) {
  return {
    baseUrl: process.env.HOTELBEDS_BASE_URL || 'https://api.hotelbeds.com',
    apiKey: resolveEnvValue(suiteKeyCandidates(suite)),
    apiSecret: resolveEnvValue(suiteSecretCandidates(suite)),
    path: process.env[`HOTELBEDS_${suite.toUpperCase()}_PATH` as keyof NodeJS.ProcessEnv],
  };
}

export function isHotelbedsConfigured(suite: HotelbedsSuite): boolean {
  const config = getHotelbedsConfig(suite);
  return !!(config.apiKey && config.apiSecret);
}

export function buildHotelbedsSignature(apiKey: string, apiSecret: string, timestampSeconds: string): string {
  return createHash('sha256')
    .update(`${apiKey}${apiSecret}${timestampSeconds}`)
    .digest('hex');
}

export async function hotelbedsRequest<T>(suite: HotelbedsSuite, path: string, body: unknown): Promise<T> {
  const config = getHotelbedsConfig(suite);
  if (!config.apiKey || !config.apiSecret) {
    throw new Error(`Hotelbeds ${suite} credentials are missing`);
  }

  const timestampSeconds = Math.floor(Date.now() / 1000).toString();
  const signature = buildHotelbedsSignature(config.apiKey, config.apiSecret, timestampSeconds);

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Api-key': config.apiKey,
      'X-Signature': signature,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Timestamp': timestampSeconds,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Hotelbeds ${suite} request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}