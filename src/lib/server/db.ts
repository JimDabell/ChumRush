import { setTimeout as delay } from 'node:timers/promises';
import {
	CreateTableCommand,
	DescribeTableCommand,
	DynamoDBClient,
	ResourceInUseException,
	ResourceNotFoundException,
	type TableDescription
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
	DYNAMODB_ACCESS_KEY_ID,
	DYNAMODB_ENDPOINT,
	DYNAMODB_PROFILES_TABLE,
	DYNAMODB_REGION,
	DYNAMODB_SECRET_ACCESS_KEY
} from '$app/env/private';

const INITIALIZATION_TIMEOUT_MS = 20_000;

interface ProfilesDatabase {
	client: DynamoDBDocumentClient;
	tableName: string;
	rawClient: DynamoDBClient;
	isLoopback: boolean;
}

let database: ProfilesDatabase | undefined;
let tableReady: Promise<void> | undefined;

function getDatabase(): ProfilesDatabase {
	if (database) return database;

	const endpoint = DYNAMODB_ENDPOINT ? new URL(DYNAMODB_ENDPOINT) : undefined;
	if (endpoint && !['http:', 'https:'].includes(endpoint.protocol)) {
		throw new Error('DYNAMODB_ENDPOINT must use HTTP or HTTPS.');
	}
	const hostname = endpoint?.hostname;
	const isLoopback =
		hostname === 'localhost' ||
		hostname === 'localhost.' ||
		hostname === '[::1]' ||
		(typeof hostname === 'string' && /^127\.\d+\.\d+\.\d+$/.test(hostname));
	const accessKeyId = DYNAMODB_ACCESS_KEY_ID;
	const secretAccessKey = DYNAMODB_SECRET_ACCESS_KEY;
	if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
		throw new Error('DynamoDB access key ID and secret access key must be configured together.');
	}
	const rawClient = new DynamoDBClient({
		...(endpoint ? { endpoint: endpoint.href } : {}),
		region: DYNAMODB_REGION,
		...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
		maxAttempts: 3,
		requestHandler: {
			connectionTimeout: 1_000,
			requestTimeout: 3_000,
			throwOnRequestTimeout: true
		}
	});
	database = {
		client: DynamoDBDocumentClient.from(rawClient),
		rawClient,
		tableName: DYNAMODB_PROFILES_TABLE,
		isLoopback
	};
	return database;
}

function validateKeySchema(table: TableDescription): void {
	const keys = table.KeySchema;
	if (
		keys?.length !== 1 ||
		keys[0].AttributeName !== 'stravaId' ||
		keys[0].KeyType !== 'HASH' ||
		!table.AttributeDefinitions?.some(
			(attribute) => attribute.AttributeName === 'stravaId' && attribute.AttributeType === 'N'
		)
	) {
		throw new Error('The profiles table must have only a numeric stravaId partition key.');
	}
}

async function ensureTable(db: ProfilesDatabase): Promise<void> {
	const abortSignal = AbortSignal.timeout(INITIALIZATION_TIMEOUT_MS);
	let creationRequested = false;

	while (true) {
		abortSignal.throwIfAborted();
		try {
			const { Table } = await db.rawClient.send(
				new DescribeTableCommand({ TableName: db.tableName }),
				{ abortSignal }
			);
			if (!Table) throw new Error('DynamoDB did not return a profiles table description.');
			validateKeySchema(Table);
			if (Table.TableStatus === 'ACTIVE') return;
		} catch (error) {
			if (!(error instanceof ResourceNotFoundException) || !db.isLoopback) throw error;
			if (!creationRequested) {
				try {
					await db.rawClient.send(
						new CreateTableCommand({
							TableName: db.tableName,
							KeySchema: [{ AttributeName: 'stravaId', KeyType: 'HASH' }],
							AttributeDefinitions: [{ AttributeName: 'stravaId', AttributeType: 'N' }],
							BillingMode: 'PAY_PER_REQUEST'
						}),
						{ abortSignal }
					);
				} catch (creationError) {
					if (!(creationError instanceof ResourceInUseException)) throw creationError;
				}
				creationRequested = true;
			}
		}
		await delay(250, undefined, { signal: abortSignal });
	}
}

/** Shared, lazy client; every caller waits for the same table initialization. */
export async function getProfilesTable(): Promise<{
	client: DynamoDBDocumentClient;
	tableName: string;
}> {
	const db = getDatabase();
	const initialization = (tableReady ??= ensureTable(db));
	try {
		await initialization;
	} catch (error) {
		if (tableReady === initialization) tableReady = undefined;
		throw error;
	}
	return { client: db.client, tableName: db.tableName };
}

/** Recheck on the next save after a database failure (including a restarted local container). */
export function invalidateProfilesTable(): void {
	tableReady = undefined;
}
