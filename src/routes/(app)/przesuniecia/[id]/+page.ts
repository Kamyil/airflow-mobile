import { getTransfer } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => ({ transfer: await getTransfer(params.id) });
