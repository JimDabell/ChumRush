import { defineEnvVars } from '@sveltejs/kit/env';

function required(name: string) {
	return (value: string | undefined): string => {
		const configured = value?.trim();
		if (!configured) throw new Error(`${name} must be set.`);
		return configured;
	};
}

export const variables = defineEnvVars({
	DYNAMODB_ENDPOINT: {
		description: 'Optional DynamoDB endpoint; local development uses the Compose service.',
		schema: (value) => value?.trim() ?? ''
	},
	DYNAMODB_REGION: {
		description: 'AWS region used to sign DynamoDB requests.',
		schema: required('DYNAMODB_REGION')
	},
	DYNAMODB_ACCESS_KEY_ID: {
		description: 'Optional DynamoDB access key; omit it to use the AWS credential chain.',
		schema: (value) => value?.trim() ?? ''
	},
	DYNAMODB_SECRET_ACCESS_KEY: {
		description: 'Optional private DynamoDB credential paired with the access key.',
		schema: (value) => value?.trim() ?? ''
	},
	DYNAMODB_PROFILES_TABLE: {
		description: 'Environment-specific table for Strava profiles.',
		schema: required('DYNAMODB_PROFILES_TABLE')
	},
	STRAVA_CLIENT_ID: {
		description: 'Strava API application client ID.',
		schema: (value) => value?.trim() ?? ''
	},
	STRAVA_CLIENT_SECRET: {
		description: 'Private Strava OAuth client secret.',
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
