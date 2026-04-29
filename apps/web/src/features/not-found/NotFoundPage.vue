<script setup>
import { useRouter } from "vue-router";
import EmptyState from "@/shared/ui/EmptyState.vue";

const router = useRouter();

function goHome() {
  router.push({ name: "question-pressure" });
}
</script>

<template>
  <EmptyState
    title="页面不存在"
    description="该路径没有对应页面。"
    action-label="回到首页"
    @action="goHome"
  />
</template>
