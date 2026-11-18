# sfcli — UI/UX & modernization audit

Scope: full audit of the static Vite app in this repo (`src/`, `index.html`, configs, data pipeline).
Date: 2026-11-18. Baseline: commit `94c24ff`, clean tree apart from untracked `.playwright-cli/`.

## What the app is

React 19 + Vite 8 + Tailwind CSS v4 + Radix primitives + lucide-react. A static, local-only
reference for 279 Salesforce CLI commands: fuzzy search with intent ranking, category browsing,
favorites, curated workflows, collapsible sidebar, breadcrumbs, expandable flag/example details,
copy-to-clipboard and a light/dark toggle. No backend.

Audit method: read every source/config file, inspected the generated CSS/build output, ran the
existing toolchain (`bun run build`, `bun run lint`) and cross-checked behaviour against the
compiled CSS rather than trusting source alone.

## Baseline verification

```
bun run build  -> PASS. dist: index.html 1.17 kB, CSS 41.28 kB (gzip 9.85 kB), JS 801.30 kB (gzip 201.85 kB)
                 warning: chunk larger than 500 kB (commands.json is 439 kB of the input)
bun run lint   -> 1 warning: src/components/ui/button.tsx:19 react(only-export-components)
bun test       -> PASS. 5 pass / 0 fail, 20 expect() calls, 1 file (scripts/refresh-commands.test.ts)
```

Data pipeline / automation (non-UI): `scripts/refresh-commands.ts` validates CLI JSON, drops hidden/global
flags, resolves example templates, rejects duplicate IDs and >20% coverage drops, and writes atomically.
The weekly GitHub Actions workflow pins Bun 1.2.23 / Node 24, runs `bun test` + refresh + build before a
non-force commit, and uses `persist-credentials: false` with a scoped `GITHUB_TOKEN`. No issues found.

## Findings

| # | Area | Finding | Impact | Severity |
|---|------|---------|--------|----------|
| 1 | Theme correctness | Tailwind `dark:` utilities compile to `@media (prefers-color-scheme:dark)`, but the app switches themes with a `.dark-mode` class on `.app-shell`. `dark:text-emerald-400` (badge.tsx) therefore ignores the in-app toggle. `document.documentElement.dataset.theme` is written but never read by CSS. | Inconsistent theme in one component; dead state. | High |
| 2 | Theme UX | Theme always starts light even when the OS prefers dark; no `color-scheme` declaration, so native scrollbars/form controls and the browser UI don't follow the theme. `<meta name="theme-color">` is hard-coded light. | First-visit mismatch, jarring browser chrome. | Medium |
| 3 | Keyboard UX | ⌘K/Ctrl+K focuses search, but there is no way to move through results or act on one with the keyboard. A command-reference app is expected to behave like a command palette. Help dialog doesn't even mention ⌘K. | Accessibility + power-user efficiency. | High |
| 4 | Redundant controls | `sort` is bound to two visible controls: the icon button in `.search-row` and the text `.sort-control` in `.result-meta`. | Visual clutter, two targets for one action. | Medium |
| 5 | Accessibility | Custom buttons (`.nav-item`, `.crumb-link`, `.quick-chip`, `.copy-command`, `.favorite-button`, `.flag-toggle`, `.example-row`, etc.) have no `:focus-visible` style; only the Radix-based Button/Input primitives do. | Keyboard users can lose their place. | High |
| 6 | Performance | Google Fonts is loaded via a CSS `@import` at the top of `index.css` — discovered late and render-blocking. No `preconnect` to the font origins. | Slower first paint, FOUT. | Medium |
| 7 | Tooling | `buttonVariants` exported from a component file breaks React Fast Refresh (the sole lint warning). | Annoying dev experience; CI noise. | Low |
| 8 | Touch targets | Help button, favorite star, clear-search, breadcrumb clear and recent-search chips have hit areas well under 40px on mobile. | Mis-taps on phones. | Medium |
| 9 | Bundle | 801 kB JS / 202 kB gzip triggers Vite's 500 kB warning; `commands.json` (439 kB) is bundled into the main chunk. | Slow cold load on poor links. | Low (accepted) |
| 10 | CSS maintainability | `index.css` is 47 lines but several are multi-thousand-character minified rules; 3 duplicated `.dark-mode .dark-mode ...` selectors and a stale `.modal-overlay`/`.help-modal` pair (the app uses a native `<dialog>`). | Hard to maintain; dead rules. | Low (documented) |
| 11 | Contrast (WCAG AA) | Light-mode secondary text fails AA: `--ink3` #7f8996 = 3.37:1 on the app background (needs 4.5:1); `--muted-foreground` #77808d = 3.79:1; several hard-coded small-text grays (#929ba6, #a3acb6, #89939e, #9aa3ad, #8a95a0, #87929e) are 2.4–3.0:1. Dark mode passes (ink3 5.65:1, blue 7.41:1). | Low-contrast labels, descriptions, counts, footer text. | High |

