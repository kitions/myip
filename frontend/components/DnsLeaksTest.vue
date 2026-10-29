<template>
  <!-- DNS Leak Test -->
  <section class="mb-6">
    <header class="mb-3 flex items-center justify-between gap-3">
      <h2 id="DNSLeakTest" class="m-0 text-sm font-medium">
        {{ t('dnsleaktest.Title') }}
      </h2>
        <JnTooltip :text="t('Tooltips.RefreshDNSLeakTest')" side="left">
          <Button size="icon" variant="ghost" class="size-7 shrink-0 cursor-pointer text-muted-foreground"
            @click="checkAllDNSLeakTest(true)" aria-label="Refresh DNS Leak Test">
            <component :is="isStarted ? RotateCw : Play" />
          </Button>
        </JnTooltip>
    </header>

    <ul class="divide-y overflow-hidden rounded-lg border bg-card">
      <li v-for="leak in leakTest" :key="leak.slot"
        class="keyboard-shortcut-card px-3 py-2 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <div class="min-w-0 sm:grid sm:grid-cols-[9rem_11rem_minmax(0,1fr)] sm:items-center sm:gap-x-3">
          <span class="block truncate text-xs text-muted-foreground sm:text-sm" :title="leak.providerName || leak.name">
            {{ leak.providerName || leak.name }}
          </span>
          <div class="mt-0.5 flex min-w-0 items-center gap-1.5 sm:mt-0">
            <span class="relative flex shrink-0">
              <span v-if="toneOf(leak) === 'wait'"
                class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
              <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(leak))"></span>
            </span>
            <span class="truncate font-mono text-sm" :title="leak.ip" :class="textClass(toneOf(leak))"
              :data-mask="maskAttr(leak.ip)">{{ leak.ip }}</span>
          </div>
          <p v-if="!isFieldPending(leak.org) || !isFieldPending(leak.country)"
            class="mb-0 mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground sm:mt-0 sm:text-sm">
            <span v-if="!isFieldPending(leak.org)" class="truncate" :title="leak.org">{{ leak.org }}</span>
            <template v-if="!isFieldPending(leak.country)">
              <span v-if="!isFieldPending(leak.org)" class="opacity-50">·</span>
              <Icon v-if="leak.country_code" :icon="'circle-flags:' + leak.country_code.toLowerCase()"
                class="size-3.5 shrink-0" />
              <span class="truncate">{{ leak.country }}</span>
            </template>
          </p>
        </div>
      </li>
    </ul>

    <!-- Section banner slot (data-driven; see InfoBanner.vue); settled once
         the homepage test has resolved (success or timeout). -->
    <InfoBanner section="dnsleak" :settled="hasEverSettled" />
  </section>
</template>


<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent, waitForAppEvent } from '@/utils/app-events';
import { useAppCommand } from '@/composables/use-app-command.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useStatusTone, ipFieldTone, isFieldPending as isFieldPendingShared } from '@/composables/use-status-tone.js';
import { createMaskGate } from '@/composables/use-info-mask.js';
import { useMaxmind } from '@/composables/use-maxmind.js';
import { Play, RotateCw } from '@lucide/vue';
import { Icon } from '@iconify/vue';
import InfoBanner from '@/components/widgets/InfoBanner.vue';
import {
  ipApi, bashws, myipstack, fastly, browserleaks, surfshark, ipleak, every1dns,
  createDnsLeakRunner,
} from '@/utils/dnsleaks';

// All providers in priority order: the first SLOT_COUNT hold a card each,
// the rest are standbys. New provider = file under utils/dnsleaks + append.
const PROVIDERS = [ipApi, every1dns, myipstack, fastly, surfshark, bashws, browserleaks, ipleak];
const SLOT_COUNT = 4;
const ACTIVE = PROVIDERS.slice(0, SLOT_COUNT);


const { t } = useI18n();
const store = useMainStore();
const { lookupMaxmind } = useMaxmind();
// Skip the info-mask blur on waiting/error placeholders (not a real IP).
const maskAttr = createMaskGate(t);
const isStarted = ref(false);
// Sticky settled flag for the section's banner slot.
const hasEverSettled = ref(false);
let runId = 0;

const { dotClass, textClass } = useStatusTone();

// Business status → 4 tone levels
const toneOf = (leak) => ipFieldTone(leak.ip, {
  waitLabels: [t('dnsleaktest.StatusWait'), t('dnsleaktest.StatusTesting')],
  errorLabels: t('dnsleaktest.StatusError'),
});


