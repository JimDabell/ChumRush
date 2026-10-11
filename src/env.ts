import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DYNAMODB_ENDPOINT: {
		description: 'DynamoDB endpoint; defaults to the ChumRush local service.',
		schema: (value) => value?.trim() || 'http://127.0.0.1:8100'
	},
	DYNAMODB_REGION: {
		description: 'AWS region used to sign DynamoDB requests.',
		schema: (value) => value?.trim() || 'us-east-1'
	},
	DYNAMODB_ACCESS_KEY_ID: {
		description: 'DynamoDB access key; the local service uses local.',
		schema: (value) => value?.trim() || 'local'
	},
	DYNAMODB_SECRET_ACCESS_KEY: {
		description: 'Private DynamoDB credential; the local service uses local.',
		schema: (value) => value?.trim() || 'local'
	},
	DYNAMODB_PROFILES_TABLE: {
		description: 'Table for Strava profiles, keyed by athlete ID.',
		schema: (value) => value?.trim() || 'chumrush-profiles'
	},
	STRAVA_CLIENT_ID: {
		description: 'Strava API application client ID.',
		schema: (value) => value?.trim() ?? ''
	},
	STRAVA_CLIENT_SECRET: {
		description: 'Private Strava OAuth client secret.',
		schema: (value) => value?.trim() ?? ''
	},
	STRAVA_REDIRECT_URI: {
		description: 'Registered absolute Strava OAuth callback URL.',
		schema: (value) => value?.trim() ?? ''
	},
	AUTH_SECRET: {
		description: 'Random secret of at least 32 characters for encrypted sign-in sessions.',
		schema: (value) => value?.trim() ?? ''
	},
	PUBLIC_MAPBOX_ACCESS_TOKEN: {
		public: true,
		description: 'URL-restricted Mapbox public token for the homepage map.',
		schema: (value) => {
			const token = value?.trim() ?? '';
			if (token && !token.startsWith('pk.')) {
				throw new Error('PUBLIC_MAPBOX_ACCESS_TOKEN must be a public Mapbox token (pk.*).');
			}
			return token;
		}
	}
});
