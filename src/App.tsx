import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown,
  ChevronRight, ChevronsUpDown, CircleHelp, Copy, ExternalLink,
  Filter, History, Keyboard, Menu, Moon, Search, ShieldCheck,
  Sparkles, Star, Sun, Terminal, X, Zap,
} from 'lucide-react'
import rawCommands from './data/commands.json'
import { categories, categoryOf, workflows } from './data/categories'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Input } from './components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip'

type SfCommand = { id: string; summary: string; description?: string; examples?: string[]; flags?: string[]; args?: string[]; hidden?: boolean }
const allCommands = (rawCommands as unknown as SfCommand[]).filter(c => !c.hidden).map(c => ({
  ...c,
  category: categoryOf(c.id),
  description: (c.description || c.summary || '').replace(/\n+/g, ' ').trim(),
  command: `sf ${c.id.replaceAll(':', ' ')}`,
  flagsText: (c.flags || []).join(' '),
  examplesText: (c.examples || []).join(' '),
}))
type CommandItem = typeof allCommands[number]
const knownCategories = categories.map(c => c.id)
const matchesCategory = (c: CommandItem, cat: string) => cat === 'all' ? true : cat === 'other' ? !knownCategories.includes(c.category) : c.category === cat
const countByCategory = (cat: string) => allCommands.filter(c => matchesCategory(c, cat)).length
const popularIds = ['org:login:web', 'org:login:access-token', 'org:display', 'org:list', 'org:open', 'project:generate', 'project:deploy:start', 'project:deploy:preview', 'data:query', 'data:export:bulk', 'apex:run', 'config:set']
const popular = popularIds.map(id => allCommands.find(c => c.id === id)).filter(Boolean) as CommandItem[]
const readLocal = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback } }

const fuse = new Fuse(allCommands, {
  keys: [
    { name: 'id', weight: 1.6 }, { name: 'command', weight: 1.4 }, { name: 'summary', weight: 1.4 },
    { name: 'description', weight: 1 }, { name: 'flagsText', weight: 0.5 }, { name: 'examplesText', weight: 0.6 },
  ], threshold: 0.34, ignoreLocation: true, includeScore: true, minMatchCharLength: 2,
})
const searchText = new Map(allCommands.map(c => [c.id, `${c.id} ${c.command} ${c.summary} ${c.description} ${c.flagsText} ${c.examplesText}`.toLowerCase()]))

// Rank by intent: every fuzzy hit whose full text contains ALL query terms floats to the top,
// then the remaining fuzzy matches. Makes "log in to a sandbox" beat unrelated command names.
function rankByIntent(q: string): CommandItem[] {
  const terms = q.toLowerCase().split(/[^a-z0-9:_-]+/).filter(t => t.length > 1)
  const fuzzy = fuse.search(q).map(r => r.item)
  if (!terms.length) return fuzzy
  const strong: CommandItem[] = []
  const weak: CommandItem[] = []
  const seen = new Set<string>()
  for (const c of fuzzy) { seen.add(c.id); (terms.every(t => searchText.get(c.id)!.includes(t)) ? strong : weak).push(c) }
  for (const c of allCommands) { if (seen.has(c.id)) continue; if (terms.every(t => searchText.get(c.id)!.includes(t))) strong.push(c) }
  return [...strong, ...weak]
}

