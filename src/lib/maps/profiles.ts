import type { Availability } from '#lib/availability.ts';
import type { StravaProfile } from '#lib/server/profiles/profile.ts';

export const DEFAULT_RADIUS_METERS = 3000;
export const MIN_RADIUS_METERS = 250;
export const MAX_RADIUS_METERS = 20000;

export interface MapLocation {
	center: [longitude: number, latitude: number];
	radiusMeters: number;
}

export interface MapBounds {
	west: number;
	south: number;
	east: number;
	north: number;
}

interface ProfileFields {
	id: string;
	name: string;
	photoUrl: string | null;
	isExample: boolean;
	availability: Availability | null;
	location: MapLocation | null;
}

export interface PersonProfile extends ProfileFields {
	kind: 'person';
	stravaId?: number;
	stravaProfile?: StravaProfile;
}

export interface ClubProfile extends ProfileFields {
	kind: 'club';
	ownerProfileId: string;
	website: string;
}

export type Profile = PersonProfile | ClubProfile;
export type StoredProfile = Profile & {
	version: number;
	createdAt: string;
	updatedAt: string;
};

// Public map projections intentionally omit private provider details and ownership links.
export interface MapProfile {
	id: string;
	kind: Profile['kind'];
	name: string;
	photoUrl: string | null;
	isExample: boolean;
	location: MapLocation;
}

export interface OwnMapProfile {
	id: string;
	name: string;
	photoUrl: string | null;
	isPublic: boolean;
	location: MapLocation | null;
}

export interface MapData {
	profiles: MapProfile[];
	self: OwnMapProfile | null;
	needsZoom: boolean;
}

export function stravaProfileId(athleteId: number): string {
	return `strava:${athleteId}`;
}
