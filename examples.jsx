// 高级用法示例 - 可以参考这个文件学习更多用法

import { signal, computed, effect, h } from './jsx-runtime.js';

// ========== 示例 1: 基础计数器 ==========
const count = signal(0);

const BasicCounter = () => (
  <div>
    <p>Count: {() => count()}</p>
    <button onClick={() => count(count() + 1)}>Increment</button>
  </div>
);

// ========== 示例 2: 多个相关的 signals ==========
const firstName = signal('John');
const lastName = signal('Doe');
const fullName = computed(() => `${firstName()} ${lastName()}`);

const UserProfile = () => (
  <div>
    <h2>User Profile</h2>
    <p>Full Name: {() => fullName()}</p>
    <input 
      type="text" 
      value={() => firstName()}
      onChange={(e) => firstName(e.target.value)}
      placeholder="First name"
    />
    <input 
      type="text"
      value={() => lastName()}
      onChange={(e) => lastName(e.target.value)}
      placeholder="Last name"
    />
  </div>
);

// ========== 示例 3: 条件渲染 ==========
const isLoggedIn = signal(false);
const user = signal(null);

const LoginPanel = () => (
  <div>
    {() => isLoggedIn() ? (
      h("div", null, "Welcome back, ", user(), "!")
    ) : (
      h("button", { onClick: () => { isLoggedIn(true); user('Alice'); } }, "Login")
    )}
  </div>
);

// ========== 示例 4: 列表渲染 ==========
const todos = signal([
  { id: 1, title: 'Learn alien-signals', done: false },
  { id: 2, title: 'Build a reactive app', done: false }
]);

const todoCount = computed(() => todos().length);
const completedCount = computed(() => todos().filter(t => t.done).length);

const TodoList = () => (
  <div>
    <h2>Todos</h2>
    <p>Total: {() => todoCount()}, Completed: {() => completedCount()}</p>
    <ul>
      {() => todos().map(todo => (
        h("li", { key: todo.id }, todo.title)
      ))}
    </ul>
  </div>
);

// ========== 示例 5: 使用 effect 执行副作用 ==========
const searchQuery = signal('');

// 当搜索词改变时，自动执行搜索
effect(() => {
  const query = searchQuery();
  if (query.length > 0) {
    console.log(`Searching for: ${query}`);
    // 这里可以调用 API 或执行其他副作用
  }
});

const SearchBox = () => (
  <div>
    <input 
      type="text"
      placeholder="Search..."
      onChange={(e) => searchQuery(e.target.value)}
    />
    <p>Current query: {() => searchQuery()}</p>
  </div>
);

// ========== 示例 6: 复杂的派生状态 ==========
const width = signal(100);
const height = signal(100);

const area = computed(() => width() * height());
const perimeter = computed(() => 2 * (width() + height()));
const isSquare = computed(() => width() === height());

const ShapeCalculator = () => (
  <div>
    <h2>Shape Calculator</h2>
    <p>Width: {() => width()}, Height: {() => height()}</p>
    <p>Area: {() => area()}</p>
    <p>Perimeter: {() => perimeter()}</p>
    <p>Is Square: {() => isSquare() ? 'Yes' : 'No'}</p>
    <input 
      type="range"
      min="0"
      max="200"
      value={() => width()}
      onChange={(e) => width(parseInt(e.target.value))}
    />
  </div>
);

// ========== 示例 7: 组件复合 ==========
const inputValue = signal('');
const items = signal([]);

const addItem = () => {
  if (inputValue().trim()) {
    items([...items(), { id: Date.now(), text: inputValue() }]);
    inputValue('');
  }
};

const ItemInput = () => (
  <div>
    <input 
      type="text"
      value={() => inputValue()}
      onChange={(e) => inputValue(e.target.value)}
      placeholder="Add new item"
    />
    <button onClick={addItem}>Add</button>
  </div>
);

const ItemList = () => (
  <ul>
    {() => items().map(item => h("li", { key: item.id }, item.text))}
  </ul>
);

const ItemManager = () => (
  <div>
    <h2>Item Manager</h2>
    {h(ItemInput, null)}
    {h(ItemList, null)}
  </div>
);

// ========== 示例 8: 主应用 ==========
const activeTab = signal('counter');

const App = () => (
  <div style="padding: 20px;">
    <h1>Advanced alien-signals Examples</h1>
    
    <nav>
      <button onClick={() => activeTab('counter')}>Counter</button>
      <button onClick={() => activeTab('profile')}>Profile</button>
      <button onClick={() => activeTab('search')}>Search</button>
    </nav>

    <section>
      {() => {
        switch(activeTab()) {
          case 'counter':
            return h(BasicCounter, null);
          case 'profile':
            return h(UserProfile, null);
          case 'search':
            return h(SearchBox, null);
          default:
            return h("p", null, "Select a tab");
        }
      }}
    </section>
  </div>
);

// 导出以便在其他文件中使用
export {
  BasicCounter,
  UserProfile,
  LoginPanel,
  TodoList,
  SearchBox,
  ShapeCalculator,
  ItemManager,
  App
};