function App() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [category, setCategory] = useState('all')
  const [favorites, setFavorites] = useState<string[]>(() => readLocal('sfcli:favorites', []))
  const [view, setView] = useState<'commands' | 'favorites' | 'workflows'>('commands')
  const [copied, setCopied] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [dark, setDark] = useState(() => readLocal('sfcli:dark', false))
  const [sort, setSort] = useState<'relevance' | 'name'>('relevance')
  const [recent, setRecent] = useState<string[]>(() => readLocal('sfcli:recent', []))
  const [showHelp, setShowHelp] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readLocal('sfcli:searches', []))

  useEffect(() => { localStorage.setItem('sfcli:favorites', JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem('sfcli:dark', JSON.stringify(dark)); document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => { localStorage.setItem('sfcli:recent', JSON.stringify(recent)) }, [recent])
  useEffect(() => { localStorage.setItem('sfcli:searches', JSON.stringify(recentSearches)) }, [recentSearches])

  const results = useMemo(() => {
    let found: CommandItem[] = deferredQuery.trim() ? rankByIntent(deferredQuery.trim()) : category === 'all' && view === 'commands' ? popular : allCommands
    if (view === 'favorites') found = found.filter(c => favorites.includes(c.id))
    if (category !== 'all' && view === 'commands') found = found.filter(c => matchesCategory(c, category))
    if (view === 'workflows') found = []
    if (sort === 'name') found = [...found].sort((a, b) => a.id.localeCompare(b.id))
    return found
  }, [deferredQuery, category, view, favorites, sort])

  function toggleFavorite(id: string) { setFavorites(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]) }
  async function copy(text: string, id: string) { try { await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(''), 1600) } catch { setCopied('copy-error'); window.setTimeout(() => setCopied(''), 1600) } }
  function selectCommand(command: string) { setRecent(v => [command, ...v.filter(x => x !== command)].slice(0, 6)) }
  function setSearch(value: string) { setQuery(value); if (value.trim().length > 2) setRecentSearches(v => [value.trim(), ...v.filter(x => x !== value.trim())].slice(0, 5)) }
  function setSection(next: typeof view) { setView(next); setCategory('all'); setMobileNav(false) }

  const categoryMeta = (id: string) => categories.find(x => x.id === id)
  const title = view === 'favorites' ? 'Your favorites' : view === 'workflows' ? 'Common workflows' : deferredQuery ? 'Search results' : category === 'all' ? 'Popular commands' : categoryMeta(category)?.label || 'Commands'
  const subtitle = view === 'favorites' ? 'The commands you’ve saved in this browser.' : view === 'workflows' ? 'Practical, copy-ready recipes for everyday Salesforce work.' : deferredQuery ? `Fuzzy-matched across ${allCommands.length} Salesforce CLI commands.` : category === 'all' ? 'A few great commands to get you moving.' : `Browse ${countByCategory(category)} ${categoryMeta(category)?.label.toLowerCase() || ''} commands.`

  return <TooltipProvider delayDuration={250}>
    <div className={`app-shell ${dark ? 'dark-mode' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><Menu size={19}/></Button>
          <a className="brand" href="#" onClick={e => {e.preventDefault(); setSection('commands')}}><span className="brand-mark"><Terminal size={17}/></span><span>sf<span className="brand-light">cli</span><span className="brand-dot">.</span></span></a>
          <span className="topbar-divider"/><span className="brand-caption">Salesforce CLI command center</span>
        </div>
        <div className="topbar-right">
          <span className="version-pill"><span className="live-dot"/> CLI reference</span>
          <Button variant="ghost" size="icon" className="top-icon" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</Button>
          <a className="github-link" href="https://github.com/salesforcecli/cli" target="_blank" rel="noreferrer"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.31-3.76-1.31-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-2.48-.28-5.09-1.24-5.09-5.51 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.06 1.15a10.6 10.6 0 0 1 5.57 0c2.13-1.45 3.06-1.15 3.06-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.28-2.61 5.22-5.1 5.5.4.35.75 1.02.75 2.06v3.07c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg><span>GitHub</span><ArrowUpRight size={12}/></a>
        </div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <div className="sidebar-head"><span>WORKSPACE</span><ChevronDown size={14}/></div>
          <div className="nav-list">
            <button className={`nav-item ${view === 'commands' && category === 'all' ? 'active' : ''}`} onClick={() => {setSection('commands'); setCategory('all')}}><span className="nav-symbol blue"><Terminal size={16}/></span><span>All commands</span><span className="nav-count">{allCommands.length}</span></button>
            <button className={`nav-item ${view === 'favorites' ? 'active' : ''}`} onClick={() => setSection('favorites')}><span className="nav-symbol amber"><Star size={16}/></span><span>Favorites</span><span className="nav-count">{favorites.length}</span></button>
            <button className={`nav-item ${view === 'workflows' ? 'active' : ''}`} onClick={() => setSection('workflows')}><span className="nav-symbol violet"><Zap size={16}/></span><span>Common workflows</span></button>
          </div>
          <div className="sidebar-label">CATEGORIES</div>
          <div className="nav-list category-list">
            {categories.filter(c => c.id !== 'all').map(c => <button key={c.id} className={`nav-item ${category === c.id && view === 'commands' ? 'active' : ''}`} onClick={() => {setSection('commands'); setCategory(c.id)}}><span className={`category-dot dot-${c.id}`}/><span>{c.label}</span><span className="nav-count">{countByCategory(c.id)}</span></button>)}
          </div>
          <div className="sidebar-label recent-label">RECENT</div>
          <div className="recent-list">{recent.length ? recent.slice(0, 4).map(cmd => <button key={cmd} className="recent-item" onClick={() => {setQuery(cmd.replace(/^sf /, ''));setSection('commands')}}><History size={13}/><code>{cmd}</code></button>) : <p className="recent-empty">Commands you copy show up here.</p>}</div>
          <div className="sidebar-bottom"><div className="sidebar-promo"><div className="promo-icon"><Sparkles size={15}/></div><strong>Find the right command</strong><p>Search by what you want to do, not just what it’s called.</p><button onClick={() => {document.querySelector<HTMLInputElement>('#command-search')?.focus();setQuery('deploy changes')}}>Try “deploy changes” <ArrowRight size={12}/></button></div><div className="sidebar-foot"><span><span className="green-dot"/> Everything runs locally</span><button onClick={() => setShowHelp(true)} aria-label="Help"><CircleHelp size={15}/></button></div></div>
        </aside>

        <main className="main-content">
          <div className="content-inner">
            <div className="breadcrumb"><span>Salesforce CLI</span><ChevronRight size={13}/><strong>{view === 'workflows' ? 'Workflows' : view === 'favorites' ? 'Favorites' : categoryMeta(category)?.label || 'Commands'}</strong></div>
            {view === 'commands' && category === 'all' && !deferredQuery && <section className="hero-section"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-mark"><Activity size={12}/></span> YOUR SALESFORCE CLI COMPANION</div><h1>Every command.<br/><span>One search away.</span></h1><p>Explore, understand, and copy Salesforce CLI commands. Search by name, flag, or just describe what you’re trying to do.</p><div className="hero-actions"><Button className="hero-button" onClick={() => document.querySelector<HTMLInputElement>('#command-search')?.focus()}><Search size={16}/> Explore commands <ArrowDown size={14}/></Button><button className="hero-secondary" onClick={() => setSection('workflows')}>Browse common workflows <ArrowRight size={14}/></button></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-terminal"><div className="terminal-top"><span className="terminal-lights"><i/><i/><i/></span><span>~/my-salesforce-project</span><span className="terminal-ready"><span/>ready</span></div><div className="terminal-body"><div><span className="terminal-prompt">$</span> sf org login web <span className="terminal-cursor"/></div><div className="terminal-muted">Opening browser for authentication…</div><div className="terminal-success"><Check size={12}/> Successfully authorized <span>my-org</span></div><div className="terminal-line"><span className="terminal-prompt">$</span> sf project deploy start <span className="terminal-cursor faint"/></div></div></div><div className="float-chip chip-top"><span className="chip-icon">✦</span> 273 commands</div><div className="float-chip chip-bottom"><span className="chip-check"><Check size={12}/></span> Copied to clipboard</div><div className="hero-sparkle sparkle-one">✳</div><div className="hero-sparkle sparkle-two">✦</div></div></section>}

            <section className="command-browser" id="command-list">
              <div className="section-heading"><div><div className="heading-title-row"><h2>{title}</h2>{!deferredQuery && view === 'commands' && category === 'all' && <Badge variant="secondary" className="heading-badge">HAND-PICKED</Badge>}{deferredQuery && <Badge variant="secondary" className="heading-badge">FUZZY SEARCH</Badge>}</div><p>{subtitle}</p></div><a className="docs-link" href="https://developer.salesforce.com/docs/platform/salesforce-cli" target="_blank" rel="noreferrer">CLI documentation <ExternalLink size={13}/></a></div>
              <div className="search-row"><div className="search-wrap"><Search size={17} className="search-icon"/><Input id="command-search" value={query} onChange={e => setSearch(e.target.value)} onKeyDown={e => {if (e.key === 'Escape') setQuery('')}} placeholder="Try ‘log in to a sandbox’ or ‘deploy my changes’…" className="search-input"/><span className="search-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</div><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className={`filter-button ${sort === 'name' ? 'filter-active' : ''}`} aria-label="Toggle sort" onClick={() => setSort(sort === 'name' ? 'relevance' : 'name')}><Filter size={16}/></Button></TooltipTrigger><TooltipContent>Sort by {sort === 'name' ? 'relevance' : 'name'}</TooltipContent></Tooltip></div>
              {!query && view === 'commands' && <div className="quick-filters"><span className="quick-label">TRY</span>{['authenticate', 'deploy changes', 'run a query', 'create a project'].map((q,i) => <button className="quick-chip" key={q} onClick={() => setSearch(q)}>{i===0&&<ShieldCheck size={12}/>} {q}</button>)}</div>}

              {view === 'workflows' ? <div className="workflow-grid">{workflows.map(w => <Card key={w.step} className="workflow-card"><div className="workflow-step">{w.step}<span/></div><h3>{w.title}</h3><p>{w.description}</p>{w.commands.map((cmd,i) => <button className="workflow-command" key={i} onClick={() => {void copy(cmd,`workflow-${w.step}-${i}`);selectCommand(cmd)}}><code>{cmd}</code>{copied===`workflow-${w.step}-${i}`?<Check size={15}/>:<Copy size={15}/>}</button>)}<div className="workflow-tags">{w.tags.slice(0,3).map(t=><span key={t}>{t}</span>)}</div></Card>)}</div> : <>
                {view === 'favorites' && !favorites.length ? <div className="empty-state"><span className="empty-icon"><Star size={23}/></span><h3>Save commands for later</h3><p>Tap the star on any command and it’ll be waiting here next time.</p><Button variant="outline" onClick={() => setSection('commands')}>Browse commands <ArrowRight size={14}/></Button></div> : <>
                  <div className="result-meta"><span>{deferredQuery ? <><strong>{results.length}</strong> matches</> : <>Showing <strong>{results.length}</strong> of <strong>{allCommands.length}</strong> commands</>}</span><button onClick={() => setSort(sort === 'relevance' ? 'name' : 'relevance')} className="sort-control"><ChevronsUpDown size={13}/>{sort === 'relevance' ? 'Best match' : 'Name'}</button></div>
                  <div className="command-list">{results.slice(0, 60).map((c, i) => {
                    const favorite = favorites.includes(c.id)
                    const example = c.examples?.[0]
                    const flags = (c.flags || []).filter(x => !['json','help','flags-dir'].includes(x)).slice(0,3)
                    const argNames = c.args || []
                    return (<Card key={c.id} className="command-card" style={{animationDelay:`${Math.min(i*25,300)}ms`}}><div className="command-card-main"><div className="command-head"><span className="command-name">sf {c.id.replaceAll(':',' ')}</span><Badge variant="outline" className={`category-badge cat-${c.category}`}>{categoryMeta(c.category)?.label || c.category}</Badge><button className={`favorite-button ${favorite?'is-favorite':''}`} onClick={() => toggleFavorite(c.id)} aria-label={favorite?'Remove favorite':'Add favorite'} title={favorite?'Remove favorite':'Add to favorites'}><Star size={15} fill={favorite?'currentColor':'none'}/></button></div><p className="command-summary">{c.summary}</p><p className="command-description">{c.description.slice(0,230)}{c.description.length>230?'…':''}</p>{(flags.length>0 || argNames.length>0) && <div className="command-flags">{flags.map(f=><span key={f} className="flag-chip">--{f}</span>)}{argNames.slice(0,2).map(a=><span key={a} className="flag-chip arg-chip">&lt;{a}&gt;</span>)}{(c.flags||[]).length>flags.length && <span className="flag-more">+{(c.flags||[]).length-flags.length} more</span>}</div>}                      <div className="command-footer"><span className="command-id">{c.id}</span><div className="command-actions"><Tooltip><TooltipTrigger asChild><button className="action-button" onClick={() => {setQuery(c.id);setSection('commands')}} aria-label="Search for command"><Search size={14}/></button></TooltipTrigger><TooltipContent>Find similar</TooltipContent></Tooltip><button className="copy-command" onClick={() => {void copy(example || c.command, c.id);selectCommand(example || c.command)}}>{copied===c.id?<><Check size={13}/> Copied</>:<><Copy size={13}/> Copy</>}</button></div></div></div>{example && <button className="example-preview" onClick={() => {void copy(example,`${c.id}-example`);selectCommand(example)}}><span className="example-label">EXAMPLE</span><code>{example.length>95?`${example.slice(0,95)}…`:example}</code>{copied===`${c.id}-example`?<Check size={13}/>:<Copy size={13}/>}</button>}</Card>)
                    })}</div>
                  {results.length > 60 && <div className="more-results"><span>Showing first 60 of {results.length} results.</span><button onClick={() => {setSearch('');setCategory('all')}}>Clear filters</button></div>}
                  {!results.length && <div className="empty-state"><span className="empty-icon"><Search size={23}/></span><h3>No commands found</h3><p>Try a different description, command name, or flag.</p>{recentSearches.length>0&&<div className="recent-searches"><span>Recent searches</span>{recentSearches.map(s=><button key={s} onClick={()=>setSearch(s)}>{s}</button>)}</div>}<Button variant="outline" onClick={() => {setQuery('');setCategory('all');setView('commands')}}>Clear search <X size={14}/></Button></div>}
                </>}
              </>}
              <div className="source-note"><span><ShieldCheck size={14}/> Command reference generated from Salesforce CLI</span><a href="https://github.com/salesforcecli/cli" target="_blank" rel="noreferrer">View source <ArrowUpRight size={12}/></a></div>
            </section>
            <footer className="page-footer"><span>Built for the Salesforce CLI community.</span><span>Static by design <span className="footer-dot">·</span> Your favorites stay in this browser.</span></footer>
          </div>
        </main>
      </div>

      {showHelp && <div className="modal-overlay" onClick={() => setShowHelp(false)}><div className="help-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShowHelp(false)}><X size={17}/></button><div className="help-icon"><Keyboard size={20}/></div><h2>Search shortcuts</h2><p>Find commands the way you think about them.</p><div className="shortcut-row"><span>Search by command or intent</span><kbd>Type anything</kbd></div><div className="shortcut-row"><span>Clear search</span><kbd>ESC</kbd></div><div className="shortcut-row"><span>Copy a command</span><kbd>Click copy</kbd></div><Button className="help-done" onClick={() => setShowHelp(false)}>Got it</Button></div></div>}
      <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} style={{display:mobileNav?'block':'none'}}/>
    </div>
  </TooltipProvider>
}

export default App
