<script lang="ts">
	import { setParams } from '$lib/url';
	import { fmtDateTime, fmtKg } from '$lib/format';
	import DayPicker from '$lib/components/DayPicker.svelte';
	import CarrierIcon from '$lib/components/CarrierIcon.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Camera from '@lucide/svelte/icons/camera';
	import Mail from '@lucide/svelte/icons/mail';
	import Undo2 from '@lucide/svelte/icons/undo-2';

	let { data } = $props();
</script>

<div class="px-3 pt-3"><DayPicker value={data.date} onChange={(d) => setParams({ dzien: d })} /></div>

<ul class="flex flex-col gap-3 p-3">
	{#each data.shipments as s (s.id)}
		{@const withdrawn = s.orders.filter((o) => o.withdrawn).length}
		<li>
			<a href="/wydania/wydane/{s.id}" class="block rounded-2xl border border-line bg-surface p-4 active:bg-bg">
				<div class="flex items-start justify-between gap-2">
					<div>
						<p class="font-mono text-[15px] font-bold">{s.number}</p>
						<p class="flex items-center gap-1.5 font-semibold text-ink-2"><CarrierIcon kind={s.forwarder.kind} class="size-4" />{s.forwarder.name} · {s.dock}</p>
					</div>
					<ChevronRight class="mt-1 size-5 shrink-0 text-muted" />
				</div>
				<p class="mt-1 text-sm">{s.carriers} nośn. · {fmtKg(s.weightKg)} · {s.orders.length - withdrawn} zam. · auto <b class="font-mono">{s.driver.plate}</b></p>
				<div class="mt-2 flex flex-wrap gap-1.5">
					<Badge><Camera />{s.photos.length}</Badge>
					<Badge tone={s.emails.length ? 'ok' : 'neutral'}><Mail />{s.emails.length ? 'Wysłano' : 'Bez e-maila'}</Badge>
					{#if withdrawn}<Badge tone="warn"><Undo2 />Wycofano {withdrawn}</Badge>{/if}
				</div>
				<p class="mt-2 text-xs text-muted">{s.operator} · {fmtDateTime(s.closedAt)}</p>
			</a>
		</li>
	{:else}
		<li><Empty>Brak wydań w tym dniu</Empty></li>
	{/each}
</ul>
