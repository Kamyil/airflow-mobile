import { error } from '@sveltejs/kit';
import { getInventory } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	let inventory = await getInventory(params.id);
	let location = inventory.locations.find((l) => l.code === params.loc);
	if (!location) error(404, 'Lokalizacja nie należy do tej inwentaryzacji');
	return { inventory, location };
};
