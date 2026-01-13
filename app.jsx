const App = () => (
  <div className="container">
    <h1>Hello, JSX without frameworks!</h1>
    <button onClick={() => alert('Clicked!')}>Click me</button>
  </div>
);

// 渲染到DOM
document.body.appendChild(App());