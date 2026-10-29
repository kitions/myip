<template>
  <section class="mb-6">
    <header class="mb-3 flex items-center justify-between gap-3">
      <h2 id="WebRTC" class="m-0 text-sm font-medium">
        {{ t('webrtc.Title') }}
      </h2>
        <JnTooltip :text="t('Tooltips.RefreshWebRTC')" side="left">
          <Button size="icon" variant="ghost" class="size-7 shrink-0 cursor-pointer text-muted-foreground"
            @click="checkAllWebRTC(true)" aria-label="Refresh WebRTC Test">
            <component :is="isStarted ? RotateCw : Play" />
          </Button>
        </JnTooltip>
    </header>

    <ul class="divide-y overflow-hidden rounded-lg border bg-card">
      <li v-for="stun in stunServers" :key="stun.id"
        class="keyboard-shortcut-card px-3 py-2 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <Collapsible v-model:open="stun.sdpOpen">
          <div class="flex items-start gap-2 sm:items-center">
            <div class="min-w-0 flex-1 sm:grid sm:grid-cols-[13rem_11rem_minmax(0,1fr)] sm:items-center sm:gap-x-3">
              <span class="block truncate font-mono text-xs text-muted-foreground sm:text-sm" :title="stun.url">{{ stun.url }}</span>
              <div class="mt-0.5 flex min-w-0 items-center gap-1.5 sm:mt-0">
                <span class="relative flex shrink-0">
                  <span v-if="toneOf(stun) === 'wait'"
                    class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
                  <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(stun))"></span>
                </span>
                <span class="truncate font-mono text-sm" :title="stun.ip" :class="textClass(toneOf(stun))"
                  :data-mask="maskAttr(stun.ip)">{{ stun.ip }}</span>
              </div>
              <p v-if="shown(stun.natType) || shown(stun.org) || shown(stun.country)"
                class="mb-0 mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground sm:mt-0 sm:text-sm">
                <template v-if="shown(stun.natType)">{{ shown(stun.natType) }}</template>
                <template v-if="shown(stun.org)">
                  <span v-if="shown(stun.natType)" class="opacity-50">·</span>
                  <span class="truncate" :title="stun.org">{{ stun.org }}</span>
                </template>
                <template v-if="shown(stun.country)">
                  <span v-if="shown(stun.natType) || shown(stun.org)" class="opacity-50">·</span>
                  <Icon v-if="stun.country_code" :icon="'circle-flags:' + stun.country_code.toLowerCase()"
                    class="size-3.5 shrink-0" />
                  <span class="truncate">{{ stun.country }}</span>
                </template>
              </p>
            </div>
            <CollapsibleTrigger v-if="stun.sdpLog.length" as-child>
              <Button variant="ghost" size="icon"
                class="size-7 shrink-0 cursor-pointer text-muted-foreground"
                :aria-expanded="stun.sdpOpen" :aria-label="`${t('webrtc.SdpLog')} (${stun.sdpLog.length})`">
                <FileText class="size-3.5" />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent v-if="stun.sdpLog.length">
            <div class="relative mt-2">
              <pre
                class="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 pr-8 font-mono text-xs leading-relaxed">{{ stun.sdpLog.join('\n') }}</pre>
              <CopyButton :value="() => stun.sdpLog.join('\n')" :tooltip="t('Tooltips.CopySdpLog')"
                class="absolute top-1.5 right-1.5" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </li>
    </ul>

    <!-- Section banner slot (data-driven; see InfoBanner.vue) -->
    <InfoBanner section="webrtc" :settled="hasEverSettled" />
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, reactive, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent, waitForAppEvent } from '@/utils/app-events';
import { useAppCommand } from '@/composables/use-app-command.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useStatusTone, ipFieldTone, isFieldPending as isFieldPendingShared } from '@/composables/use-status-tone.js';
import { createMaskGate } from '@/composables/use-info-mask.js';
import { useMaxmind } from '@/composables/use-maxmind.js';
import { Play, RotateCw, FileText } from '@lucide/vue';
import { Icon } from '@iconify/vue';
import CopyButton from '@/components/widgets/CopyButton.vue';
import InfoBanner from '@/components/widgets/InfoBanner.vue';

