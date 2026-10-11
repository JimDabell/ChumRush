import { readSession } from '#lib/server/auth/session.ts';
import { readAuthError } from '#lib/server/auth/strava.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const athlete = await readSession(cookies);
	return {
		athlete,
		authError: readAuthError(url.searchParams.get('auth_error')),
		openAvailability:
			athlete !== null &&
			url.searchParams.getAll('availability').length === 1 &&
			url.searchParams.get('availability') === '1'
	};
};
