<template>
    <div class="egress-board my-4 space-y-4">
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t(noteKey) }}</p>
            <p>{{ t('egress.Disclaimer') }}</p>
        </div>

        <div v-if="headline || tally.reachable" class="text-sm">
            <p v-if="headline" class="font-medium">{{ headline }}</p>
            <p class="text-muted-foreground">
                {{ t('egress.Summary', { ok: tally.reachable, paths: tally.pathCount, edges: tally.edgeCount }) }}
            </p>
        </div>

        <ul class="divide-y overflow-hidden rounded-lg border bg-card">
            <li v-for="row in rows" :key="row.id"
                class="keyboard-shortcut-card px-3 py-2">
                <div class="min-w-0 sm:grid sm:grid-cols-[9rem_11rem_minmax(0,1fr)] sm:items-center sm:gap-x-3">
                    <span class="block truncate text-sm" :title="row.url">
                        {{ row.name }}
                        <span v-if="showGroups && row.group" class="ml-1 text-xs text-muted-foreground">
                            {{ t('egress.Group', { n: row.group }) }}
                        </span>
                    </span>
                    <div class="mt-0.5 flex min-w-0 items-center gap-1.5 sm:mt-0">
                        <span class="relative flex shrink-0">
                            <span v-if="toneOf(row) === 'wait'"
                                class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
                            <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(row))"></span>
                        </span>
                        <span class="truncate font-mono text-sm" :title="ipLabel(row)" :class="textClass(toneOf(row))">{{ ipLabel(row) }}</span>
                    </div>
                    <p v-if="row.edge || row.org || row.country"
                        class="mb-0 mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground sm:mt-0 sm:text-sm">
                        <span v-if="row.host" class="truncate font-mono" :title="row.url">{{ row.host }}</span>
                        <template v-if="row.edge">
                            <span v-if="row.host" class="opacity-50">·</span>
                            <span class="truncate font-mono">{{ row.edge }}</span>
                        </template>
                        <template v-if="row.org">
                            <span v-if="row.host || row.edge" class="opacity-50">·</span>
                            <span class="truncate" :title="row.org">{{ row.org }}</span>
                        </template>
                        <template v-if="row.country">
                            <span v-if="row.host || row.edge || row.org" class="opacity-50">·</span>
                            <Icon v-if="row.country_code" :icon="'circle-flags:' + row.country_code.toLowerCase()"
                                class="size-3.5 shrink-0" />
                            <span class="truncate">{{ row.country }}</span>
                        </template>
                    </p>
                </div>
            </li>
        </ul>

        <div class="pt-1">
            <Button variant="action" :disabled="running" class="cursor-pointer" @click="run">
                <Spinner v-if="running" />
                <RotateCw v-else />
                {{ t('egress.RefreshAll') }}
            </Button>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { RotateCw } from '@lucide/vue';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMaxmind } from '@/composables/use-maxmind.js';
import { ipFieldTone, useStatusTone } from '@/composables/use-status-tone.js';
import getCountryName from '@/data/country-name.js';
import { EGRESS_SETS } from '@/data/egress-probes.js';
import { useMainStore } from '@/store';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import {
    EGRESS_CONCURRENCY,
    EGRESS_TIMEOUT_MS,
    assignGroups,
    interpretProbe,
    mapPool,
    summarizeEgress,
} from '@/utils/features/egress-probe.js';
import { isValidIP } from '@/utils/ip/valid-ip.js';

const NOTE_KEYS = {
    splittunnel: 'egress.NoteSplit',
    cdnlookup: 'egress.NoteCdn',
    multiegress: 'egress.NoteMulti',
};

const props = defineProps({
    setId: { type: String, required: true },
});

const { t } = useI18n();
const store = useMainStore();
const { lookupMaxmind } = useMaxmind();
const { dotClass, textClass } = useStatusTone();

const lang = computed(() => store.lang);
const noteKey = computed(() => NOTE_KEYS[props.setId] || 'egress.Disclaimer');
const probes = EGRESS_SETS[props.setId] || [];

const blankRow = (probe, status) => ({
    id: probe.id,
    name: probe.name,
    host: probe.host,
    url: probe.url,
    kind: probe.kind,
    optional: !!probe.optional,
    status,
    ip: '',
    edge: '',
    org: '',
    country: '',
    country_code: '',
    group: 0,
});

