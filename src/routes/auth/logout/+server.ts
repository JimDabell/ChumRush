import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { clearSession } from '#lib/server/auth/session.ts';
import { authOrigin, clearState } from '#lib/server/auth/strava.ts';

export const POST: RequestHandler = ({ cookies, request, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	if (request.headers.get('origin') !== authOrigin(url.origin))
		error(403, 'Same-origin request required.');
	clearSession(cookies);
	clearState(cookies);
	redirect(303, '/');
};
