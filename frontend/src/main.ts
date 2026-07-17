import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// Initialize auth (restore session from refresh token) before router
// so the beforeEach guard sees the correct isAuthenticated state
const authStore = useAuthStore();
authStore.initialize().then(() => {
  app.use(router);
  app.mount('#app');
});
