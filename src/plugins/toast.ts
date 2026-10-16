import Vue3Toastify from "vue3-toastify";
import "vue3-toastify/dist/index.css";
import type {App} from "vue";
export default {
  install: (app:App<Element>, options = {}) => {
    app.use(Vue3Toastify, {position: 'top-center', ...options});
  },
};
