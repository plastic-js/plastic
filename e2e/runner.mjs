import { chromium } from 'playwright'
import { createServer } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const EXPECTATIONS = {
	'native-root': {
		text: 'inner',
		mountCalls: 1,
	},
	'native-root-either': {
		text: 'either-branch',
		mountCalls: 1,
	},
	'component-root': {
		text: 'control',
		mountCalls: 1,
	},
	'detached-native-root': {
		text: 'detached',
		mountCalls: 0,
	},
	'native-root-dispose': {
		textBeforeDispose: 'disposable',
		childCountAfter: 0,
		mountCalls: 1,
		cleanupCalls: 1,
	},
	'deep-nested-native': {
		text: 'deep',
		mountCalls: 1,
	},
	'sibling-components': {
		text: 'AB',
		mountA: 1,
		mountB: 1,
	},
}

const summary = { passed: 0, failed: 0, results: [] }

function check(label, actual, expected) {
	const problems = []
	for (const [key, val] of Object.entries(expected)) {
		const got = actual[key]
		if (got !== val) {
			problems.push(`  ${key}: expected ${JSON.stringify(val)}, got ${JSON.stringify(got)}`)
		}
	}
	if (problems.length === 0) {
		summary.passed++
		summary.results.push({ label, status: 'PASS' })
		console.log(`  ✓ ${label}`)
	} else {
		summary.failed++
		summary.results.push({ label, status: 'FAIL', problems })
		console.log(`  ✗ ${label}`)
		for (const p of problems) console.log(p)
	}
}

async function main() {
	const server = await createServer({
		root: __dirname,
		configFile: path.resolve(__dirname, 'vite.config.js'),
		server: { port: 4174 },
	})
	await server.listen()
	const base = `http://localhost:${server.config.server.port}`
	console.log(`vite up at ${base}`)

	const browser = await chromium.launch()

	try {
		const page = await browser.newPage()
		page.on('pageerror', (err) => console.error('[pageerror]', err.message))
		page.on('console', (msg) => {
			if (msg.type() === 'error') console.error('[console error]', msg.text())
		})

		await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' })
		await page.waitForFunction(() => window.__e2e !== undefined, { timeout: 15_000 })

		const results = await page.evaluate(() => window.__e2e)

		console.log(`\n--- ${Object.keys(EXPECTATIONS).length} scenarios ---\n`)
		for (const [label, expected] of Object.entries(EXPECTATIONS)) {
			const actual = results[label]
			if (!actual) {
				summary.failed++
				summary.results.push({ label, status: 'MISSING' })
				console.log(`  ✗ ${label} (no results)`)
				continue
			}
			check(label, actual, expected)
		}

		await page.close()
	} finally {
		await browser.close()
		await server.close()
	}

	console.log(`\n=== ${summary.passed} passed, ${summary.failed} failed ===`)
	process.exit(summary.failed > 0 ? 1 : 0)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
