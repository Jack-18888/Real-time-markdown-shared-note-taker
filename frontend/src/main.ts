import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Initialize auth (restore session from refresh token) before mounting
const authStore = useAuthStore();
authStore.initialize().then(() => {
  app.mount('#app');
});
