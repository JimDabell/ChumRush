import { redirect, type RequestHandler } from '@sveltejs/kit';
import { authError, clearState, createState, stravaConfig } from '#lib/server/auth/strava.ts';

export const GET: RequestHandler = ({ cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	const config = stravaConfig(url.origin);
	if (!config) {
		clearState(cookies);
		authError('setup');
	}
	const authorization = new URL('https://www.strava.com/oauth/authorize');
	authorization.search = new URLSearchParams({
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		response_type: 'code',
		scope: 'read',
		state: createState(cookies, url.searchParams)
	}).toString();
	redirect(303, authorization.href, { external: ['https://www.strava.com'] });
};
