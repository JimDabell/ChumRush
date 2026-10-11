import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getProfilesTable, invalidateProfilesTable } from '#lib/server/db.ts';
import type { StravaProfile } from '#lib/server/profiles/profile.ts';

/** Returns false only when the stored public profile is already identical. */
export async function saveProfile(profile: StravaProfile): Promise<boolean> {
	// Allowlist fields so even structurally compatible objects cannot persist OAuth tokens.
	const publicProfile: StravaProfile = {
		id: profile.id,
		firstName: profile.firstName,
		lastName: profile.lastName,
		username: profile.username,
		bio: profile.bio,
		city: profile.city,
		state: profile.state,
		country: profile.country,
		profile: profile.profile,
		profileMedium: profile.profileMedium
	};
	const { client, tableName } = await getProfilesTable();
	const now = new Date().toISOString();

	try {
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { stravaId: publicProfile.id },
				UpdateExpression:
					'SET #profile = :profile, #createdAt = if_not_exists(#createdAt, :now), #updatedAt = :now',
				ConditionExpression: 'attribute_not_exists(#profile) OR #profile <> :profile',
				ExpressionAttributeNames: {
					'#profile': 'profile',
					'#createdAt': 'createdAt',
					'#updatedAt': 'updatedAt'
				},
				ExpressionAttributeValues: { ':profile': publicProfile, ':now': now }
			}),
			{ abortSignal: AbortSignal.timeout(5_000) }
		);
		return true;
	} catch (error) {
		if (error instanceof ConditionalCheckFailedException) return false;
		invalidateProfilesTable();
		throw error;
	}
}
