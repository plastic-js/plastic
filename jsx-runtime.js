// jsx-runtime.js
function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);  // 处理事件
    } else {
      element.setAttribute(key, value);  // 处理属性
    }
  });
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    } else if (Array.isArray(child)) {
      child.forEach(subChild => element.appendChild(subChild));
    }
  });
  return element;
}