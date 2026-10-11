import { AUTH_SECRET } from '$app/env/private';
import type { Cookies } from '@sveltejs/kit';

export interface Athlete {
	id: number;
	firstName: string;
	lastName: string;
	profile?: string;
}

export const cookieOptions = {
	path: '/',
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const
};

const SESSION_COOKIE = '__Host-chumrush-session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const MAX_COOKIE_LENGTH = 3000;
const encoder = new TextEncoder();
const context = encoder.encode('chumrush:session:v1');

export function hasSessionSecret(): boolean {
	return AUTH_SECRET.trim().length >= 32;
}

async function sessionKey(): Promise<CryptoKey> {
	if (!hasSessionSecret()) throw new Error('AUTH_SECRET must contain at least 32 characters.');
	const digest = await crypto.subtle.digest(
		'SHA-256',
		encoder.encode(`chumrush:session:v1:${AUTH_SECRET}`)
	);
	return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function normalizeAthlete(value: unknown): Athlete | null {
	if (!value || typeof value !== 'object') return null;
	const athlete = value as Record<string, unknown>;
	if (
		typeof athlete.id !== 'number' ||
		!Number.isSafeInteger(athlete.id) ||
		athlete.id <= 0 ||
		typeof athlete.firstName !== 'string' ||
		athlete.firstName.length > 100 ||
		typeof athlete.lastName !== 'string' ||
		athlete.lastName.length > 100
	)
		return null;

	const identity: Athlete = {
		id: athlete.id,
		firstName: athlete.firstName.trim(),
		lastName: athlete.lastName.trim()
	};
	if (typeof athlete.profile === 'string' && athlete.profile.length <= 512) {
		try {
			const profile = new URL(athlete.profile);
			if (profile.protocol === 'https:' && !profile.username && !profile.password) {
				identity.profile = profile.href;
			}
		} catch {
			// An invalid optional avatar must not prevent sign-in.
		}
	}
	return identity;
}

export async function writeSession(cookies: Cookies, value: Athlete): Promise<void> {
	const athlete = normalizeAthlete(value);
	if (!athlete) throw new Error('Invalid athlete identity.');
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + SESSION_SECONDS;
	const plaintext = encoder.encode(JSON.stringify({ athlete, issuedAt, expiresAt }));
	if (plaintext.byteLength > 1800) throw new Error('Athlete identity is too large.');
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: context },
		await sessionKey(),
		plaintext
	);
	const cookie = `v1.${Buffer.from(iv).toString('base64url')}.${Buffer.from(encrypted).toString('base64url')}`;
	cookies.set(SESSION_COOKIE, cookie, {
		...cookieOptions,
		maxAge: SESSION_SECONDS,
		expires: new Date(expiresAt * 1000)
	});
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, cookieOptions);
}

export async function readSession(cookies: Cookies): Promise<Athlete | null> {
	const cookie = cookies.get(SESSION_COOKIE);
	if (!cookie) return null;
	try {
		if (
			cookie.length > MAX_COOKIE_LENGTH ||
			!/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/.test(cookie)
		) {
			throw new Error('Invalid session.');
		}
		const [, iv, ciphertext] = cookie.split('.');
		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: Buffer.from(iv, 'base64url'), additionalData: context },
			await sessionKey(),
			Buffer.from(ciphertext, 'base64url')
		);
		const value: unknown = JSON.parse(new TextDecoder().decode(decrypted));
		if (!value || typeof value !== 'object') throw new Error('Invalid session.');
		const { athlete, issuedAt, expiresAt } = value as Record<string, unknown>;
		const now = Math.floor(Date.now() / 1000);
		if (
			typeof issuedAt !== 'number' ||
			!Number.isSafeInteger(issuedAt) ||
			issuedAt > now ||
			typeof expiresAt !== 'number' ||
			!Number.isSafeInteger(expiresAt) ||
			expiresAt <= now ||
			expiresAt <= issuedAt ||
			expiresAt - issuedAt > SESSION_SECONDS
		)
			throw new Error('Expired or invalid session.');
		const identity = normalizeAthlete(athlete);
		if (!identity) throw new Error('Invalid session identity.');
		return identity;
	} catch {
		clearSession(cookies);
		return null;
	}
}
