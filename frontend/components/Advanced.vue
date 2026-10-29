<template>
    <!-- Advanced Tools -->
    <section class="advanced-tools-section mb-6">
        <h2 id="AdvancedTools" class="m-0 mb-3 text-sm font-medium">
            {{ t('advancedtools.Title') }}
        </h2>

        <!-- One list per category. Each row is a real <a> to /tools/:slug:
             modified clicks stay the browser's, a plain click / Enter / Space routes in-app.
             data-adv-slug stays on the keyboard-shortcut-card (the "o" shortcut). -->
        <div class="space-y-4">
            <div v-for="group in cardGroups" :key="group.id">
                <h3 class="mb-1.5 text-xs font-normal text-muted-foreground">
                    {{ t(group.titleKey) }}
                </h3>
                <ul class="divide-y overflow-hidden rounded-lg border bg-card">
                    <li v-for="card in group.tools" :key="card.slug">
                        <a :href="`/tools/${card.slug}`"
                            :data-adv-slug="card.slug"
                            class="keyboard-shortcut-card flex items-baseline gap-3 px-3 py-2 no-underline text-inherit hover:bg-muted/50 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50"
                            @click="onCardClick($event, card.slug)"
                            @keydown.enter.prevent="openTool(card.slug)"
                            @keydown.space.prevent="openTool(card.slug)">
                            <span class="shrink-0 text-sm">{{ t(card.titleKey) }}</span>
                            <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground max-sm:hidden">{{ t(card.noteKey) }}</span>
                        </a>
                    </li>
                </ul>
            </div>
        </div>

        <!-- Section banner slot (data-driven; see InfoBanner.vue) -->
        <InfoBanner section="advanced" />
    </section>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { ADVANCED_TOOLS, groupToolsByCategory } from '@/data/tools.js';
import { listedTools } from '@/utils/tool-availability.js';
import { isPlainClick } from '@/utils/nav-target.js';
import InfoBanner from '@/components/widgets/InfoBanner.vue';

const { t } = useI18n();

const store = useMainStore();
const configs = computed(() => store.configs);
const router = useRouter();

// Card groups behind the deployment gates (original site / configs flag, see
// utils/tool-availability.js). Reactive on configs, so gated cards appear the
// moment configs land.
const cardGroups = computed(() => groupToolsByCategory(
    listedTools(ADVANCED_TOOLS, configs.value),
));

// Open a tool's page. Also the keyboard shortcuts' entry point (exposed below).
const openTool = (slug) => {
    router.push(`/tools/${slug}`);
    trackEvent('Nav', 'NavClick', slug);
};

const onCardClick = (e, slug) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    openTool(slug);
};

onMounted(() => {
    store.setMountingStatus('AdvancedTools', true);
});

defineExpose({
    openTool,
});

</script>
