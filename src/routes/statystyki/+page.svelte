<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	/** Statystyki konta testowego (logowania + wejścia na ekrany). Strona tylko dla konta wewnętrznego. */
	let { data } = $props();
	let stats = $derived(data.stats);

	// /(app)/dostawy/(listy)/w-trakcie -> /dostawy/w-trakcie
	const screenName = (id: string) => id.replace(/\/\([^)]*\)/g, '') || '/';

	let days = $derived(
		stats ? [...new Set([...Object.keys(stats.logins), ...Object.keys(stats.viewDays)])].sort().reverse().slice(0, 30) : []
	);
	let totalLogins = $derived(stats ? Object.values(stats.logins).reduce((a, b) => a + b, 0) : 0);
	let totalViews = $derived(stats ? Object.values(stats.viewDays).reduce((a, b) => a + b, 0) : 0);
	let screens = $derived(stats ? Object.entries(stats.views).sort((a, b) => b[1] - a[1]) : []);
	let topScreen = $derived(screens[0]?.[1] ?? 1);

	const time = (t: number) =>
		new Date(t).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

	// skrót user-agenta: urządzenie / przeglądarka
	const device = (ua = '') =>
		[/Android[^;)]*/.exec(ua)?.[0] ?? /iPhone|iPad|Macintosh|Windows/.exec(ua)?.[0], /Chrome|Firefox|Safari|Edg/.exec(ua)?.[0]].filter(Boolean).join(' · ') || ua.slice(0, 40);
</script>

<svelte:head><title>Statystyki · Airflow Magazyn</title></svelte:head>

<main class="mx-auto min-h-dvh w-full max-w-md bg-bg">
	<header class="pt-safe bg-ink px-2 text-white">
		<div class="flex min-h-16 items-center gap-1">
			<a href="/" class="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Wróć"><ArrowLeft class="size-6" /></a>
			<div>
				<h1 class="text-lg font-extrabold">Statystyki</h1>
				<p class="text-xs text-white/65">Konto <b class="font-mono">test</b> · tylko do wglądu wewnętrznego</p>
			</div>
		</div>
	</header>

	<div class="flex flex-col gap-3 p-4">
		{#if !data.enabled || !stats}
			<p class="flex items-start gap-2 rounded-2xl bg-warn-soft p-4 text-sm font-semibold text-warn">
				<TriangleAlert class="mt-0.5 size-4 shrink-0" />
				{data.enabled ? 'Nie udało się pobrać statystyk z Redisa.' : 'Brak skonfigurowanego Upstash Redis (KV_REST_API_URL / KV_REST_API_TOKEN) – statystyki nie są zbierane.'}
			</p>
		{:else}
			<div class="grid grid-cols-2 gap-3">
				<div class="rounded-2xl bg-surface p-4 ring-1 ring-line">
					<p class="text-xs font-bold tracking-wide text-muted uppercase">Logowania</p>
					<p class="mt-1 font-mono text-3xl font-extrabold">{totalLogins}</p>
				</div>
				<div class="rounded-2xl bg-surface p-4 ring-1 ring-line">
					<p class="text-xs font-bold tracking-wide text-muted uppercase">Wejścia na ekrany</p>
					<p class="mt-1 font-mono text-3xl font-extrabold">{totalViews}</p>
				</div>
			</div>

			<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
				<h2 class="font-extrabold">Dzień po dniu</h2>
				{#if days.length}
					<table class="mt-2 w-full text-sm">
						<thead class="text-left text-xs text-muted">
							<tr><th class="py-1 font-semibold">Dzień</th><th class="py-1 text-right font-semibold">Logowania</th><th class="py-1 text-right font-semibold">Wejścia</th></tr>
						</thead>
						<tbody class="font-mono">
							{#each days as d (d)}
								<tr class="border-t border-line">
									<td class="py-1.5">{d}</td>
									<td class="py-1.5 text-right">{stats.logins[d] ?? 0}</td>
									<td class="py-1.5 text-right">{stats.viewDays[d] ?? 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="mt-2 text-sm text-muted">Jeszcze nikt się nie zalogował.</p>
				{/if}
			</section>

			<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
				<h2 class="font-extrabold">Ekrany</h2>
				{#if screens.length}
					<ul class="mt-2 flex flex-col gap-2">
						{#each screens as [id, n] (id)}
							<li class="text-sm">
								<div class="flex justify-between gap-2"><span class="truncate font-mono">{screenName(id)}</span><b class="font-mono">{n}</b></div>
								<div class="mt-1 h-1.5 rounded-full bg-line"><div class="h-full rounded-full bg-task" style:width="{(n / topScreen) * 100}%"></div></div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-2 text-sm text-muted">Brak wejść.</p>
				{/if}
			</section>

			<section class="rounded-2xl bg-surface p-4 ring-1 ring-line">
				<h2 class="font-extrabold">Ostatnie zdarzenia</h2>
				{#if stats.log.length}
					<ul class="mt-2 flex flex-col text-sm">
						{#each stats.log as ev, i (i)}
							<li class="flex gap-3 border-t border-line py-1.5 first:border-0">
								<span class="shrink-0 font-mono text-muted">{time(ev.t)}</span>
								{#if ev.type === 'login'}
									<span class="min-w-0 truncate"><b>Logowanie</b> <span class="text-muted">{device(ev.ua)}</span></span>
								{:else}
									<span class="min-w-0 truncate font-mono">{screenName(ev.screen ?? '')}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-2 text-sm text-muted">Brak zdarzeń.</p>
				{/if}
			</section>
		{/if}
	</div>
</main>
