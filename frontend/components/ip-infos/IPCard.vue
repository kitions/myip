<template>
    <!-- One source per row. The left bar marks domestic, international, or IPv6. -->
    <div data-screenshot-root
        class="ip-source-card keyboard-shortcut-card relative flex items-start gap-2 px-3 py-2 sm:items-center data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50"
        :style="{ '--lane': laneColor }">
        <div
            class="min-w-0 flex-1 sm:grid sm:grid-cols-[6.75rem_minmax(9rem,15rem)_minmax(0,1fr)] sm:items-center sm:gap-x-3">
            <span class="block truncate text-xs text-muted-foreground sm:text-sm">{{ card.source }}</span>

            <div v-if="hasIP" class="mt-0.5 flex items-center gap-1 min-w-0 sm:mt-0" :data-mask="maskAttr(card.ip)">
                <span class="font-mono text-sm font-medium tracking-tight break-all" :title="card.ip">{{ card.ip }}</span>
                <CopyButton :value="card.ip" :tooltip="t('Tooltips.CopyIP')" class="shrink-0 text-muted-foreground"
                    icon-class="size-3.5" :aria-label="'Copy ' + card.ip" />
            </div>
            <p v-else-if="isErrorState" class="mt-0.5 text-sm text-muted-foreground sm:col-span-2 sm:mt-0">{{ card.ip }}</p>
            <div v-else class="mt-1.5 h-4 w-36 max-w-full rounded bg-muted animate-pulse sm:col-span-2 sm:mt-0"></div>

            <IpDetailPanel v-if="hasGeo" dense :data="card" :index="index" :ip-geo-source="ipGeoSource"
                :asn-infos="asnInfos" :asn-history-infos="asnHistoryInfos"
                :asn-connectivity-infos="asnConnectivityInfos" :configs="configs" :is-dark-mode="isDarkMode" />
            <div v-else-if="hasIP" class="mt-1.5 h-3.5 w-48 max-w-full rounded bg-muted animate-pulse sm:mt-0"></div>
        </div>
        <div class="shrink-0" data-screenshot-exclude>
            <JnTooltip :text="t('Tooltips.RefreshIPCard')" side="left">
                <Button size="icon" variant="ghost" class="size-7 cursor-pointer text-muted-foreground"
                    @click="$emit('refresh-card', card, index)" :aria-label="'Refresh ' + card.source">
                    <RotateCw class="size-3.5" />
                </Button>
            </JnTooltip>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isValidIP } from '@/utils/ip/valid-ip.js';
import { createMaskGate } from '@/composables/use-info-mask.js';
import IpDetailPanel from './IpDetailPanel.vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import CopyButton from '@/components/widgets/CopyButton.vue';
import { RotateCw } from '@lucide/vue';

const { t } = useI18n();
// Skip the info-mask blur on the IPv4/IPv6 error placeholders (not a real IP).
const maskAttr = createMaskGate(t);

const props = defineProps({
    card: { type: Object, required: true },
    index: { type: Number, required: true },
    isDarkMode: { type: Boolean, required: true },
    isMobile: { type: Boolean, required: true },
    ipGeoSource: { type: Number, required: true },
    configs: { type: Object, required: true },
    asnInfos: { type: Object, required: true },
    asnHistoryInfos: { type: Object, default: () => ({}) },
    asnConnectivityInfos: { type: Object, default: () => ({}) }
});

defineEmits(['refresh-card']);

// Domestic echoes stay green, international echoes blue, the v6 card amber.
const laneColor = computed(() => {
    if (props.card.version === 'v6') return 'var(--warning)';
    if (props.card.id === 'cloudflare_v4' || props.card.id === 'ipinfo') return 'var(--info)';
    return 'var(--success)';
});

// The address paints as soon as the echo returns. Place waits on geo.
const hasIP = computed(() => isValidIP(props.card.ip));
const hasGeo = computed(() => Boolean(props.card.country_name || props.card.asn));
const isErrorState = computed(() =>
    props.card.ip === t('ipInfos.IPv4Error') || props.card.ip === t('ipInfos.IPv6Error')
);
</script>

<style scoped>
.ip-source-card::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 2px;
    background: var(--lane, var(--success));
}
</style>
