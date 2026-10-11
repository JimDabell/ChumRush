import { normalizeAthlete } from '#lib/server/auth/session.ts';

export interface StravaProfile {
	id: number;
	firstName: string;
	lastName: string;
	username: string | null;
	bio: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	profile: string | null;
	profileMedium: string | null;
}

function optionalText(value: unknown, limit: number): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string' || value.length > limit) {
		throw new Error('Invalid Strava profile field.');
	}
	return value.trim() || null;
}

function imageUrl(value: unknown): string | null {
	const image = optionalText(value, 2048);
	if (!image) return null;
	try {
		// Strava may return a relative path for its default athlete avatar.
		const url = new URL(image, 'https://www.strava.com/');
		return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}

export function normalizeStravaProfile(value: unknown): StravaProfile | null {
	if (!value || typeof value !== 'object') return null;
	const profile = value as Record<string, unknown>;
	const athlete = normalizeAthlete({
		id: profile.id,
		firstName: profile.firstname,
		lastName: profile.lastname
	});
	if (!athlete) return null;
	return {
		id: athlete.id,
		firstName: athlete.firstName,
		lastName: athlete.lastName,
		username: optionalText(profile.username, 100),
		bio: optionalText(profile.bio, 5000),
		city: optionalText(profile.city, 200),
		state: optionalText(profile.state, 200),
		country: optionalText(profile.country, 200),
		profile: imageUrl(profile.profile),
		profileMedium: imageUrl(profile.profile_medium)
	};
}
