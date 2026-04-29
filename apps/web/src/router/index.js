import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    redirect: "/question-pressure",
  },
  {
    path: "/question-pressure",
    name: "question-pressure",
    meta: { title: "问题压力" },
    component: () =>
      import("@/features/question-pressure/QuestionPressurePage.vue"),
  },
  {
    path: "/clusters/:clusterId",
    name: "cluster-detail",
    meta: { title: "聚类详情" },
    component: () => import("@/features/cluster/ClusterDetailPage.vue"),
    props: true,
  },
  {
    path: "/feed",
    name: "feed",
    meta: { title: "Feed 浏览" },
    component: () => import("@/features/feed/FeedPage.vue"),
  },
  {
    path: "/health",
    name: "health",
    meta: { title: "健康状态" },
    component: () => import("@/features/health/HealthPage.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    meta: { title: "未找到" },
    component: () => import("@/features/not-found/NotFoundPage.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { left: 0, top: 0 };
  },
});
