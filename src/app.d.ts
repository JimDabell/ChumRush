// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	const __CHUMRUSH_APP_ENV__: import('#lib/environment.ts').AppEnvironment;
	const __CHUMRUSH_APP_ORIGIN__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
