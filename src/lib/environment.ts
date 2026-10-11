export const environmentNames = ['local', 'staging', 'production'] as const;
export type AppEnvironment = (typeof environmentNames)[number];

export interface Deployment {
	name: AppEnvironment;
	origin: string;
	hostname: string;
	apexHostname: string;
}

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
	const environment = value?.trim();
	const match = environmentNames.find((candidate) => candidate === environment);
	if (match) return match;
	throw new Error('APP_ENV must be set to local, staging, or production.');
}

export function parseAppOrigin(value: string | undefined): string {
	const configured = value?.trim();
	if (!configured) throw new Error('APP_ORIGIN must be set.');

	let url: URL;
	try {
		url = new URL(configured);
	} catch {
		throw new Error('APP_ORIGIN must be an absolute HTTPS origin.');
	}
	if (
		url.protocol !== 'https:' ||
		url.href !== `${url.origin}/` ||
		url.port ||
		url.username ||
		url.password ||
		!url.hostname.startsWith('www.') ||
		url.hostname.length <= 4
	) {
		throw new Error('APP_ORIGIN must be an HTTPS www origin without a port, path, or credentials.');
	}
	return url.origin;
}

export function resolveDeployment(
	environment: string | undefined,
	origin: string | undefined
): Deployment {
	const name = parseAppEnvironment(environment);
	const canonicalOrigin = parseAppOrigin(origin);
	const hostname = new URL(canonicalOrigin).hostname;
	return {
		name,
		origin: canonicalOrigin,
		hostname,
		apexHostname: hostname.slice(4)
	};
}

export function normalizeRequestOrigin(deployment: Deployment, origin: string): string | null {
	try {
		const requestUrl = new URL(origin);
		if (requestUrl.href !== `${requestUrl.origin}/`) return null;
		if (deployment.name === 'local' && requestUrl.origin === `http://${deployment.hostname}`) {
			return deployment.origin;
		}
		return requestUrl.origin;
	} catch {
		return null;
	}
}

export function requestOriginMatchesDeployment(deployment: Deployment, origin: string): boolean {
	return normalizeRequestOrigin(deployment, origin) === deployment.origin;
}

export function stravaRedirectUri(deployment: Deployment): string {
	return new URL('/auth/strava/callback', deployment.origin).href;
}

export function canonicalRedirectUrl(deployment: Deployment, requestUrl: string | URL): URL | null {
	const url = new URL(requestUrl);
	if (url.hostname !== deployment.apexHostname) return null;
	url.protocol = 'https:';
	url.hostname = deployment.hostname;
	url.port = '';
	return url;
}
