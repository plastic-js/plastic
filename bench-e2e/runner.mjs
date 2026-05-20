// Bench runner: starts vite, launches Chromium, drives window.__bench, prints table.
import { chromium } from 'playwright'
import { createServer } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FRAMEWORKS = ['plastic', 'react', 'vue', 'solid']

// Scenarios run on each framework. [label, methodName, args]
const SCENARIOS = [
	['mount-100',          'mount',     [100]],
	['mount-3000',         'mount',     [3000]],
	['mount-5000',         'mount',     [5000]],
	['update-3000',        'update',    [3000]],
	['largeList-3000',     'largeList', [3000]],
	['largeList-10000',    'largeList', [10_000]],
	['diff-reverse-3000',  'diff',      [3000, 'reverse']],
	['diff-shuffle-3000',  'diff',      [3000, 'shuffle']],
	['diff-insert-3000',   'diff',      [3000, 'insert']],
	['diff-remove-3000',   'diff',      [3000, 'remove']],
	['diff-swap-3000',     'diff',      [3000, 'swap']],
]

const SAMPLES = 5    // measured runs per scenario
const WARMUP = 2     // ignored warmup runs

const median = (xs)=> {
	const s = xs.slice().sort((a, b)=> a - b)
	const m = s.length >> 1
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const fmt = (ms)=> ms < 10 ? ms.toFixed(2) : ms.toFixed(1)

async function runOne(page, method, args){
	return page.evaluate(async ({ method, args })=> {
		return window.__bench[method](...args)
	}, { method, args })
}

async function main(){
	const server = await createServer({
		root: __dirname,
		configFile: path.resolve(__dirname, 'vite.config.js'),
		server: { port: 4173 },
	})
	await server.listen()
	const base = `http://localhost:${server.config.server.port}`
	console.log(`vite up at ${base}`)

	const browser = await chromium.launch()
	const results = {} // results[scenario][framework] = medianMs

	try {
		for (const fw of FRAMEWORKS){
			console.log(`\n=== ${fw} ===`)
			const page = await browser.newPage()
			page.on('pageerror', (err)=> console.error(`[${fw} pageerror]`, err.message))
			page.on('console', (msg)=> {
				if (msg.type() === 'error'){ console.error(`[${fw} console]`, msg.text()) }
			})
			await page.goto(`${base}/${fw}/index.html`)
			await page.waitForFunction(()=> window.__benchReady === true, { timeout: 30_000 })

			for (const [label, method, args] of SCENARIOS){
				const samples = []
				try {
					for (let i = 0; i < WARMUP; i += 1){
						await runOne(page, method, args)
					}
					for (let i = 0; i < SAMPLES; i += 1){
						samples.push(await runOne(page, method, args))
					}
					const med = median(samples)
					results[label] = results[label] || {}
					results[label][fw] = med
					console.log(`  ${label.padEnd(22)} ${fmt(med)} ms  (samples: ${samples.map(fmt).join(', ')})`)
				} catch (err){
					console.error(`  ${label} FAILED: ${err.message}`)
					results[label] = results[label] || {}
					results[label][fw] = null
				}
			}
			await page.close()
		}
	} finally {
		await browser.close()
		await server.close()
	}

	// Print summary table
	console.log('\n\n=== SUMMARY (median ms, lower is better) ===\n')
	const header = ['scenario', ...FRAMEWORKS]
	const rows = [header]
	for (const [label] of SCENARIOS){
		const row = [label]
		for (const fw of FRAMEWORKS){
			const v = results[label]?.[fw]
			row.push(v == null ? 'FAIL' : fmt(v))
		}
		rows.push(row)
	}
	const widths = header.map((_, i)=> Math.max(...rows.map(r=> String(r[i]).length)))
	for (const row of rows){
		console.log(row.map((c, i)=> String(c).padEnd(widths[i])).join('  '))
	}

	// Also write JSON for further analysis
	const fs = await import('fs')
	fs.writeFileSync(
		path.join(__dirname, 'results.json'),
		JSON.stringify({ samples: SAMPLES, warmup: WARMUP, results }, null, 2),
	)
	console.log(`\nwrote ${path.join(__dirname, 'results.json')}`)
}

main().catch((err)=> {
	console.error(err)
	process.exit(1)
})
