import { onMounted, ref } from "vue";

export function useAsyncState(factory, options = {}) {
  const data = ref(options.initial ?? null);
  const loading = ref(false);
  const error = ref(null);

  async function run() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await factory();
    } catch (failure) {
      error.value = failure instanceof Error ? failure : new Error(String(failure));
    } finally {
      loading.value = false;
    }
  }

  if (options.immediate !== false) {
    onMounted(() => {
      run();
    });
  }

  return { data, loading, error, run };
}

