import { DEFAULT_CITY, type City } from '#lib/maps/city.ts';

// These are location hints supplied by the hosting proxy, never authentication data.
export function initialCity(headers: Headers): City {
	for (const prefix of ['x-vercel-ip-', 'cf-ip']) {
		const rawName = headers.get(`${prefix}city`);
		const rawLongitude = headers.get(`${prefix}longitude`);
		const rawLatitude = headers.get(`${prefix}latitude`);
		if (!rawName || !rawLongitude?.trim() || !rawLatitude?.trim()) continue;

		const longitude = Number(rawLongitude);
		const latitude = Number(rawLatitude);
		if (
			!Number.isFinite(longitude) ||
			!Number.isFinite(latitude) ||
			Math.abs(longitude) > 180 ||
			Math.abs(latitude) > 90
		)
			continue;

		try {
			const name = decodeURIComponent(rawName).trim();
			const hasControlCharacters = [...name].some((character) => {
				const code = character.charCodeAt(0);
				return code < 32 || code === 127;
			});
			if (name && name.length <= 100 && !hasControlCharacters) {
				return { name, center: [longitude, latitude] };
			}
		} catch {
			// An invalid location hint should not prevent the homepage from loading.
		}
	}
	return DEFAULT_CITY;
}
