<template>
  <div ref="reactRootEl"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import React from 'react';
import { createRoot } from 'react-dom/client';
import MonthlyMeterNotebookReact from '../react/MonthlyMeterNotebookReact.jsx';

const emit = defineEmits(['synced']);
const reactRootEl = ref(null);
let rootInstance = null;

onMounted(() => {
  if (reactRootEl.value) {
    rootInstance = createRoot(reactRootEl.value);
    rootInstance.render(
      React.createElement(MonthlyMeterNotebookReact, {
        onSyncSuccess: () => emit('synced')
      })
    );
  }
});

onBeforeUnmount(() => {
  if (rootInstance) {
    rootInstance.unmount();
    rootInstance = null;
  }
});
</script>
