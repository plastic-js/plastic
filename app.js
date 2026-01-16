const App = () => h("div", {
  className: "container"
}, h("h1", null, "Hello, JSX without frameworks!"), h("button", {
  onClick: () => alert('Clicked!')
}, "Click me"));

// 渲染到DOM
document.body.appendChild(App());