const rows = ref(probes.map((probe) => blankRow(probe, 'wait')));
const running = ref(false);

const tally = computed(() => summarizeEgress(rows.value.filter((row) => row.status === 'ok')));
const showGroups = computed(() => tally.value.pathCount > 1);
const headline = computed(() => {
    if (running.value || tally.value.reachable === 0) return '';
    if (tally.value.pathCount > 1) return t('egress.SplitExit', { paths: tally.value.pathCount });
    if (tally.value.pathCount === 1) return t('egress.SameExit');
    if (tally.value.edgeCount > 0) return t('egress.EdgeOnly', { edges: tally.value.edgeCount });
    return '';
});

const ipLabel = (row) => {
    if (row.status === 'wait') return t('egress.StatusWait');
    if (row.status === 'testing') return t('egress.StatusTesting');
    if (row.status === 'error') return t('egress.StatusError');
    if (row.status === 'skip') return t('egress.StatusSkip');
    return row.ip || row.edge || t('egress.StatusError');
};

const toneOf = (row) => ipFieldTone(ipLabel(row), {
    waitLabels: [t('egress.StatusWait'), t('egress.StatusTesting'), t('egress.StatusSkip')],
    errorLabels: t('egress.StatusError'),
    isSuccess: () => row.status === 'ok',
});

const probeOnce = async (row) => {
    try {
        const response = await fetchWithTimeout(row.url, {
            timeoutMs: EGRESS_TIMEOUT_MS,
            cache: 'no-store',
        });
        const body = await response.text();
        return interpretProbe(row.kind, body, response.headers, {
            optional: row.optional,
            ok: response.ok,
        });
    } catch {
        // A single public echo failing is normal (blocked, no IPv6, timeout).
        return interpretProbe(row.kind, '', null, { optional: row.optional, ok: false });
    }
};

// One retry: under a handful of parallel requests a reachable echo
// sometimes times out, and a single miss would look like a split.
const probeOne = async (row) => {
    const first = await probeOnce(row);
    if (first.status !== 'error') return first;
    return probeOnce(row);
};

const lookupGeo = async (ip) => {
    try {
        const fromMaxmind = await lookupMaxmind(ip);
        if (fromMaxmind && (fromMaxmind.org || fromMaxmind.country_code)) return fromMaxmind;
    } catch {
        // MaxMind is optional on a self-hosted install.
    }
    for (const path of ['/api/ipapicom', '/api/ipsb']) {
        try {
            const response = await fetchWithTimeout(`${path}?ip=${encodeURIComponent(ip)}`);
            if (!response.ok) continue;
            const data = await response.json();
            const country_code = String(data.country_code || '').trim();
            const org = data.org || '';
            if (!country_code && !org) continue;
            return {
                country_code,
                country: country_code ? getCountryName(country_code, lang.value) : '',
                org,
            };
        } catch {
            // Try the next public geo source.
        }
    }
    return null;
};

const run = async () => {
    if (running.value) return;
    running.value = true;
    rows.value = probes.map((probe) => blankRow(probe, 'testing'));
    try {
        await mapPool(rows.value, EGRESS_CONCURRENCY, async (row, index) => {
            const result = await probeOne(row);
            rows.value[index] = { ...rows.value[index], ...result };
            return result;
        });
        rows.value = assignGroups(rows.value);
        const ips = [...new Set(rows.value.map((row) => row.ip).filter((ip) => isValidIP(ip)))];
        await mapPool(ips, 4, async (ip) => {
            const geo = await lookupGeo(ip);
            if (!geo) return null;
            const country_code = (geo.country_code || '').toUpperCase();
            const country = country_code ? getCountryName(country_code, lang.value) : (geo.country || '');
            // In-place: concurrent lookups must not replace the whole array.
            for (const row of rows.value) {
                if (row.ip !== ip) continue;
                row.org = geo.org || '';
                row.country = country;
                row.country_code = country_code;
            }
            return geo;
        });
    } finally {
        running.value = false;
    }
};

watch(lang, () => {
    rows.value = rows.value.map((row) => (
        row.country_code
            ? { ...row, country: getCountryName(row.country_code, lang.value) }
            : row
    ));
});

onMounted(() => {
    setTimeout(() => { run(); }, 300);
});
</script>