Non-issues verified: native `<dialog>` gives a real focus trap and Escape handling with focus restoration;
sidebar uses `inert` when hidden; `aria-live` announces copy and result counts; reduced-motion is respected;
mobile sidebar has a backdrop and Escape handling; favorites/recent searches/theme/sidebar state persist locally.

## Remediation in this pass

Items 1–8 are being addressed in `src/App.tsx`, `src/index.css`, `index.html`, and
`src/components/ui/button.tsx` (+ new `button-variants.ts`). Items 9–10 are documented as accepted
trade-offs: the command dataset is the product, and code-splitting it would add a loading state to a
static app; the CSS cleanup is cosmetic and out of scope for a behaviour-preserving pass.

## Modern Web Guidance

The `modern-web-guidance` skill is mandatory for HTML/CSS/client-side JS work in this setup. It was
loaded after the initial audit (a process miss, corrected before verification). Used via `bunx` because
the system `npx` runs Node 20 while the tool requires Node >= 22, and this repo is Bun-only anyway:

```
bunx --bun modern-web-guidance@latest legacy-scan src --json
-> totalFindings: 0, activeRuleCount: 52, activeGuideCount: 38
   "No legacy patterns found across 38 guides (52 rules; ~20% of the guidance corpus)."
```

Targeted lookups (`search` then `retrieve`) were run for `dark-mode-toggle`, `dark-mode`, `color`,
`accessibility` and `visually-stable-font-fallbacks`. They corrected the theme implementation:
base `color-scheme: light dark` on `:root` (never hardcoded light/dark), the `<meta name="color-scheme">`
driven `:has()` mapping plus an inline FOUC guard, a System/override toggle that removes the stored
value when reverting, a `prefers-color-scheme` `change` listener, `font-size-adjust: from-font`,
a skip link, coarse-pointer target sizes and a forced-colors focus fallback. The app's existing
native `<dialog>`, `inert` sidebar and live regions were checked and already follow the guide.

## Verification (after remediation)

Independent re-run in this session (not just the subagent's report):

```
bun run build  -> PASS, exit 0. dist: index.html 1.81 kB, CSS 43.17 kB (gzip 10.23 kB),
                 JS 803.45 kB (gzip 202.38 kB). Same pre-existing chunk-size advisory.
bun run lint   -> PASS, exit 0, zero warnings (was 1 warning).
bun test       -> PASS, 5 pass / 0 fail, 20 expect() calls.
```

Browser checks (Playwright/Firefox against `http://localhost:5173`, desktop 1280x900 and mobile 390x844):

- No console errors or warnings (200 messages, 0 errors / 0 warnings).
- Compiled CSS confirms `dark:text-emerald-400` now targets `.dark-mode …` instead of
  `@media (prefers-color-scheme:dark)`; `color-scheme` and `font-size-adjust: from-font` present.
- With no stored preference: `meta[color-scheme]="light dark"`, computed `color-scheme: light dark`,
  `.app-shell` light. After toggle: `.app-shell.dark-mode`, meta `dark`, `color-scheme: dark`,
  `theme-color=#14191f`, `localStorage['sfcli:dark']="true"`.
- Search + ArrowDown twice highlights exactly one `.command-card.is-active` with `aria-current="true"`;
  Enter copies it and the live region announces "Copied to clipboard."
- Tab moves focus to `.clear-search` with a 2px `rgb(98,181,250)` `:focus-visible` outline.
- Exactly one sort control remains (`.filter-button` = 1, `.sort-control` = 0).
- Help dialog lists all six shortcuts including ⌘K/Ctrl K, ↑/↓ and Enter.
- Mobile 390px: `scrollWidth == clientWidth == 390` (no horizontal overflow), favorite button 40px,
  hero art hidden. Desktop and dark-mode hero terminal verified visually.

Two defects were caught during visual verification and fixed in the primary agent: a dead
`.dark-mode .dark-mode .dark-mode .terminal-body` selector left the hero terminal white with
unreadable text in dark mode (now dark surface + adapted chips/prompt/success colors, and a second
dead `.dark-mode .dark-mode .nav-item.active` selector repaired), and the System theme state pinned
`meta[color-scheme]` to `light`/`dark` instead of leaving it `light dark`. Mobile hero actions were
also stacked at ≤430px to stop the secondary CTA wrapping its arrow onto its own line.

### Final state

Findings 1–8 and 11 resolved; 9–10 accepted with rationale above. Changed files: `index.html`,
`src/App.tsx`, `src/index.css`, `src/components/ui/button.tsx`, new `src/components/ui/button-variants.ts`,
`README.md`, this report. No commits were made.