const { t } = useI18n();
const store = useMainStore();
// Skip the info-mask blur on waiting/error placeholders (not a real IP).
const maskAttr = createMaskGate(t);
const { dotClass, textClass } = useStatusTone();
const { lookupMaxmind } = useMaxmind();

const isStarted = ref(false);
// Sticky settled flag for the section's banner slot: true once a full STUN
// pass finishes (including the WebRTC-unavailable path).
const hasEverSettled = ref(false);
const IPArray = ref([]);
const stunServers = reactive([
  { id: 'google', url: 'stun.l.google.com:19302', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '', org: t('webrtc.StatusWait'), sdpLog: [], sdpOpen: false },
  { id: 'blackberry', url: 'stun.voip.blackberry.com:3478', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '', org: t('webrtc.StatusWait'), sdpLog: [], sdpOpen: false },
  { id: 'twilio', url: 'global.stun.twilio.com', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '', org: t('webrtc.StatusWait'), sdpLog: [], sdpOpen: false },
  { id: 'cloudflare', url: 'stun.cloudflare.com', ip: t('webrtc.StatusWait'), natType: t('webrtc.StatusWait'), country: t('webrtc.StatusWait'), country_code: '', org: t('webrtc.StatusWait'), sdpLog: [], sdpOpen: false },
]);

// Regex extracting the IP portion out of an ICE candidate line
// (full SDP grammar not needed — just IPv4 / IPv6 with common forms).
const CANDIDATE_IP_RE = /([0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}|[0-9a-f]{0,4}(:[0-9a-f]{1,4}){0,6}::[0-9a-f]{0,4}|::[0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}|[0-9]{1,3}(\.[0-9]{1,3}){3})/i;

// Track in-flight RTCPeerConnections so they can all be closed on unmount.
// Without this, navigating away mid-test would leave each pc (and its
// ICE gathering machinery) lingering until GC. Entries are added when
// the connection is created and removed once it's closed.
const activeConnections = new Set();

// WebRTC can be absent entirely: privacy-hardened browsers.
const isWebRtcAvailable = typeof RTCPeerConnection === 'function';

// Business status → 4 tone levels. "WebRTC unavailable" renders green on
// purpose: for a leak test, a browser with WebRTC disabled is a protective
// state (same visual language as InfoMask), not an error.
const toneOf = (stun) => stun.ip === t('webrtc.StatusUnavailable')
  ? 'ok-fast'
  : ipFieldTone(stun.ip, {
    waitLabels: [t('webrtc.StatusWait'), t('webrtc.StatusTesting')],
    errorLabels: t('webrtc.StatusError'),
  });

// Single field in dl block is in "no data" state (waiting/error).
// Fields may fail independently (e.g. IP success but country lookup fails),
// so the check is run per-field in the template.
const isFieldPending = (value) => isFieldPendingShared(value, {
  waitLabels: [t('webrtc.StatusWait'), t('webrtc.StatusTesting')],
  errorLabels: [t('webrtc.StatusError'), t('webrtc.StatusUnavailable')],
});

// Resolved fields only; waiting and error placeholders stay off the summary line.
const shown = (value) => (value && !isFieldPending(value) ? value : '');

