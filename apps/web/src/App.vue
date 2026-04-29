<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter, RouterView } from "vue-router";
import zhCn from "element-plus/es/locale/lang/zh-cn";

const route = useRoute();
const router = useRouter();
const navOpen = ref(false);

const navItems = [
  { to: "/question-pressure", label: "问题压力", icon: "TrendCharts" },
  { to: "/feed", label: "Feed 浏览", icon: "Collection" },
  { to: "/health", label: "健康状态", icon: "FirstAidKit" },
];

const activePath = computed(() => {
  const match = navItems.find((item) => route.path.startsWith(item.to));
  return match?.to ?? "/question-pressure";
});

function go(path) {
  navOpen.value = false;
  router.push(path);
}
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div class="min-h-dvh bg-bg text-text">
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        class="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand/25 blur-3xl"
      />
      <div
        class="absolute -bottom-40 left-16 h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-3xl"
      />
      <div
        class="absolute -bottom-40 right-20 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl"
      />
    </div>

    <div class="mx-auto flex min-h-dvh w-full max-w-[1480px] gap-6 px-4 py-4">
      <aside
        class="hidden w-[280px] shrink-0 rounded-xl2 border border-white/10 bg-surface/70 shadow-bento backdrop-blur lg:block"
      >
        <div class="p-5">
          <div class="dt-font-display text-lg font-bold tracking-tight">
            DevTrend 控制台
          </div>
          <div class="mt-1 text-sm text-muted">
            只读信号浏览与调试
          </div>
        </div>

        <nav class="px-3 pb-3">
          <button
            v-for="item in navItems"
            :key="item.to"
            type="button"
            @click="go(item.to)"
            class="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition"
            :class="
              activePath === item.to
                ? 'bg-white/8 text-text'
                : 'text-muted hover:bg-white/6 hover:text-text'
            "
          >
            <span class="flex items-center gap-3">
              <component
                :is="item.icon"
                class="h-5 w-5 opacity-90 transition group-hover:opacity-100"
              />
              <span class="text-sm font-semibold">{{ item.label }}</span>
            </span>
            <ArrowRight
              class="h-4 w-4 opacity-0 transition group-hover:opacity-60"
            />
          </button>
        </nav>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <header
          class="flex items-center justify-between rounded-xl2 border border-white/10 bg-surface/70 px-3 py-3 shadow-bento backdrop-blur lg:px-4"
        >
          <div class="flex items-center gap-3">
            <el-button class="lg:hidden" circle @click="navOpen = true">
              <Menu class="h-4 w-4" />
            </el-button>
            <div class="min-w-0">
              <div class="dt-font-display truncate text-base font-bold">
                {{ route.meta?.title ?? "DevTrend 控制台" }}
              </div>
              <div class="truncate text-xs text-muted">
                {{ route.path }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div
              class="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted sm:flex"
            >
              <span class="dt-mono">API</span>
              <span class="h-1 w-1 rounded-full bg-brand/80" />
              <span class="dt-mono">/api</span>
            </div>
          </div>
        </header>

        <main class="min-w-0 flex-1">
          <RouterView />
        </main>
      </div>
    </div>

    <el-drawer v-model="navOpen" size="320px" direction="ltr">
      <template #header>
        <div class="dt-font-display text-base font-bold">DevTrend 控制台</div>
      </template>
      <div class="-mx-2 flex flex-col gap-1">
        <button
          v-for="item in navItems"
          :key="item.to"
          type="button"
          @click="go(item.to)"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
          :class="
            activePath === item.to
              ? 'bg-white/10 text-text'
              : 'text-muted hover:bg-white/6 hover:text-text'
          "
        >
          <component :is="item.icon" class="h-5 w-5 opacity-90" />
          <span class="text-sm font-semibold">{{ item.label }}</span>
        </button>
      </div>
    </el-drawer>
    </div>
  </el-config-provider>
</template>
