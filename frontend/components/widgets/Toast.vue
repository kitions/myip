<template>
    <!-- Toasts sit in the bottom-right corner (wrapper default) but *to the
         left* of the FAB column — stacked above them would vary with screen
         height, and only-offset-from-bottom wouldn't track the FAB column's
         shift on wide screens. The CSS rule below handles both. -->
    <Sonner />
</template>

<script setup>
import { computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { Sonner, toast } from '@/components/ui/sonner';

const store = useMainStore();
const alert = computed(() => store.alert);

// Map old alertStyle (Bootstrap text-* class names) to sonner methods
const STYLE_TO_TOAST = {
    'text-success': toast.success,
    'text-warning': toast.warning,
    'text-danger': toast.error,
    'text-info': toast.info,
};

// immediate: an alert raised before mount (a failed redirect sign-in at boot) shows too.
watch(alert, (newVal) => {
    if (!newVal || !newVal.alertToShow) {
        return;
    }
    const fn = STYLE_TO_TOAST[newVal.alertStyle] || toast.message;
    fn(newVal.alertTitle, {
        description: newVal.alertMessage,
        duration: newVal.alertDuration || 2000,
    });
}, { deep: true, immediate: true });
</script>

<!--
  Global (unscoped) because sonner renders its own root to document.body,
  so scoped styles wouldn't reach it.

  Positioning goal: Toast lives to the LEFT of the FAB column on every
  screen size, not above it. The FAB column sits 18px outside the content
  column (--content-max) and is 36px wide. Toasts sit another 10px left of that.

    right-offset = max(0, (viewport - var(--content-max)) / 2) + 66

  On narrow screens the offset clamps to 66px. If the FAB size changes, revisit it.
-->
<style>
[data-sonner-toaster] {
    right: calc(max(0px, (100vw - var(--content-max)) / 2) + 66px) !important;
}
</style>
