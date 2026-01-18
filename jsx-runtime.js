import { signal, computed, effect } from 'alien-signals';

// 存储当前活跃的effect范围，用于自动订阅信号
let currentEffect = null;

/**
 * Enhanced hyperscript function with reactivity support
 * @param {string} tag - HTML element tag name
 * @param {Object} props - Element properties and event handlers
 * @param {...any} children - Child elements or text
 * @returns {Element} DOM element
 */
function h(tag, props = {}, ...children) {
  // 檢查是否是組件函數
  if (typeof tag === 'function') {
    return tag(props, ...children);
  }
  
  const element = document.createElement(tag);
  
  // 缓存需要动态更新的属性
  const dynamicProps = {};
  const listeners = {};
  
  Object.entries(props || {}).forEach(([key, value]) => {
    if (key.startsWith('on') && typeof value === 'function') {
      // 处理事件监听器
      const eventName = key.slice(2).toLowerCase();
      listeners[eventName] = value;
      element.addEventListener(eventName, value);
    } else if (typeof value === 'function' && !(value instanceof Element)) {
      // 检测是否是 signal 的 getter 函数
      dynamicProps[key] = value;
      // 为动态属性设置初始值
      try {
        const initialValue = value();
        if (initialValue !== null && initialValue !== undefined) {
          element.setAttribute(key, initialValue);
        }
      } catch (e) {
        // 忽略初始值获取错误
      }
    } else {
      // 处理静态属性
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    }
  });
  
  // 为动态属性创建 effect，自动更新DOM
  Object.entries(dynamicProps).forEach(([key, getter]) => {
    effect(() => {
      const value = getter();
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      } else {
        element.removeAttribute(key);
      }
    });
  });
  
  // 处理子元素，支持 signal 和普通值
  const processChildren = (childList) => {
    childList.forEach(child => {
      if (typeof child === 'function' && !(child instanceof Element)) {
        // 可能是 signal 的 getter
        try {
          const value = child();
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            const textNode = document.createTextNode(String(value));
            element.appendChild(textNode);
            
            // 为文本 signal 创建 effect 自动更新
            effect(() => {
              textNode.textContent = String(child());
            });
          } else if (value instanceof Node) {
            element.appendChild(value);
          } else if (Array.isArray(value)) {
            processChildren(value);
          }
        } catch (e) {
          // 非 signal 函数，忽略
        }
      } else if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      } else if (Array.isArray(child)) {
        processChildren(child);
      } else if (child !== null && child !== undefined) {
        element.appendChild(document.createTextNode(String(child)));
      }
    });
  };
  
  processChildren(children);
  
  return element;
}

/**
 * 导出响应式API供用户使用
 */
export { signal, computed, effect, h };