// Run a STUN test against one server. ICE gathering with a 5s backstop.
//
// Success criteria: receive a server-reflexive ('srflx') or peer-reflexive
// ('prflx') candidate with an extractable IP. That IP is what the STUN
// server reported; host candidates don't prove STUN worked (the browser
// emits them regardless) and must not be shown as the "STUN IP".
//
// Any non-success path — 5s elapsed without srflx / prflx, or an
// unexpected throw in the try/catch — collapses to StatusError.
// Distinguishing "timeout" vs "mDNS privacy" looks tempting but the
// two conditions are independent (mDNS privacy can be on while STUN
// still works via srflx, and vice versa), so a split label produces
// false positives — we deliberately stay vague here.
const checkSTUNServer = (stun) => {
  return new Promise((resolve) => {
    let pc = null;
    let timer = null;
    let settled = false;

    // Event log helper: every line is prefixed with a millisecond offset
    // from the start of this server's test, so the log reads as a timeline.
    // `stun.sdpLog` is reset to a fresh reactive array (rather than length=0)
    // so the panel scroll position resets cleanly between runs.
    const startTime = performance.now();
    stun.sdpLog = [];
    stun.sdpOpen = false;
    const log = (msg) => {
      const ts = Math.round(performance.now() - startTime).toString().padStart(4, ' ');
      stun.sdpLog.push(`[+${ts}ms] ${msg}`);
    };

    const finish = () => {
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (pc) {
        pc.close();
        activeConnections.delete(pc);
      }
      resolve();
    };

    const failWith = (statusKey) => {
      if (settled) return;
      const label = t(`webrtc.${statusKey}`);
      stun.ip = label;
      stun.natType = label;
      // Locale-free twin of the label, consumed by the report builder.
      stun.natTypeCode = statusKey === 'StatusUnavailable' ? 'unavailable' : 'error';
      stun.country = label;
      stun.country_code = '';
      stun.org = label;
      log(`status: ${statusKey}`);
      finish();
    };

    const succeedWith = async (ip, candidate) => {
      if (settled) return;
      // Mark settled now so a late candidate can't double-resolve,
      // but keep pc / timer alive until the country lookup returns.
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      stun.ip = ip;
      stun.natType = determineNATType(candidate);
      stun.natTypeCode = natTypeCodeOf(candidate);
      log(`resolved IP: ${ip}`);
      IPArray.value = [...IPArray.value, { ip, country: '' }];
      // useMaxmind swallows its own errors and returns null on miss, so
      // a single null check handles both "no MaxMind source" and "upstream
      // failure" paths.
      const geo = await lookupMaxmind(ip);
      if (geo) {
        stun.country_code = geo.country_code;
        stun.country = geo.country;
        stun.org = geo.org;
        // Back-fill details for the Globalping picker + IP history.
        IPArray.value = [...IPArray.value, { ip, country: geo.country_code, location: geo.country, asn: geo.asn, org: geo.org }];
      } else {
        stun.country = t('webrtc.StatusError');
        stun.org = t('webrtc.StatusError');
      }
      if (pc) {
        pc.close();
        activeConnections.delete(pc);
      }
      resolve();
    };

    try {
      log(`new RTCPeerConnection -> stun:${stun.url}`);
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:' + stun.url }] });

      // Privacy extensions may swap RTCPeerConnection for a stub that
      // constructs fine but lacks the real API surface — the same finding
      // as a blocked constructor: WebRTC is blocked, not broken. Drop the
      // stub without close() (it may not have one) before failing.
      if (typeof pc.createDataChannel !== 'function' || typeof pc.createOffer !== 'function') {
        log('stubbed RTCPeerConnection: createDataChannel/createOffer missing');
        pc = null;
        failWith('StatusUnavailable');
        return;
      }
      activeConnections.add(pc);

      pc.onicegatheringstatechange = () => {
        if (pc) log(`iceGatheringState: ${pc.iceGatheringState}`);
      };

      // `RTCIceCandidate` errors fire when STUN/TURN signalling fails
      // (host unreachable, auth issues). They don't terminate the
      // connection on their own, but they're highly informative for
      // debugging "why did this STUN never answer" cases.
      pc.onicecandidateerror = (event) => {
        log(`iceCandidateError: ${event.errorCode || ''} ${event.errorText || ''} url=${event.url || ''}`.trim());
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          log('candidate: (end-of-candidates)');
          return;
        }
        const candidate = event.candidate.candidate;
        log(`candidate: ${candidate}`);
        if (settled) return;
        const type = candidate.split(' ')[7];

        // Only server-reflexive / peer-reflexive candidates represent a
        // STUN answer. Host candidates (with or without mDNS) don't prove
        // STUN worked and we must not display them as the "STUN IP".
        if (type !== 'srflx' && type !== 'prflx') return;

        const ipMatch = CANDIDATE_IP_RE.exec(candidate);
        if (!ipMatch) return;
        succeedWith(ipMatch[0], candidate);
      };

      pc.createDataChannel('');
      pc.createOffer().then((offer) => {
        // Offer SDP is multi-line; record it as a single block so the
        // Collapsible <pre> renders it verbatim.
        log(`createOffer ok\n--- Offer SDP ---\n${offer.sdp}--- end SDP ---`);
        return pc.setLocalDescription(offer);
      }).then(() => {
        log('setLocalDescription ok');
      }).catch((error) => {
        log(`offer/setLocalDescription failed: ${error?.message || error}`);
      });

      timer = setTimeout(() => {
        timer = null;
        failWith('StatusError');
      }, 5000);
    } catch (error) {
      // Some browsers ship the constructor but forbid construction —
      // NotAllowedError (permissions policy), NotSupportedError (Chromium
      // with WebRTC disabled) — and privacy extensions replace it with a
      // non-constructable stub that passes the `typeof` check above. All
      // are the runtime sibling of the missing-API case: a finding, not
      // an error.
      const constructionBlocked = error?.name === 'NotAllowedError'
        || error?.name === 'NotSupportedError'
        || (error instanceof TypeError && /not a constructor/i.test(error?.message || ''));
      if (constructionBlocked) {
        log(`construction blocked: ${error?.message || error}`);
        failWith('StatusUnavailable');
        return;
      }
      console.error('STUN Server Test Error:', error);
      log(`exception: ${error?.message || error}`);
      failWith('StatusError');
    }
  });
};

