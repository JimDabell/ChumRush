import type { Handle } from '@sveltejs/kit/hooks';
import { deployment } from '#lib/deployment.ts';
import { canonicalRedirectUrl, requestOriginMatchesDeployment } from '#lib/environment.ts';

export const handle: Handle = ({ event, resolve }) => {
	const canonicalUrl = canonicalRedirectUrl(deployment, event.url);
	if (canonicalUrl) {
		return new Response(null, {
			status: 308,
			headers: { location: canonicalUrl.href }
		});
	}
	if (!requestOriginMatchesDeployment(deployment, event.url.origin)) {
		return new Response('Misdirected Request', {
			status: 421,
			headers: { 'cache-control': 'no-store' }
		});
	}
	return resolve(event);
};
