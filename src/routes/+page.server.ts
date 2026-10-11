import { initialCity } from '#lib/server/initial-city.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ request }) => {
	return { initialCity: initialCity(request.headers) };
};
