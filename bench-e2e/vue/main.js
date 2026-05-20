import { createApp, h, nextTick, ref } from 'vue'
import Many from './Many.vue'
import Counter from './Counter.vue'
import List from './List.vue'
import StatefulList from './StatefulList.vue'
import { applyDiff, flush, makeHost, makeItems, time } from '../scenarios.js'

// Pattern: mount with createApp; use ref() outside the root component so the
// bench can drive updates synchronously. Vue batches reactive updates into
// microtasks — nextTick() is the documented way to await them.

window.__bench = {
	async mount(n){
		const host = makeHost()
		const app = createApp(Many, { n })
		const ms = await time(async ()=> {
			app.mount(host)
			await nextTick()
		})
		app.unmount()
		return ms
	},

	async update(iterations){
		const host = makeHost()
		const counterRef = ref(null)
		const app = createApp({
			setup(){
				return ()=> h(Counter, { ref: counterRef })
			},
		})
		app.mount(host)
		await flush()
		const ms = await time(async ()=> {
			for (let i = 0; i < iterations; i += 1){
				counterRef.value.set(i)
				await nextTick()
			}
		})
		app.unmount()
		return ms
	},

	async largeList(n){
		const host = makeHost()
		const items = makeItems(n)
		const app = createApp(List, { items })
		const ms = await time(async ()=> {
			app.mount(host)
			await nextTick()
		})
		app.unmount()
		return ms
	},

	async diff(n, op){
		const host = makeHost()
		const initial = makeItems(n)
		const listRef = ref(null)
		const app = createApp({
			setup(){
				return ()=> h(StatefulList, { initial, ref: listRef })
			},
		})
		app.mount(host)
		await flush()
		const ms = await time(async ()=> {
			listRef.value.set(applyDiff(initial, op))
			await nextTick()
		})
		app.unmount()
		return ms
	},
}

window.__benchReady = true
