import { signal, effect } from 'alien-signals';

// 1. 建立一個排程器 (Scheduler)
const queue = new Set<() => void>();
let isPending = false;

function flush() {
  // 執行所有排隊中的任務
  for (const job of queue) {
    job();
  }
  queue.clear();
  isPending = false;
}

function nextTick(job: () => void) {
  queue.add(job);
  if (!isPending) {
    isPending = true;
    // 使用微任務 (Microtask)，這比 setTimeout(0) 快且在同一個事件循環更新
    queueMicrotask(flush);
  }
}

// 2. 封裝你的異步 Effect
function createAsyncEffect(fn: () => void) {
  let isDirty = true;

  // 這裡的 effect 只負責「監聽依賴」與「標記髒值」
  const runner = effect(() => {
    if (isDirty) {
      // 第一次執行或依賴變動時觸發
      fn();
      isDirty = false;
    } else {
      // 當依賴變動時，不要立即執行 fn，而是把任務丟進排程器
      nextTick(fn);
    }
  });
  
  return runner;
}
