import { signal, computed, h } from './jsx-runtime.js';

// 创建响应式状态
const count = signal(0);
const doubleCount = computed(() => count() * 2);

const App = () => (
  <div className="container">
    <h1>Hello, Reactive JSX!</h1>
    
    <div className="counter">
      <p>Count: {() => count()}</p>
      <p>Double Count: {() => doubleCount()}</p>
    </div>
    
    <div className="buttons">
      <button 
        onClick={() => count(count() + 1)}
      >
        Increment
      </button>
      
      <button 
        onClick={() => count(count() - 1)}
      >
        Decrement
      </button>
      
      <button 
        onClick={() => count(0)}
      >
        Reset
      </button>
    </div>
    
    <div className="info">
      <p>Status: {() => count() > 5 ? 'High!' : count() < -5 ? 'Low!' : 'Normal'}</p>
    </div>
  </div>
);

// 渲染到DOM
document.body.appendChild(App());