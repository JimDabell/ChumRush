import { resolveDeployment } from '#lib/environment.ts';

export const deployment = resolveDeployment(__CHUMRUSH_APP_ENV__, __CHUMRUSH_APP_ORIGIN__);
