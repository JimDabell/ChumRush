export interface City {
	name: string;
	center: [longitude: number, latitude: number];
	zoom?: number;
}

// Fallback when the hosting platform has no usable IP-derived city.
export const DEFAULT_CITY: City = {
	name: 'Singapore',
	center: [103.8198, 1.3521]
};
