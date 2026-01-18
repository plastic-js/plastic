import { signal, computed, h } from './jsx-runtime.js';
import Label from './Label.jsx';

// 创建响应式状态
const count = signal(0);
const doubleCount = computed(() => count() * 2);
const App = () => h("div", {
  className: "container"
}, h(Label, null), h("div", {
  className: "counter"
}, h("p", null, "Count: ", () => count()), h("p", null, "Double Count: ", () => doubleCount())), h("div", {
  className: "buttons"
}, h("button", {
  onClick: () => count(count() + 1)
}, "Increment"), h("button", {
  onClick: () => count(count() - 1)
}, "Decrement"), h("button", {
  onClick: () => count(0)
}, "Reset")), h("div", {
  className: "info"
}, h("p", null, "Status: ", () => count() > 5 ? 'High!' : count() < -5 ? 'Low!' : 'Normal')));

// 渲染到DOM
document.body.appendChild(App());
