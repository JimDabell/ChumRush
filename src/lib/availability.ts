export const DAYS = [
	{ key: 'mon', label: 'Monday', shortLabel: 'Mon' },
	{ key: 'tue', label: 'Tuesday', shortLabel: 'Tue' },
	{ key: 'wed', label: 'Wednesday', shortLabel: 'Wed' },
	{ key: 'thu', label: 'Thursday', shortLabel: 'Thu' },
	{ key: 'fri', label: 'Friday', shortLabel: 'Fri' },
	{ key: 'sat', label: 'Saturday', shortLabel: 'Sat' },
	{ key: 'sun', label: 'Sunday', shortLabel: 'Sun' }
] as const;

export const MINUTES_PER_DAY = 24 * 60;
export const TIME_STEP = 15;

export type DayKey = (typeof DAYS)[number]['key'];

export interface DayAvailability {
	day: DayKey;
	enabled: boolean;
	start: number;
	end: number;
}

export interface Availability {
	timeZone: string;
	sharingConsent: boolean;
	days: DayAvailability[];
}

export function defaultAvailability(timeZone: string): Availability {
	return {
		timeZone,
		sharingConsent: false,
		days: DAYS.map(({ key }) => ({ day: key, enabled: false, start: 7 * 60, end: 9 * 60 }))
	};
}

export function formatTime(minutes: number): string {
	return `${Math.floor(minutes / 60)
		.toString()
		.padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