// Analyze ICE candidate information, infer NAT type
const determineNATType = (candidate) => {
  const parts = candidate.split(' ');
  const type = parts[7];
  if (type === 'host') return t('webrtc.NATType.host');
  if (type === 'srflx') return t('webrtc.NATType.srflx');
  if (type === 'prflx') return t('webrtc.NATType.prflx');
  if (type === 'relay') return t('webrtc.NATType.relay');
  return t('webrtc.NATType.unknown');
};

// Locale-free twin of determineNATType for the report builder.
const natTypeCodeOf = (candidate) => {
  const type = candidate.split(' ')[7];
  return ['host', 'srflx', 'prflx', 'relay'].includes(type) ? type : 'unknown';
};

// Domain event: snapshot of all STUN cards for the report collector (servers
// still waiting carry no natTypeCode and are dropped by the builder).
const emitWebrtcFinished = () => {
  hasEverSettled.value = true;
  emitAppEvent('webrtc:finished', {
    servers: stunServers.map((server) => ({
      id: server.id,
      url: server.url,
      ip: server.ip,
      natTypeCode: server.natTypeCode,
      country_code: server.country_code,
      org: server.org,
    })),
  });
};

// Test all STUN servers
const checkAllWebRTC = async (isRefresh) => {
  if (isRefresh) trackEvent('Section', 'RefreshClick', 'WebRTC');
  isStarted.value = true;

  // No WebRTC in this browser: mark every card with the dedicated state
  // (dl detail fields render as "—" via isFieldPending) and finish the
  // section immediately.
  if (!isWebRtcAvailable) {
    const label = t('webrtc.StatusUnavailable');
    stunServers.forEach((server) => {
      server.ip = label;
      server.natType = label;
      server.natTypeCode = 'unavailable';
      server.country = label;
      server.country_code = '';
      server.org = label;
    });
    store.setLoadingStatus('WebRTC', true);
    emitWebrtcFinished();
    return;
  }

  const promises = stunServers.map((server) => {
    server.ip = t('webrtc.StatusTesting');
    server.natType = t('webrtc.StatusTesting');
    server.natTypeCode = undefined;
    server.country = t('webrtc.StatusTesting');
    server.country_code = '';
    server.org = t('webrtc.StatusTesting');
    return checkSTUNServer(server);
  });

  const allSettledPromise = Promise.allSettled(promises);
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6000));
  return Promise.race([allSettledPromise, timeoutPromise]).then(() => {
    store.setLoadingStatus('WebRTC', true);
    emitWebrtcFinished();
  });
};

// Command owner: run all STUN checks. Resolves with the next webrtc:finished
// snapshot (also emitted when WebRTC is unavailable in this browser).
useAppCommand('webrtc:run', ({ isRefresh = false } = {}) => {
  const finished = waitForAppEvent('webrtc:finished');
  checkAllWebRTC(isRefresh);
  return finished;
});

onMounted(() => {
  store.setMountingStatus('WebRTC', true);
});

// Close any still-open peer connections if the component unmounts
// mid-test — otherwise ICE gathering keeps running for seconds and
// callbacks fire on refs that no longer exist.
onBeforeUnmount(() => {
  activeConnections.forEach((pc) => pc.close());
  activeConnections.clear();
});

watch(IPArray, () => {
  store.updateAllIPs(IPArray.value);
}, { deep: true });
</script>
