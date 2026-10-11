import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import type { Availability } from '#lib/availability.ts';
import { readSession } from '#lib/server/auth/session.ts';
import { authOrigin } from '#lib/server/auth/strava.ts';
import { readAvailability, writeAvailability } from '#lib/server/availability.ts';

export const getAvailability = query(async (): Promise<Availability | null> => {
	// Invalid sessions attempt cookie deletion, which Kit forbids inside queries.
	// Fail closed with the same safe 401 even when that cleanup cannot run.
	const athlete = await readSession(getRequestEvent().cookies).catch(() => null);
	if (!athlete) error(401, 'Sign in to manage availability.');
	return readAvailability(athlete.id);
});

export const saveAvailability = command('unchecked', async (input: Availability): Promise<void> => {
	const event = getRequestEvent();
	const athlete = await readSession(event.cookies).catch(() => null);
	if (!athlete) error(401, 'Sign in to manage availability.');
	// Keep same-origin protection in development too, including Portless HTTPS.
	if (event.request.headers.get('origin') !== authOrigin(event.url.origin)) {
		error(403, 'Cross-site availability changes are forbidden.');
	}
	const availability = await writeAvailability(athlete.id, input);
	// Send the validated, committed value with the command response (Kit 3 API).
	getAvailability().set(availability);
});
