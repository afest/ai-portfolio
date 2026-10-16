// Резюме в PDF для ссылки «Скачать резюме» (статья «До этого», T-548): scripts/resume.html → public/yunusov-resume.pdf.
// Запуск: node scripts/resume-pdf.mjs. Шрифты — Inter из node_modules, печать — Chromium из Playwright.
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(join(here, 'resume.html')).href)
await page.evaluate(() => document.fonts.ready)
await page.pdf({ path: join(here, '..', 'public', 'yunusov-resume.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true })
await browser.close()
console.log('public/yunusov-resume.pdf')
