import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { error } from '@sveltejs/kit';
import {
	DAYS,
	MINUTES_PER_DAY,
	TIME_STEP,
	type Availability,
	type DayAvailability
} from '#lib/availability.ts';
import { getProfilesTable, invalidateProfilesTable } from '#lib/server/db.ts';

const DATABASE_TIMEOUT_MS = 5_000;
const MAX_TIME_ZONE_LENGTH = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

/** Validate untrusted input and reconstruct only the fields we persist or return. */
export function normalizeAvailability(value: unknown): Availability | null {
	if (!isRecord(value)) return null;
	const { timeZone, sharingConsent, days } = value;
	if (
		typeof timeZone !== 'string' ||
		timeZone.length === 0 ||
		timeZone.length > MAX_TIME_ZONE_LENGTH ||
		typeof sharingConsent !== 'boolean' ||
		!Array.isArray(days) ||
		days.length !== DAYS.length
	) {
		return null;
	}
	try {
		new Intl.DateTimeFormat('en', { timeZone });
	} catch {
		return null;
	}

	const byDay = new Map<string, DayAvailability>();
	for (const entry of days) {
		if (!isRecord(entry)) return null;
		const { day, enabled, start, end } = entry;
		const knownDay = DAYS.find(({ key }) => key === day);
		if (
			!knownDay ||
			byDay.has(knownDay.key) ||
			typeof enabled !== 'boolean' ||
			typeof start !== 'number' ||
			typeof end !== 'number' ||
			!Number.isInteger(start) ||
			!Number.isInteger(end) ||
			start < 0 ||
			start >= end ||
			end > MINUTES_PER_DAY ||
			start % TIME_STEP !== 0 ||
			end % TIME_STEP !== 0
		) {
			return null;
		}
		byDay.set(knownDay.key, { day: knownDay.key, enabled, start, end });
	}

	const canonicalDays = DAYS.map(({ key }) => byDay.get(key)!);
	if (sharingConsent && !canonicalDays.some(({ enabled }) => enabled)) return null;
	return { timeZone, sharingConsent, days: canonicalDays };
}

/** The caller supplies only the authenticated session's athlete ID. */
export async function readAvailability(athleteId: number): Promise<Availability | null> {
	try {
		const { client, tableName } = await getProfilesTable();
		const { Item } = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { stravaId: athleteId },
				ConsistentRead: true,
				ProjectionExpression: '#availability',
				ExpressionAttributeNames: { '#availability': 'availability' }
			}),
			{ abortSignal: AbortSignal.timeout(DATABASE_TIMEOUT_MS) }
		);
		if (!Item || !Object.hasOwn(Item, 'availability')) return null;
		const availability = normalizeAvailability(Item.availability);
		if (!availability) throw new Error('Invalid stored availability.');
		return availability;
	} catch {
		invalidateProfilesTable();
		error(503, 'Availability could not be loaded. Please try again.');
	}
}

export async function writeAvailability(athleteId: number, input: unknown): Promise<Availability> {
	const availability = normalizeAvailability(input);
	if (!availability) error(400, 'Invalid availability.');

	try {
		const { client, tableName } = await getProfilesTable();
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { stravaId: athleteId },
				// A keyed upsert also supports valid sessions predating profile persistence.
				// Do not touch provider profile data or its timestamps.
				UpdateExpression: 'SET #availability = :availability, #availabilityUpdatedAt = :now',
				ExpressionAttributeNames: {
					'#availability': 'availability',
					'#availabilityUpdatedAt': 'availabilityUpdatedAt'
				},
				ExpressionAttributeValues: {
					':availability': availability,
					':now': new Date().toISOString()
				}
			}),
			{ abortSignal: AbortSignal.timeout(DATABASE_TIMEOUT_MS) }
		);
		return availability;
	} catch {
		invalidateProfilesTable();
		error(503, 'Availability could not be saved. Please try again.');
	}
}
