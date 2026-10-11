import { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } from '$app/env/private';
import { redirect, type Cookies } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import {
	normalizeRequestOrigin,
	requestOriginMatchesDeployment,
	stravaRedirectUri
} from '#lib/environment.ts';
import { deployment } from '#lib/deployment.ts';
import { cookieOptions, hasSessionSecret, normalizeAthlete } from '#lib/server/auth/session.ts';
import { normalizeStravaProfile, type StravaProfile } from '#lib/server/profiles/profile.ts';

const STATE_COOKIE = '__Host-chumrush-strava-state';
const STATE_SECONDS = 10 * 60;
const AUTH_ERRORS = ['setup', 'state', 'denied', 'callback', 'exchange', 'profile'] as const;
export type AuthError = (typeof AUTH_ERRORS)[number];

export function readAuthError(value: string | null): AuthError | null {
	return AUTH_ERRORS.find((code) => code === value) ?? null;
}

export function authError(code: AuthError): never {
	redirect(303, `/?auth_error=${code}`);
}

export function authOrigin(origin: string): string | null {
	return normalizeRequestOrigin(deployment, origin);
}

export function stravaConfig(origin: string) {
	if (
		!hasSessionSecret() ||
		!/^[1-9]\d*$/.test(STRAVA_CLIENT_ID) ||
		!STRAVA_CLIENT_SECRET.trim() ||
		!requestOriginMatchesDeployment(deployment, origin)
	)
		return null;
	return {
		clientId: STRAVA_CLIENT_ID,
		clientSecret: STRAVA_CLIENT_SECRET,
		redirectUri: stravaRedirectUri(deployment)
	};
}

export function createState(cookies: Cookies, params?: URLSearchParams): string {
	const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
	const intent =
		params?.getAll('next').length === 1 && params.get('next') === 'availability'
			? 'availability'
			: 'login';
	// Keep the intent with its nonce, never in an independently reusable cookie or return URL.
	const value = `v1.${state}.${Math.floor(Date.now() / 1000)}.${intent}`;
	cookies.set(STATE_COOKIE, value, { ...cookieOptions, maxAge: STATE_SECONDS });
	return state;
}

export function clearState(cookies: Cookies): void {
	cookies.delete(STATE_COOKIE, cookieOptions);
}

export function consumeState(
	cookies: Cookies,
	params: URLSearchParams
): { next: 'availability' | null } | null {
	const value = cookies.get(STATE_COOKIE);
	clearState(cookies);
	if (typeof value !== 'string' || value.length > 80) return null;
	let expected = value;
	let next: 'availability' | null = null;
	if (value.startsWith('v1.')) {
		const match = /^v1\.([A-Za-z0-9_-]{43})\.(\d{1,10})\.(login|availability)$/.exec(value);
		if (!match || match[0] !== value) return null;
		const issuedAt = Number(match[2]);
		const now = Math.floor(Date.now() / 1000);
		if (issuedAt > now || now - issuedAt >= STATE_SECONDS) return null;
		expected = match[1];
		next = match[3] === 'availability' ? 'availability' : null;
	}
	// Original plain nonce cookies can finish login, but carry no return intent.
	const received = params.get('state');
	if (
		params.getAll('state').length !== 1 ||
		expected.length !== 43 ||
		!/^[A-Za-z0-9_-]{43}$/.test(expected) ||
		typeof received !== 'string' ||
		received.length !== 43 ||
		!/^[A-Za-z0-9_-]{43}$/.test(received) ||
		!timingSafeEqual(Buffer.from(expected), Buffer.from(received))
	)
		return null;
	return { next };
}

export function hasReadScope(scope: string): boolean {
	return scope.split(/[ ,]+/).includes('read');
}

async function readStravaJson(response: Response): Promise<unknown> {
	if (!response.ok || !response.body) {
		await response.body?.cancel();
		throw new Error('Strava request failed.');
	}
	// Bound the response before parsing; never persist or log the token payload.
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 65_536) {
				await reader.cancel();
				throw new Error('Strava response is too large.');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export async function exchangeCode(
	config: NonNullable<ReturnType<typeof stravaConfig>>,
	code: string
): Promise<StravaProfile> {
	const response = await fetch('https://www.strava.com/oauth/token', {
		method: 'POST',
		body: new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			code,
			grant_type: 'authorization_code'
		}),
		headers: { Accept: 'application/json' },
		redirect: 'error',
		signal: AbortSignal.timeout(10_000)
	});
	const payload = await readStravaJson(response);
	if (!payload || typeof payload !== 'object') throw new Error('Invalid Strava response.');
	const token = payload as Record<string, unknown>;
	if (
		token.token_type !== 'Bearer' ||
		typeof token.access_token !== 'string' ||
		!token.access_token ||
		(token.scope !== undefined &&
			(typeof token.scope !== 'string' || !hasReadScope(token.scope))) ||
		!token.athlete ||
		typeof token.athlete !== 'object'
	)
		throw new Error('Invalid Strava response.');
	const upstream = token.athlete as Record<string, unknown>;
	const athlete = normalizeAthlete({
		id: upstream.id,
		firstName: upstream.firstname,
		lastName: upstream.lastname,
		profile: upstream.profile
	});
	if (!athlete) throw new Error('Invalid Strava athlete.');

	const profileResponse = await fetch('https://www.strava.com/api/v3/athlete', {
		headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
		redirect: 'error',
		signal: AbortSignal.timeout(10_000)
	});
	const profile = normalizeStravaProfile(await readStravaJson(profileResponse));
	if (!profile || profile.id !== athlete.id) throw new Error('Invalid Strava profile identity.');
	return profile;
}
