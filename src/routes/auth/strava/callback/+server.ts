import { redirect, type RequestHandler } from '@sveltejs/kit';
import {
	authError,
	consumeState,
	exchangeCode,
	hasReadScope,
	stravaConfig
} from '#lib/server/auth/strava.ts';
import { normalizeAthlete, writeSession } from '#lib/server/auth/session.ts';
import { saveProfile } from '#lib/server/profiles/repository.ts';
import type { StravaProfile } from '#lib/server/profiles/profile.ts';

export const GET: RequestHandler = async ({ cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	const params = url.searchParams;
	const state = consumeState(cookies, params);
	if (!state) authError('state');
	if (params.has('error')) {
		if (
			params.getAll('error').length === 1 &&
			params.get('error') === 'access_denied' &&
			!params.has('code')
		) {
			authError('denied');
		}
		authError('callback');
	}
	const code = params.get('code');
	const scope = params.get('scope');
	if (
		params.getAll('code').length !== 1 ||
		!code ||
		code.length > 1024 ||
		/\s/.test(code) ||
		params.getAll('scope').length !== 1 ||
		!scope ||
		scope.length > 1024 ||
		!hasReadScope(scope)
	)
		authError('callback');
	const config = stravaConfig(url.origin);
	if (!config) authError('setup');
	let profile: StravaProfile;
	try {
		profile = await exchangeCode(config, code);
	} catch {
		// Never surface upstream bodies, authorization codes, or tokens.
		authError('exchange');
	}
	try {
		await saveProfile(profile);
	} catch {
		authError('profile');
	}
	try {
		const athlete = normalizeAthlete({
			...profile,
			profile: profile.profile ?? profile.profileMedium
		});
		if (!athlete) throw new Error('Invalid Strava identity.');
		await writeSession(cookies, athlete);
	} catch {
		// Do not surface upstream bodies, authorization codes, tokens, or secrets.
		authError('exchange');
	}
	redirect(303, state.next === 'availability' ? '/?availability=1' : '/');
};