// Status
const isFieldPending = (value) => isFieldPendingShared(value, {
  waitLabels: [t('dnsleaktest.StatusWait'), t('dnsleaktest.StatusTesting')],
  errorLabels: t('dnsleaktest.StatusError'),
});

const createDefaultCard = () => ({
  name: t('dnsleaktest.Name'),
  country_code: '',
  country: t('dnsleaktest.StatusWait'),
  ip: t('dnsleaktest.StatusWait'),
  org: t('dnsleaktest.StatusWait'),
});

// `slot` is the card's stable key; `id` / `providerName` follow the
// provider that actually answered.
const leakTest = reactive(ACTIVE.map((p) => ({
  ...createDefaultCard(),
  slot: p.id,
  id: p.id,
  providerName: p.name,
})));

// Apply MaxMind lookup to a card that already has a resolved leak IP.
const applyMaxMindGeo = async (index, ip, currentRun) => {
  const geo = await lookupMaxmind(ip);
  if (currentRun !== runId) return;
  if (geo) {
    leakTest[index].country_code = geo.country_code;
    leakTest[index].country = geo.country;
    leakTest[index].org = geo.org;
    return;
  }
  leakTest[index].country = t('dnsleaktest.StatusError');
  leakTest[index].country_code = '';
  leakTest[index].org = t('dnsleaktest.StatusError');
};

const markLeakCardError = (index) => {
  leakTest[index].ip = t('dnsleaktest.StatusError');
  leakTest[index].country = t('dnsleaktest.StatusError');
  leakTest[index].country_code = '';
  leakTest[index].org = t('dnsleaktest.StatusError');
};

// Run one slot through its fallback chain (see utils/dnsleaks); the card
// flips to error only when the whole chain fails.
const runProvider = async (index, run, currentRun) => {
  if (currentRun !== runId) return;
  try {
    const { ip, provider } = await run(index);
    if (currentRun !== runId) return;
    leakTest[index].id = provider.id;
    leakTest[index].providerName = provider.name;
    leakTest[index].ip = ip;
    await applyMaxMindGeo(index, ip, currentRun);
  } catch (error) {
    if (currentRun !== runId) return;
    console.error('Error fetching leak test data:', error);
    markLeakCardError(index);
  }
};

// Check all. Staggers startup by 200ms per provider to avoid a thundering-
// herd on first paint.
const checkAllDNSLeakTest = async (isRefresh) => {
  const currentRun = ++runId;
  const run = createDnsLeakRunner(PROVIDERS, SLOT_COUNT);
  isStarted.value = true;
  if (isRefresh) trackEvent('Section', 'RefreshClick', 'DNSLeakTest');
  // Every run starts from the primary provider and "Testing…" — on boot
  // this is a no-op for the slot, on refresh it drops the fallback result.
  leakTest.forEach((server, index) => {
    server.id = ACTIVE[index].id;
    server.providerName = ACTIVE[index].name;
    server.ip = t('dnsleaktest.StatusTesting');
    server.country = t('dnsleaktest.StatusTesting');
    server.country_code = '';
    server.org = t('dnsleaktest.StatusTesting');
  });

  const delayedRun = (index, delay) => new Promise((resolve) => {
    setTimeout(() => {
      runProvider(index, run, currentRun).then(resolve, resolve);
    }, delay);
  });

  const promises = ACTIVE.map((_, index) => delayedRun(index, index * 200));

  const allSettledPromise = Promise.allSettled(promises);
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6000));

  return Promise.race([allSettledPromise, timeoutPromise]).then(() => {
    if (currentRun !== runId) return;
    store.setLoadingStatus('DNSLeakTest', true);
    // Local sticky flag for the Enhanced DNS Leak Test banner
    hasEverSettled.value = true;
    // Domain event: snapshot for the report collector (cards whose ip slot
    // still holds a wait/error label are dropped by the builder).
    emitAppEvent('dnsleak:finished', {
      providers: leakTest.map((card) => ({
        id: card.id,
        name: card.providerName,
        ip: card.ip,
        country_code: card.country_code,
        org: card.org,
      })),
    });
  });
};

// Command owner: run all leak providers. Resolves with the next
// dnsleak:finished snapshot.
useAppCommand('dnsleak:run', ({ isRefresh = false } = {}) => {
  const finished = waitForAppEvent('dnsleak:finished');
  checkAllDNSLeakTest(isRefresh);
  return finished;
});

onMounted(() => {
  store.setMountingStatus('DNSLeakTest', true);
});
</script>
