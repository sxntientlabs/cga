const state = {
  data: null,
  route: 'home',
  search: '',
  searchFilter: 'all',
  mode: 'home',
  theme: localStorage.getItem('im-theme') || 'light',
  focus: JSON.parse(localStorage.getItem('im-focus') || 'false'),
  sidebarOpen: JSON.parse(localStorage.getItem('im-sidebar-open') || 'false'),
  bookmarks: new Set(JSON.parse(localStorage.getItem('im-bookmarks') || '[]')),
  done: new Set(JSON.parse(localStorage.getItem('im-done') || '[]')),
  aiHistory: JSON.parse(localStorage.getItem('im-ai-history') || '[]'),
  quizState: {},
};

const els = {
  nav: document.getElementById('nav'),
  search: document.getElementById('search'),
  content: document.getElementById('content'),
  crumbs: document.getElementById('crumbs'),
  pageTitle: document.getElementById('pageTitle'),
  pageSubtitle: document.getElementById('pageSubtitle'),
  progressLabel: document.getElementById('progressLabel'),
  progressBar: document.getElementById('progressBar'),
  bookmarkCount: document.getElementById('bookmarkCount'),
  bookmarkCard: document.getElementById('bookmarkCard'),
  modeHome: document.getElementById('modeHome'),
  modeStudy: document.getElementById('modeStudy'),
  modeReview: document.getElementById('modeReview'),
  modeCga: document.getElementById('modeCga'),
  modeAi: document.getElementById('modeAi'),
  modeFocus: document.getElementById('modeFocus'),
  modeTheme: document.getElementById('modeTheme'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  mobileSearch: document.getElementById('mobileSearch'),
  mobileThemeInline: document.getElementById('mobileThemeInline'),
  mobileHome: document.getElementById('mobileHome'),
  mobileStudy: document.getElementById('mobileStudy'),
  mobileReview: document.getElementById('mobileReview'),
  mobileCga: document.getElementById('mobileCga'),
  mobileAi: document.getElementById('mobileAi'),
  mobileTheme: document.getElementById('mobileTheme'),
};

function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function safeText(v, fallback=''){
  const text = String(v ?? fallback ?? '');
  const cleaned = text
    .replace(new RegExp(`\\b${'undef' + 'ined'}(?:\\s+(?:section|blocks?))?\\b`, 'gi'), '')
    .replace(/\bnull\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || String(fallback || '');
}
function norm(s){return String(s).toLowerCase().replace(/[^a-z0-9\s]+/g,' ').replace(/\s+/g,' ').trim();}
function topicKey(partSlug, topicSlug){return `${partSlug}/${topicSlug}`;}
function setStorage(){
  localStorage.setItem('im-bookmarks', JSON.stringify([...state.bookmarks]));
  localStorage.setItem('im-done', JSON.stringify([...state.done]));
  localStorage.setItem('im-focus', JSON.stringify(!!state.focus));
  localStorage.setItem('im-sidebar-open', JSON.stringify(!!state.sidebarOpen));
  localStorage.setItem('im-theme', state.theme);
  localStorage.setItem('im-ai-history', JSON.stringify(state.aiHistory.slice(-40)));
}
function allModules(){ return normalizeSections(state.data?.parts); }
function allResources(){ return normalizeSections(state.data?.resources); }
function normalizeBlocks(blocks){ return Array.isArray(blocks) ? blocks : []; }
function normalizeSections(sections){ return Array.isArray(sections) ? sections : []; }
function normalizeData(data){
  const out = data || {};
  out.parts = normalizeSections(out.parts).map(part => ({
    ...part,
    topics: normalizeSections(part.topics).map(topic => ({
      ...topic,
      partTitle: safeText(topic.partTitle, part.display || part.title || ''),
      partSlug: safeText(topic.partSlug, part.slug || ''),
      intro: normalizeBlocks(topic.intro),
      sections: normalizeSections(topic.sections).map(sec => ({...sec, blocks: normalizeBlocks(sec.blocks)})),
    })),
  }));
  out.resources = normalizeSections(out.resources).map(page => ({
    ...page,
    intro: normalizeBlocks(page.intro),
    sections: normalizeSections(page.sections).map(sec => ({...sec, blocks: normalizeBlocks(sec.blocks)})),
  }));
  if (!out.resources.some(page => page.slug === 'cga-brillian')) {
    out.resources.unshift({
      kind:'resource', title:'Clinical Tools', display:'Clinical Tools', slug:'cga-brillian', searchText:'clinical tools cga ttv frailty vital signs',
      intro:[{type:'p', text:'CGA dan TTV terintegrasi langsung ke LMS Wiki.'}], sections:[]
    });
  }
  return out;
}
function allTopics(){ return allModules().flatMap(p => normalizeSections(p.topics).map(t => ({...t, part: p}))); }
function allPages(){ return [...allModules().map(p => ({kind:'module', ...p})), ...allResources().map(r => ({kind:'resource', ...r}))]; }
function topicDoneCount(){ return allTopics().filter(t => state.done.has(topicKey(t.partSlug, t.slug))).length; }
function totalTopicSections(){ return allTopics().reduce((n,t) => n + normalizeSections(t.sections).length, 0); }
function updateStats(){
  const total = allTopics().length || 1;
  const done = topicDoneCount();
  const pct = Math.round(done * 100 / total);
  els.progressLabel.textContent = `${pct}%`;
  els.progressBar.style.width = `${pct}%`;
  els.bookmarkCount.textContent = state.bookmarks.size;
}
function setTheme(){
  document.body.classList.toggle('dark', state.theme === 'dark');
  if (els.modeTheme) {
    els.modeTheme.innerHTML = state.theme === 'dark'
      ? '<span class="theme-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/></svg></span>'
      : '<span class="theme-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.8 8.8 0 1 0 10.6 10.6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>';
    els.modeTheme.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    els.modeTheme.title = state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
  if (els.mobileTheme) {
    els.mobileTheme.innerHTML = state.theme === 'dark' ? '<span aria-hidden="true">☀</span>' : '<span aria-hidden="true">☾</span>';
  }
  if (els.mobileThemeInline) {
    els.mobileThemeInline.innerHTML = state.theme === 'dark'
      ? '<span class="theme-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/></svg></span><span>Light mode</span>'
      : '<span class="theme-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.8 8.8 0 1 0 10.6 10.6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span><span>Dark mode</span>';
    els.mobileThemeInline.title = state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}
function setFocus(){
  document.body.classList.toggle('focus-mode', !!state.focus);
  if (els.modeFocus) els.modeFocus.classList.toggle('active', !!state.focus);
}
function setSidebar(){
  const mobile = window.matchMedia('(max-width: 720px)').matches;
  const open = mobile ? false : !!state.sidebarOpen;
  if (mobile && state.sidebarOpen) {
    state.sidebarOpen = false;
    localStorage.setItem('im-sidebar-open', 'false');
  }
  document.body.classList.toggle('sidebar-open', open);
  if (els.nav?.closest('.sidebar')) {
    els.nav.closest('.sidebar').classList.toggle('is-open', open);
  }
  if (els.sidebarBackdrop) els.sidebarBackdrop.classList.toggle('is-open', open);
}
function setMobileDock(){
  const route = parseRoute();
  const activeResource = route.type === 'resource' && route.slug === 'cga-brillian';
  const activeAi = route.type === 'ai';
  const toggle = (el, active) => { if (el) el.classList.toggle('active', !!active); };
  toggle(els.mobileHome, state.mode === 'home' && !activeResource && !activeAi);
  toggle(els.mobileStudy, state.mode === 'study');
  toggle(els.mobileReview, state.mode === 'review');
  toggle(els.mobileCga, activeResource);
  toggle(els.mobileAi, activeAi);
}
function syncSearchInputs(value){
  if (els.search && els.search.value !== value) els.search.value = value;
  if (els.mobileSearch && els.mobileSearch.value !== value) els.mobileSearch.value = value;
}
function goHomeMode(mode){
  state.mode = mode;
  state.sidebarOpen = false;
  setStorage();
  setSidebar();
  if (location.hash !== '#home') location.hash = '#home';
  else render();
}
function setRoute(){
  state.route = location.hash.replace(/^#/, '') || 'home';
  state.sidebarOpen = false;
  setStorage();
  setSidebar();
  render();
}
function parseRoute(){
  const parts = state.route.split('/').filter(Boolean);
  const slugPart = (parts[1] || '').split('#')[0];
  const anchor = (parts[1] || '').includes('#') ? (parts[1] || '').split('#').slice(1).join('#') : '';
  if (parts[0] === 'part' && slugPart) return {type:'part', slug: slugPart, anchor};
  if (parts[0] === 'topic' && slugPart) return {type:'topic', slug: slugPart, anchor};
  if (parts[0] === 'resource' && slugPart) return {type:'resource', slug: slugPart, anchor};
  if (parts[0] === 'bookmarks') return {type:'bookmarks'};
  if (parts[0] === 'ai-tutor') return {type:'ai'};
  return {type:'home'};
}
function summaryFromBlocks(blocks){
  const t = [];
  for (const b of normalizeBlocks(blocks)) {
    if (b.type === 'p' || b.type === 'bullet' || b.type === 'num') t.push(b.text);
    if (b.type === 'table') t.push((b.rows?.[0] || []).filter(Boolean).join(' · '));
    if (t.join(' ').length > 220) break;
  }
  return t.join(' ').replace(/\s+/g,' ').trim();
}
function blocksSearchText(blocks){
  const buf = [];
  for (const blk of normalizeBlocks(blocks)) {
    if (blk.type === 'table') normalizeSections(blk.rows).forEach(row => buf.push(...normalizeSections(row)));
    else if (blk.text) buf.push(blk.text);
  }
  return buf.join(' ');
}
function sectionSearchText(sec){
  return [sec.title, sec.display, sec.searchText, blocksSearchText(sec.blocks)].filter(Boolean).join(' ');
}
function topicSearchText(topic){
  const buf = [topic.title, topic.display, topic.partTitle];
  for (const blk of topic.intro || []) {
    if (blk.type === 'table') blk.rows.flat().forEach(v => buf.push(v));
    else if (blk.text) buf.push(blk.text);
  }
  for (const sec of topic.sections) {
    buf.push(sec.title);
    for (const blk of sec.blocks) {
      if (blk.type === 'table') blk.rows.flat().forEach(v => buf.push(v));
      else if (blk.text) buf.push(blk.text);
    }
  }
  return norm(buf.join(' '));
}
function scoreMatch(text, q){
  const t = norm(text), query = norm(q);
  if (!query) return 0;
  if (t === query) return 1000;
  if (t.startsWith(query)) return 700;
  let score = 0;
  const qTokens = query.split(' ').filter(Boolean);
  const tTokens = t.split(' ').filter(Boolean);
  for (const token of qTokens) {
    if (t.includes(token)) score += 40 + Math.min(40, token.length * 2);
    else if (tTokens.find(x => x.startsWith(token) || token.startsWith(x))) score += 12;
  }
  if (t.includes(query)) score += 200;
  score += Math.min(40, qTokens.length * 5);
  return score;
}
function resourcePageUrl(pageSlug){ return pageSlug === 'cga-brillian' ? '#resource/cga-brillian' : `#resource/${pageSlug}`; }
function sectionLabel(count){ return count > 0 ? `${count} section${count === 1 ? '' : 's'}` : 'Reference page'; }
function titleBoost(title, query){
  const t = norm(title);
  if (!query || !t) return 0;
  if (t === query) return 2000;
  if (t.includes(query)) return 900;
  return 0;
}
function searchAll(q){
  const query = norm(q);
  if (!query) return [];
  const results = [];
  for (const part of allModules()) {
    const partScore = scoreMatch(part.display + ' ' + part.title, query);
    if (partScore) results.push({type:'module', score: partScore + titleBoost(part.display, query), title: part.display, subtitle: `${part.topics.length} topics`, href:`#part/${part.slug}`});
    for (const topic of part.topics) {
      const text = topicSearchText({...topic, partTitle: part.display});
      const topicScore = scoreMatch(topic.display + ' ' + topic.title + ' ' + text, query);
      if (topicScore) results.push({type:'topic', score: topicScore + 10 + titleBoost(`${topic.display} ${topic.title}`, query), title: topic.display, subtitle: `${part.display} · ${topic.sections[0]?.title || 'Open topic'}`, href:`#topic/${topic.slug}`});
      for (const sec of topic.sections) {
        const secText = sectionSearchText(sec);
        const secScore = scoreMatch(secText, query);
        if (secScore) results.push({type:'section', score: secScore + 20 + titleBoost(sec.title, query), title: sec.title, subtitle: `${topic.display} · ${part.display}`, href:`#topic/${topic.slug}#sec-${sec.slug}`});
      }
    }
  }
  for (const page of allResources()) {
    const pageScore = scoreMatch([page.display, page.title, page.searchText].filter(Boolean).join(' '), query);
    if (pageScore) results.push({type:'resource', score: pageScore + titleBoost(`${page.display} ${page.title}`, query), title: safeText(page.display, page.title || 'Resource'), subtitle: sectionLabel(normalizeSections(page.sections).length), href:resourcePageUrl(page.slug)});
    for (const sec of normalizeSections(page.sections)) {
      const secScore = scoreMatch(sectionSearchText(sec), query);
      if (secScore) results.push({type:'resource section', score: secScore + 10 + titleBoost(`${sec.display} ${sec.title}`, query), title: safeText(sec.display, sec.title || 'Section'), subtitle: safeText(page.display, 'Resource'), href:`#resource/${page.slug}#sec-${sec.slug}`});
    }
  }
  return results.sort((a,b) => b.score - a.score).slice(0, 30);
}
function renderNav(){
  const query = norm(state.search.trim());
  const moduleHtml = allModules().map(part => {
    const topics = part.topics
      .map(t => ({t, score: query ? scoreMatch(`${t.display} ${t.title} ${t.searchText || ''}`, query) : 1}))
      .filter(x => !query || x.score > 0)
      .sort((a,b) => b.score - a.score)
      .map(x => x.t);
    const activePart = parseRoute().type !== 'home' && state.route.includes(part.slug);
    return `<div class="nav-part"><details ${activePart ? 'open' : ''}>
      <summary><span>${esc(safeText(part.display, part.title || 'Module'))}</span><span class="part-meta">${topics.length} topic</span></summary>
      <div class="nav-topics">${topics.map(t => `<a class="nav-topic ${state.route === `topic/${t.slug}` ? 'active' : ''}" href="#topic/${t.slug}" title="${esc(safeText(t.title, t.display || 'Topic'))}">${esc(safeText(t.display, t.title || 'Topic'))}</a>`).join('') || '<div class="empty" style="padding:10px 12px">No match</div>'}</div>
    </details></div>`;
  }).join('');
  const resourceHtml = allResources().map(page => {
    const pageText = [page.display, page.title, page.searchText, blocksSearchText(page.intro)].filter(Boolean).join(' ');
    const pageMatches = !query || scoreMatch(pageText, query) > 0;
    const sections = (page.sections || [])
      .map(s => ({s, score: query ? scoreMatch(`${s.display} ${s.title} ${s.searchText || ''} ${blocksSearchText(s.blocks)}`, query) : 1}))
      .filter(x => !query || x.score > 0)
      .sort((a,b) => b.score - a.score)
      .map(x => x.s);
    const active = parseRoute().type === 'resource' && state.route.includes(page.slug);
    const pageLink = pageMatches ? `<a class="nav-topic ${state.route === `resource/${page.slug}` ? 'active' : ''}" href="#resource/${page.slug}" title="Open ${esc(safeText(page.display, page.title || 'Resource'))}">Overview / open page</a>` : '';
    const sectionLinks = sections.map(s => `<a class="nav-topic ${state.route.includes(`resource/${page.slug}#sec-${s.slug}`) ? 'active' : ''}" href="#resource/${page.slug}#sec-${s.slug}" title="${esc(safeText(s.title, s.display || 'Section'))}">${esc(safeText(s.display, s.title || 'Section'))}</a>`).join('');
    const total = normalizeSections(page.sections).length || (page.intro?.length ? 1 : 0);
    return `<div class="nav-part"><details ${active ? 'open' : ''}>
      <summary><span>${esc(safeText(page.display, page.title || 'Resource'))}</span><span class="part-meta">${sectionLabel(total)}</span></summary>
      <div class="nav-topics">${pageLink}${sectionLinks || ''}${!pageLink && !sectionLinks ? `<div class="empty" style="padding:10px 12px">No match</div>` : ''}</div>
    </details></div>`;
  }).join('');
  els.nav.innerHTML = moduleHtml + (resourceHtml ? `<div class="section-title" style="margin:14px 0 8px"><h3>Resources</h3><span>references & review</span></div>${resourceHtml}` : '');
}
function cleanSectionTitle(title){ return safeText(title, 'Section'); }
function renderTable(rows){
  const htmlRows = normalizeBlocks(rows).map((row, i) => `<tr>${normalizeBlocks(row).map(cell => i===0 ? `<th>${esc(safeText(cell, ''))}</th>` : `<td>${esc(safeText(cell, ''))}</td>`).join('')}</tr>`).join('');
  return `<div class="doc-table-wrap"><table class="doc-table">${htmlRows}</table></div>`;
}
function renderBlocks(blocks){
  let html='';
  let mode=null; let items=[];
  const flushList=()=>{
    if (!items.length) return;
    const tag = mode === 'num' ? 'ol' : 'ul';
    const clean = items.map(x => safeText(x, '')).filter(Boolean);
    if (clean.length) html += `<${tag}>${clean.map(x => `<li>${esc(x)}</li>`).join('')}</${tag}>`;
    mode=null; items=[];
  };
  for (const b of normalizeBlocks(blocks)) {
    if (b.type === 'bullet') { if (mode && mode !== 'bullet') flushList(); mode = 'bullet'; items.push(b.text); continue; }
    if (b.type === 'num') { if (mode && mode !== 'num') flushList(); mode = 'num'; items.push(b.text); continue; }
    flushList();
    if (b.type === 'p') { const text = safeText(b.text, ''); if (text) html += `<p>${esc(text)}</p>`; }
    else if (b.type === 'table') html += renderTable(b.rows);
  }
  flushList();
  return html;
}
function openSearchHit(hit){
  if (!hit) return;
  state.search = '';
  syncSearchInputs('');
  location.hash = hit.href;
}
function searchGroup(type){ return type === 'resource section' ? 'resource' : type; }
function renderSearchResults(q){
  const all = searchAll(q);
  const counts = all.reduce((m,r) => ((m[searchGroup(r.type)]=(m[searchGroup(r.type)]||0)+1), m), {});
  const filters = [
    ['all','All',all.length], ['topic','Topics',counts.topic||0], ['section','Sections',counts.section||0],
    ['module','Modules',counts.module||0], ['resource','Resources',counts.resource||0]
  ];
  const active = filters.some(([id]) => id === state.searchFilter) ? state.searchFilter : 'all';
  const results = active === 'all' ? all : all.filter(r => searchGroup(r.type) === active);
  return `
    <div class="section-card search-panel">
      <h3>Search results for “${esc(q)}”</h3>
      <div class="toolbar search-filter-row" role="tablist" aria-label="Search filters">
        ${filters.map(([id,label,count]) => `<button type="button" class="badge search-filter ${active===id?'active':''}" data-search-filter="${id}">${label} <span>${count}</span></button>`).join('')}
      </div>
      <div class="search-results">
        ${(results.length ? results : [{type:'none',score:0,title:'No match',subtitle:'Try another filter or keyword',href:'#home'}]).map(r => `
          <a class="search-hit" href="${r.href}">
            <div class="score">${r.type}${r.score ? ` · ${r.score}` : ''}</div>
            <strong>${esc(safeText(r.title, 'Untitled'))}</strong>
            <span>${esc(safeText(r.subtitle, ''))}</span>
          </a>`).join('')}
      </div>
    </div>`;
}
function renderHome(){
  const topics = allTopics();
  const recent = topics.slice(0, 6);
  const modules = allModules().filter(p => p.topics.length).map(part => {
    const first = part.topics[0];
    const last = part.topics[part.topics.length-1];
    return `<div class="module-card" data-href="#part/${part.slug}">
      <span class="badge">${part.topics.length} topics</span>
      <span class="card-arrow">↗</span>
      <h3>${esc(safeText(part.display, part.title || 'Module'))}</h3>
      <p>${esc(safeText(first.display, first.title || 'Topic'))} → ${esc(safeText(last.display, last.title || 'Topic'))}</p>
    </div>`;
  }).join('');
  const next = topics.find(t => !state.done.has(topicKey(t.partSlug, t.slug))) || topics[0] || {slug:'home'};
  const done = topicDoneCount();
  const searchBlock = state.search.trim().length >= 2 ? renderSearchResults(state.search.trim()) : '';
  els.crumbs.textContent = 'Home';
  els.pageTitle.textContent = 'IPD Brillian';
  els.pageSubtitle.textContent = 'Rapi, cepat dicari, dan fokus ke inti high-yield.';
  els.content.innerHTML = `
    ${searchBlock}
    <div class="hero-grid">
      <div class="card hero pad">
        <span class="badge">High-yield study guide</span>
        <h2>Rapi, cepat dicari, dan enak dipakai ulang untuk review klinis.</h2>
        <p>Semua materi dipecah per part dan topic, lalu dirapikan supaya lebih tenang, lebih ringkas, dan lebih fokus ke inti yang sering keluar.</p>
        <div class="stat-row">
          <div class="stat"><span>Modules</span><strong>${state.data.stats.modules}</strong></div>
          <div class="stat"><span>Topics</span><strong>${state.data.stats.topics}</strong></div>
          <div class="stat"><span>Resources</span><strong>${state.data.stats.resources}</strong></div>
          <div class="stat"><span>Done</span><strong>${done}</strong></div>
        </div>
      </div>
      <div class="card pad">
        <h3 style="margin-top:0">Lanjutkan belajar</h3>
        <p style="color:var(--muted);line-height:1.6">Buka topik berikutnya atau lompat ke modul yang lagi kamu kejar.</p>
        <div class="toolbar">
          <a class="btn primary" href="#topic/${next.slug}">Resume</a>
          <a class="btn" href="#resource/cga-brillian">Open Clinical Tools</a>
          <button class="btn" id="resetDone">Reset progress</button>
        </div>
        <div class="note">Tip: search buat lompat langsung ke diagnosis, obat, protocol, atau section tertentu.</div>
      </div>
    </div>
    <div class="section-title"><h3>Modules</h3><span>klik untuk masuk ke wiki section</span></div>
    <div class="module-grid">${modules}</div>
    <div class="section-title"><h3>Quick access</h3><span>recent · high-yield</span></div>
    <div class="card pad">
      <div class="toolbar">${recent.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(safeText(t.display, 'Topic'))}</a>`).join('')}</div>
    </div>
  `;
  const resetBtn = document.getElementById('resetDone');
  if (resetBtn) resetBtn.onclick = () => { state.done.clear(); setStorage(); updateStats(); render(); };
  document.querySelectorAll('[data-href]').forEach(el => el.onclick = () => location.hash = el.dataset.href || '#home');
}
function renderPart(slug){
  const part = allModules().find(p => p.slug === slug);
  if (!part) return renderNotFound();
  els.crumbs.textContent = `Home / ${safeText(part.display, 'Module')}`;
  els.pageTitle.textContent = safeText(part.display, 'Module');
  els.pageSubtitle.textContent = `${part.topics.length} topic${part.topics.length === 1 ? '' : 's'} · curated learning path`;
  els.content.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><span>Topics</span><strong>${part.topics.length}</strong></div>
      <div class="kpi"><span>Completed</span><strong>${part.topics.filter(t => state.done.has(topicKey(part.slug, t.slug))).length}</strong></div>
      <div class="kpi"><span>First topic</span><strong style="font-size:1rem">${esc(safeText(part.topics[0]?.display, '-'))}</strong></div>
    </div>
    <div class="section-title"><h3>Topics in this module</h3><span>urut sesuai materi</span></div>
    <div class="module-grid">
      ${part.topics.map(t => `
        <div class="module-card" data-href="#topic/${t.slug}">
          <span class="badge">${sectionLabel(Number.isFinite(t.sectionCount) ? t.sectionCount : 0)}</span>
          <span class="card-arrow">↗</span>
          <h3>${esc(safeText(t.display, 'Untitled topic'))}</h3>
          <p>${esc(safeText(t.sections[0]?.title, 'Core clinical note'))}</p>
        </div>`).join('')}
    </div>`;
  document.querySelectorAll('[data-href]').forEach(el => el.onclick = () => location.hash = el.dataset.href || '#home');
}
function renderResource(slug){
  const page = allResources().find(p => p.slug === slug);
  if (!page) return renderNotFound();
  if (page.slug === 'cga-brillian') return renderCgaBrillianResource(page);
  els.crumbs.textContent = `Home / Resources / ${safeText(page.display, 'Resource')}`;
  els.pageTitle.textContent = safeText(page.display, 'Resource');
  const pageSections = normalizeSections(page.sections);
  els.pageSubtitle.textContent = `${sectionLabel(pageSections.length)} · reference page`;
  const intro = page.intro?.length ? `<div class="section-card" id="sec-overview"><h3>Overview</h3>${renderBlocks(page.intro)}</div>` : '';
  const sections = pageSections.map(sec => `<div class="section-card" id="sec-${sec.slug}"><h3>${esc(cleanSectionTitle(sec.display || sec.title))}</h3>${renderBlocks(sec.blocks)}</div>`).join('');
  const tocSections = pageSections.length ? pageSections : [{slug:'overview', display:'Overview', blocks: page.intro || []}];
  const toc = tocSections.map(sec => `<a href="#resource/${page.slug}#sec-${sec.slug}">${esc(cleanSectionTitle(sec.display || sec.title))}</a>`).join('');
  els.content.innerHTML = `
    <div class="view-grid">
      <article class="card article">
        <div class="article-head">
          <div>
            <span class="badge">Resource</span>
            <h2>${esc(safeText(page.display, 'Resource'))}</h2>
            <p>${sectionLabel(pageSections.length)}</p>
          </div>
        </div>
        ${intro}
        ${sections || ''}
        ${!sections && !page.intro?.length ? `<div class="section-card" id="sec-overview"><h3>Overview</h3><p>No detailed section yet.</p></div>` : ''}
      </article>
      <aside class="card toc">
        <h4>On this page</h4>
        <a href="#resource/${page.slug}">Top</a>
        ${toc}
      </aside>
    </div>`;
  if (parseRoute().anchor) {
    requestAnimationFrame(() => document.getElementById(parseRoute().anchor)?.scrollIntoView({block:'start'}));
  }
}
function renderCgaBrillianResource(page){
  els.crumbs.textContent = `Home / Resources / ${safeText(page.display, 'Clinical Tools')}`;
  els.pageTitle.textContent = safeText(page.display, 'Clinical Tools');
  els.pageSubtitle.textContent = 'CGA + TTV tools inside LMS Wiki';
  const src = './cga-brillian/index.html';
  els.content.innerHTML = `
    <div class="view-grid cga-view">
      <article class="card article cga-embed-card">
        <div class="article-head">
          <div>
            <span class="badge">Interactive feature</span>
            <h2 style="margin-top:10px">Clinical Tools</h2>
            <p>${esc(safeText(page.intro?.[0]?.text, 'CGA dan TTV terintegrasi langsung ke LMS Wiki.'))}</p>
          </div>
          <div class="toolbar" style="margin:0;justify-content:flex-end">
            <a class="btn primary" href="${src}" target="_blank" rel="noreferrer">Open full page</a>
          </div>
        </div>
        <div class="cga-intro">
          <div class="note">Di dalam page ini ada dua tool: CGA dan TTV. Bisa dibuka full page kalau mau input lebih nyaman.</div>
          <div class="resource-frame">
            <iframe src="${src}" title="Clinical Tools" loading="lazy"></iframe>
          </div>
        </div>
      </article>
      <aside class="card toc">
        <h4>Quick actions</h4>
        <a href="#home">Back home</a>
        <a href="${src}" target="_blank" rel="noreferrer">Open full page</a>
      </aside>
    </div>`;
}
function sectionQuizSummary(sec){
  const text = summaryFromBlocks(sec.blocks);
  return safeText(text, safeText(sec.display || sec.title, 'Core point'));
}
function buildQuiz(topic){
  const candidates = normalizeSections(topic.sections)
    .filter(sec => sectionQuizSummary(sec).length > 8)
    .slice(0, 6);
  const pool = candidates.map(sec => ({
    label: safeText(sec.display || sec.title, 'Section'),
    summary: sectionQuizSummary(sec),
  }));
  return pool.slice(0, 4).map((item, idx) => {
    const distractors = pool
      .filter(x => x.summary !== item.summary)
      .map(x => x.summary)
      .slice(0, 3);
    while (distractors.length < 3) distractors.push(topic.display);
    const options = [item.summary, ...distractors].map((text, optIdx) => ({
      id: `q${idx}_o${optIdx}`,
      text,
      correct: optIdx === 0,
    })).sort((a,b) => a.text.localeCompare(b.text));
    const answerId = options.find(o => o.correct)?.id;
    return {
      id: `q${idx}`,
      question: `Pilih ringkasan yang paling sesuai dengan section: ${item.label}`,
      options,
      answerId,
      explanation: item.summary,
    };
  });
}
function renderStudyTools(topic){
  const quiz = buildQuiz(topic);
  const key = topicKey(topic.partSlug, topic.slug);
  const quizState = state.quizState[key] || {index: 0, answers: {}, finished: false};
  const currentQuiz = quizState.finished ? null : (quiz[quizState.index] || quiz[0]);
  const chosen = currentQuiz ? quizState.answers?.[currentQuiz.id] : null;
  const answeredCount = Object.keys(quizState.answers || {}).length;
  const quizScore = quiz.reduce((acc, q) => acc + (quizState.answers?.[q.id] === q.answerId ? 1 : 0), 0);
  const quizProgress = quiz.length ? Math.round((answeredCount / quiz.length) * 100) : 0;
  const chosenOption = currentQuiz ? currentQuiz.options.find(o => o.id === chosen) : null;
  const correctOption = currentQuiz ? currentQuiz.options.find(o => o.id === currentQuiz.answerId) : null;
  const quizOptions = currentQuiz ? currentQuiz.options.map(opt => {
    const cls = chosen ? (opt.id === currentQuiz.answerId ? 'correct' : opt.id === chosen ? 'wrong' : '') : '';
    return `<button class="option ${cls}" data-answer-id="${esc(opt.id)}" ${chosen ? 'disabled' : ''}>${esc(opt.text)}</button>`;
  }).join('') : '';
  return `
    <div class="section-card">
      <h3>Study tools</h3>
      <div class="quiz-shell">
        <div class="section-title" style="margin-top:16px"><h3>Quick quiz</h3><span>${answeredCount}/${quiz.length} answered</span></div>
        <div class="quiz-progress-line"><div style="width:${quizProgress}%"></div></div>
        <div class="quiz-meta-row">
          <span class="badge">Score ${quizScore}/${quiz.length}</span>
          <span class="badge">Question ${quizState.index + 1}/${quiz.length || 1}</span>
        </div>
        ${currentQuiz ? `<div class="quiz" data-qid="${currentQuiz.id}">
          <h4>${esc(currentQuiz.question)}</h4>
          <p class="quiz-hint">Pilih jawaban terbaik, lalu lihat penjelasan singkatnya.</p>
          ${quizOptions}
          <div class="feedback">${chosen ? (chosen === currentQuiz.answerId ? 'Benar — pilihan sesuai.' : `Jawaban terbaik: ${esc(correctOption?.text || currentQuiz.explanation)}`) : 'Pilih satu opsi untuk lanjut.'}</div>
          ${chosen ? `<div class="quiz-explanation"><strong>Pembahasan:</strong> ${esc(currentQuiz.explanation)}${chosenOption && chosen !== currentQuiz.answerId ? `<br><strong>Yang kamu pilih:</strong> ${esc(chosenOption.text)}` : ''}</div>` : ''}
          <div class="toolbar" style="margin-top:14px">
            <button class="btn" id="quizPrev" ${quizState.index === 0 ? 'disabled' : ''}>Prev</button>
            <button class="btn primary" id="quizNext" ${!chosen ? 'disabled' : ''}>${quizState.index >= quiz.length - 1 ? 'Finish' : 'Next'}</button>
            <button class="btn" id="quizReset">Reset quiz</button>
          </div>
        </div>` : `<div class="quiz"><h4>Quiz complete</h4><p class="quiz-hint">You finished all questions for this topic.</p><div class="quiz-explanation"><strong>Score:</strong> ${quizScore}/${quiz.length}</div><div class="toolbar" style="margin-top:14px"><button class="btn primary" id="quizReset">Review again</button></div></div>`}
      </div>
    </div>`;
}
function renderTopic(slug){
  const topic = allTopics().find(t => t.slug === slug);
  if (!topic) return renderNotFound();
  const key = topicKey(topic.partSlug, topic.slug);
  const bookmarked = state.bookmarks.has(key);
  const done = state.done.has(key);
  const sections = topic.sections.map(sec => `<div class="section-card" id="sec-${sec.slug}"><h3>${esc(cleanSectionTitle(sec.title))}</h3>${renderBlocks(sec.blocks)}</div>`).join('');
  const intro = topic.intro.length ? `<div class="section-card"><h3>Overview</h3>${renderBlocks(topic.intro)}</div>` : '';
  const toc = topic.sections.map(sec => `<a href="#topic/${topic.slug}#sec-${sec.slug}">${esc(cleanSectionTitle(sec.title))}</a>`).join('');
  els.crumbs.textContent = `Home / ${safeText(topic.partTitle, 'Module')} / ${topic.display}`;
  els.pageTitle.textContent = topic.display;
  els.pageSubtitle.textContent = `${sectionLabel(topic.sectionCount)} · ${safeText(topic.partTitle, 'Module')} · high-yield review`;
  els.content.innerHTML = `
    <div class="view-grid">
      <article class="card article">
        <div class="article-head">
          <div>
            <span class="badge">${esc(safeText(topic.partTitle, 'Module'))}</span>
            <h2>${esc(topic.display)}</h2>
            <p>${sectionLabel(topic.sectionCount)} · ${topic.blockCount || 0} blocks · high-yield review</p>
          </div>
          <div class="toolbar" style="margin:0;justify-content:flex-end">
            <button class="btn ${done?'primary':''}" id="markDone">${done ? 'Completed ✓' : 'Mark done'}</button>
            <button class="btn" id="bookmarkBtn">${bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button>
          </div>
        </div>
        ${intro}
        ${sections}
        ${renderStudyTools(topic)}
      </article>
      <aside class="card toc">
        <h4>On this page</h4>
        <a href="#topic/${topic.slug}">Top</a>
        ${toc}
        <div style="height:12px"></div>
        <div class="note">Progress button buat tracking, search buat lompat cepat ke topik tertentu.</div>
      </aside>
    </div>`;
  document.getElementById('markDone').onclick = () => { state.done.has(key) ? state.done.delete(key) : state.done.add(key); setStorage(); updateStats(); render(); };
  document.getElementById('bookmarkBtn').onclick = () => { state.bookmarks.has(key) ? state.bookmarks.delete(key) : state.bookmarks.add(key); setStorage(); updateStats(); render(); };
  const quiz = buildQuiz(topic);
  document.querySelectorAll('.quiz .option').forEach(btn => {
    btn.onclick = () => {
      const qid = btn.closest('.quiz').dataset.qid;
      const info = state.quizState[key] || {index: 0, answers: {}, finished: false};
      info.answers = info.answers || {};
      info.answers[qid] = btn.dataset.answerId;
      state.quizState[key] = info;
      renderTopic(slug);
    };
  });
  const quizPrev = document.getElementById('quizPrev');
  const quizNext = document.getElementById('quizNext');
  const quizReset = document.getElementById('quizReset');
  if (quizPrev) quizPrev.onclick = () => { const info = state.quizState[key] || {index: 0, answers: {}, finished: false}; info.index = Math.max(0, (info.index || 0) - 1); info.finished = false; state.quizState[key] = info; renderTopic(slug); };
  if (quizNext) quizNext.onclick = () => {
    const info = state.quizState[key] || {index: 0, answers: {}, finished: false};
    const current = quiz[info.index || 0];
    if (current && !info.answers?.[current.id]) return;
    if ((info.index || 0) >= quiz.length - 1) info.finished = true;
    else info.index = Math.min(quiz.length - 1, (info.index || 0) + 1);
    state.quizState[key] = info;
    renderTopic(slug);
  };
  if (quizReset) quizReset.onclick = () => { state.quizState[key] = {index: 0, answers: {}, finished: false}; renderTopic(slug); };
  const anchor = parseRoute().anchor;
  if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({block:'start'}));
}
function renderReview(){
  const topics = allTopics();
  const done = topicDoneCount();
  const pending = topics.length - done;
  els.crumbs.textContent = 'Review';
  els.pageTitle.textContent = 'Review Dashboard';
  els.pageSubtitle.textContent = 'Pantau materi yang sudah dan belum dipelajari.';
  const doneTopics = topics.filter(t => state.done.has(topicKey(t.partSlug, t.slug))).slice(0, 12);
  const pendingTopics = topics.filter(t => !state.done.has(topicKey(t.partSlug, t.slug))).slice(0, 12);
  els.content.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><span>Completed</span><strong>${done}</strong></div>
      <div class="kpi"><span>Remaining</span><strong>${pending}</strong></div>
      <div class="kpi"><span>Bookmarks</span><strong>${state.bookmarks.size}</strong></div>
    </div>
    <div class="section-title"><h3>Done</h3><span>terakhir dipelajari</span></div>
    <div class="toolbar">${doneTopics.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(safeText(t.display, 'Topic'))}</a>`).join('') || '<div class="empty">Belum ada yang ditandai selesai.</div>'}</div>
    <div class="section-title"><h3>Need review</h3><span>lanjutkan belajar</span></div>
    <div class="toolbar">${pendingTopics.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(safeText(t.display, 'Topic'))}</a>`).join('') || '<div class="empty">Semua topik sudah selesai 🎉</div>'}</div>
  `;
}
function renderBookmarks(){
  const topics = allTopics().filter(t => state.bookmarks.has(topicKey(t.partSlug, t.slug)));
  els.crumbs.textContent = 'Bookmarks';
  els.pageTitle.textContent = 'Bookmarked pages';
  els.pageSubtitle.textContent = topics.length ? `${topics.length} halaman tersimpan` : 'Belum ada halaman yang dibookmark.';
  els.content.innerHTML = `
    <div class="card pad bookmark-page">
      <span class="badge">Bookmarks</span>
      <h3 style="margin:10px 0 8px">Halaman yang kamu simpan</h3>
      ${topics.length ? `<div class="bookmark-list">${topics.map(t => `
        <a class="bookmark-hit" href="#topic/${t.slug}">
          <strong>${esc(safeText(t.display, t.title || 'Topic'))}</strong>
          <span>${esc(safeText(t.partTitle, 'Module'))} · ${sectionLabel(t.sectionCount || normalizeSections(t.sections).length)}</span>
        </a>`).join('')}</div>` : '<div class="empty">Belum ada bookmark. Buka topic lalu klik ☆ Bookmark.</div>'}
    </div>`;
}
function renderAiTutor(){
  els.crumbs.textContent = 'AI Tutor';
  els.pageTitle.textContent = 'AI Tutor';
  els.pageSubtitle.textContent = 'Tanya materi IPD Brillian; jawaban dicite dari knowledge base lokal.';
  const messages = state.aiHistory.map(m => `
    <div class="ai-msg ${m.role}">
      <div class="ai-role">${m.role === 'assistant' ? 'AI Tutor' : 'You'}</div>
      <div class="ai-text">${esc(m.content)}</div>
    </div>`).join('') || `<div class="ai-empty">Belum ada chat. Coba: “jelaskan sepsis hour-1 bundle”.</div>`;
  els.content.innerHTML = `
    <div class="ai-layout">
      <section class="card ai-chat-card">
        <div class="ai-disclaimer">Untuk edukasi. Jangan masukkan data pasien identifikatif. Bukan pengganti keputusan klinis.</div>
        <div id="aiMessages" class="ai-messages">${messages}</div>
        <form id="aiForm" class="ai-form">
          <textarea id="aiInput" rows="3" placeholder="Tanya AI Tutor tentang materi internal medicine..."></textarea>
          <div class="toolbar ai-actions">
            <button class="btn primary" type="submit">Ask</button>
            <button class="btn" type="button" data-ai-clear>Clear history</button>
          </div>
        </form>
      </section>
      <aside class="card toc ai-source-panel">
        <h4>Quick prompts</h4>
        <a href="#" data-ai-prompt="Jelaskan topic yang sedang saya buka dengan poin high-yield.">Explain current topic</a>
        <a href="#" data-ai-prompt="Buat 5 pertanyaan quiz dari materi ini beserta jawabannya.">Quiz me</a>
        <a href="#" data-ai-prompt="Ringkas tatalaksana dan red flags paling penting.">Summarize management</a>
        <p class="ai-small">Citation lokal muncul sebagai [1], [2], dst, sesuai section di guide.</p>
      </aside>
    </div>`;
  document.getElementById('aiMessages')?.scrollTo(0, 999999);
}
function blockText(blocks){
  return normalizeBlocks(blocks).map(b => {
    if (b.type === 'table') return normalizeSections(b.rows).map(r => normalizeSections(r).join(' | ')).join('\n');
    if (b.type === 'bullet') return `- ${safeText(b.text,'')}`;
    if (b.type === 'num') return `1. ${safeText(b.text,'')}`;
    return safeText(b.text,'');
  }).filter(Boolean).join('\n');
}
function aiLocalSources(message){
  const hits = searchAll(message).slice(0, 8);
  const sources = [];
  for (const h of hits) {
    let item = null;
    if (h.href.startsWith('#topic/')) {
      const [slug, anchor] = h.href.replace('#topic/','').split('#sec-');
      const t = allTopics().find(x => x.slug === slug);
      const sec = anchor ? normalizeSections(t?.sections).find(s => s.slug === anchor) : normalizeSections(t?.sections)[0];
      if (t && sec) item = {title:t.display, section:sec.title, url:h.href, text:blockText(sec.blocks)};
    } else if (h.href.startsWith('#resource/')) {
      const [slug, anchor] = h.href.replace('#resource/','').split('#sec-');
      const p = allResources().find(x => x.slug === slug);
      const sec = anchor ? normalizeSections(p?.sections).find(s => s.slug === anchor) : null;
      item = sec ? {title:p.display, section:sec.title, url:h.href, text:blockText(sec.blocks)} : {title:p?.display, section:'Overview', url:h.href, text:blockText(p?.intro)};
    }
    if (item?.text) sources.push({...item, id:sources.length+1, text:item.text.slice(0,2600)});
  }
  return sources;
}
async function submitAiTutor(text){
  const message = safeText(text);
  if (!message) return;
  state.aiHistory.push({role:'user', content:message});
  state.aiHistory.push({role:'assistant', content:'Thinking...'});
  setStorage(); renderAiTutor();
  try {
    const sources = aiLocalSources(message);
    const sourceText = sources.map(s => `[${s.id}] ${s.title} — ${s.section}\nURL: ${s.url}\n${s.text}`).join('\n\n');
    const messages = [
      {role:'system', content:'You are AI Tutor for IPD Brillian. Answer in Indonesian. Use ONLY supplied local guide sources. Cite claims with [1], [2]. If insufficient, say source is insufficient. Educational use only, not patient-specific medical advice. Be structured and concise.'},
      ...state.aiHistory.filter(m => m.content !== 'Thinking...').slice(-8).map(m => ({role:m.role, content:m.content.slice(0,1200)})),
      {role:'user', content:`Question: ${message}\n\nLocal guide sources:\n${sourceText}\n\nFormat: Jawaban singkat, Penjelasan, Sources used.`}
    ];
    const res = await fetch('/aiTutor', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({messages})});
    const data = await res.json();
    state.aiHistory.pop();
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    const cites = sources.map(c => `[${c.id}] ${c.title} — ${c.section} (${c.url})`).join('\n');
    state.aiHistory.push({role:'assistant', content:`${data.answer}\n\nModel: ${data.model || 'gpt-5-nano'}${cites ? `\n\nSources:\n${cites}` : ''}`});
  } catch (e) {
    state.aiHistory.pop();
    state.aiHistory.push({role:'assistant', content:`Error: ${e.message || e}`});
  }
  setStorage(); renderAiTutor();
}
function renderStudy(){
  els.crumbs.textContent = 'Study';
  els.pageTitle.textContent = 'Study mode';
  els.pageSubtitle.textContent = 'Fokus ke materi yang paling perlu dilanjutkan.';
  els.content.innerHTML = `
    <div class="card pad" style="margin-bottom:18px">
      <span class="badge">Study mode</span>
      <h3 style="margin:10px 0 8px">Belajar terarah, tanpa lompat-lompat.</h3>
      <div class="note">Gunakan sidebar untuk loncat ke module, lalu buka topic satu per satu dari home.</div>
      <div class="toolbar" style="margin-top:14px">
        <a class="btn primary" href="#home">Back to home</a>
        <a class="btn" href="#resource/cga-brillian">Open Clinical Tools</a>
      </div>
    </div>
    ${renderHomeBody()}
  `;
  bindHomeCards();
}
function renderNotFound(){
  els.crumbs.textContent = 'Not found';
  els.pageTitle.textContent = 'Page not found';
  els.pageSubtitle.textContent = 'Coba pakai search atau balik ke home.';
  els.content.innerHTML = '<div class="card pad"><h3>Halaman tidak ditemukan</h3><p>Gunakan search atau klik module di sidebar.</p></div>';
}
function render(){
  updateStats();
  setTheme();
  setFocus();
  setSidebar();
  setMobileDock();
  renderNav();
  const route = parseRoute();
  els.modeHome.classList.toggle('active', state.mode === 'home');
  els.modeStudy.classList.toggle('active', state.mode === 'study');
  els.modeReview.classList.toggle('active', state.mode === 'review');
  if (els.modeCga) els.modeCga.classList.toggle('active', route.type === 'resource' && route.slug === 'cga-brillian');
  if (els.modeAi) els.modeAi.classList.toggle('active', route.type === 'ai');
  const q = state.search.trim();
  if (q.length >= 2) {
    els.crumbs.textContent = 'Search';
    els.pageTitle.textContent = 'Search results';
    els.pageSubtitle.textContent = `Smart search for “${q}”`;
    els.content.innerHTML = renderSearchResults(q);
    bindHomeCards();
    return;
  }
  if (route.type === 'topic') return renderTopic(route.slug);
  if (route.type === 'resource') return renderResource(route.slug);
  if (route.type === 'part') return renderPart(route.slug);
  if (route.type === 'bookmarks') return renderBookmarks();
  if (route.type === 'ai') return renderAiTutor();
  if (route.type === 'home' && state.mode === 'review') return renderReview();
  if (route.type === 'home' && state.mode === 'study') return renderStudy();
  return renderHome();
}
function renderHomeBody(){
  const topics = allTopics();
  const recent = topics.slice(0, 6);
  const modules = allModules().filter(p => p.topics.length).map(part => {
    const first = part.topics[0];
    const last = part.topics[part.topics.length-1];
    return `<div class="module-card" data-href="#part/${part.slug}">
      <span class="badge">${part.topics.length} topics</span>
      <span class="card-arrow">↗</span>
      <h3>${esc(safeText(part.display, 'Module'))}</h3>
      <p>${esc(safeText(first.display, first.title || 'Topic'))} → ${esc(safeText(last.display, last.title || 'Topic'))}</p>
    </div>`;
  }).join('');
  const next = topics.find(t => !state.done.has(topicKey(t.partSlug, t.slug))) || topics[0] || {slug:'home'};
  const done = topicDoneCount();
  const resources = allResources();
  const resourceCards = resources.map(page => `
    <div class="module-card" data-href="${resourcePageUrl(page.slug)}">
      <span class="badge">${sectionLabel(normalizeSections(page.sections).length)}</span>
      <span class="card-arrow">↗</span>
      <h3>${esc(safeText(page.display, page.title || 'Resource'))}</h3>
      <p>${esc(safeText(normalizeSections(page.sections)[0]?.display || summaryFromBlocks(page.intro), 'Reference page'))}</p>
    </div>`).join('');
  return `
    <div class="hero-grid">
      <div class="card hero pad hero-brand-card">
        <div class="hero-brand-row">
          <img class="hero-app-icon" src="./assets/ipd-brillian-icon.png" alt="IPD Brillian app icon" />
          <span class="badge">IPD Brillian · Clinical companion</span>
        </div>
        <h2>Internal medicine, dirapikan jadi satu workspace klinis.</h2>
        <p>Belajar materi high-yield, cari diagnosis cepat, tracking progress, dan buka Clinical Tools seperti CGA + TTV tanpa keluar dari alur belajar.</p>
        <div class="toolbar hero-actions">
          <a class="btn primary" href="#topic/${next.slug}">Lanjut belajar</a>
          <a class="btn" href="#resource/cga-brillian">Buka Clinical Tools</a>
        </div>
        <div class="stat-row">
          <div class="stat"><span>Modules</span><strong>${state.data.stats.modules}</strong></div>
          <div class="stat"><span>Topics</span><strong>${state.data.stats.topics}</strong></div>
          <div class="stat"><span>Resources</span><strong>${state.data.stats.resources}</strong></div>
          <div class="stat"><span>Sections</span><strong>${state.data.stats.sections || totalTopicSections()}</strong></div>
          <div class="stat"><span>Done</span><strong>${done}</strong></div>
        </div>
      </div>
      <div class="card pad">
        <h3 style="margin-top:0">Continue learning</h3>
        <p style="color:var(--muted);line-height:1.6">Lanjutkan ke topic berikutnya atau buka module yang kamu mau.</p>
        <div class="toolbar">
          <a class="btn primary" href="#topic/${next.slug}">Start / Continue</a>
        <a class="btn" href="#resource/cga-brillian">Open Clinical Tools</a>
          <button class="btn" id="resetDone">Reset progress</button>
        </div>
        <div class="note">Tip: pakai search untuk loncat ke diagnosis, obat, protocol, atau section spesifik.</div>
      </div>
    </div>
    <div class="section-title"><h3>Modules</h3><span>klik untuk masuk ke wiki section</span></div>
    <div class="module-grid">${modules}</div>
    <div class="section-title"><h3>Resources</h3><span>rapid review / reference pages</span></div>
    <div class="module-grid">${resourceCards}</div>
    <div class="section-title"><h3>Quick access</h3><span>recent / high-yield</span></div>
    <div class="card pad">
      <div class="toolbar">${recent.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(safeText(t.display, 'Topic'))}</a>`).join('')}</div>
    </div>`;
}
function renderHomeBodyMobile(){
  const topics = allTopics();
  const next = topics.find(t => !state.done.has(topicKey(t.partSlug, t.slug))) || topics[0] || {slug:'home'};
  return `
    <div class="hero-grid mobile-home-grid">
      <div class="card hero pad hero-brand-card">
        <div class="hero-brand-row mobile-hero-brand-row">
          <img class="hero-app-icon" src="./assets/ipd-brillian-icon.png" alt="IPD Brillian app icon" />
          <span class="badge">IPD Brillian</span>
        </div>
        <h2>Belajar IPD lebih cepat, rapi, dan siap dipakai di klinik.</h2>
        <p>Materi high-yield + Clinical Tools dalam satu app kecil.</p>
        <div class="stat-row mobile-stat-row">
          <div class="stat"><span>Modules</span><strong>${state.data.stats.modules}</strong></div>
          <div class="stat"><span>Topics</span><strong>${state.data.stats.topics}</strong></div>
          <div class="stat"><span>Done</span><strong>${topicDoneCount()}</strong></div>
          <div class="stat"><span>Bookmarked</span><strong>${state.bookmarks.size}</strong></div>
        </div>
      </div>
      <div class="card pad mobile-quick-card">
        <h3 style="margin-top:0">Continue</h3>
        <div class="toolbar">
          <a class="btn primary" href="#topic/${next.slug}">Start / Continue</a>
          <a class="btn" href="#resource/cga-brillian">Open Clinical Tools</a>
        </div>
        <div class="note">Search atau pakai dock di bawah buat pindah cepat.</div>
      </div>
    </div>
    `;
}
function bindHomeCards(){
  document.querySelectorAll('[data-href]').forEach(el => el.onclick = () => {
    location.hash = el.dataset.href || '#home';
    if (window.matchMedia('(max-width: 720px)').matches) { state.sidebarOpen = false; setStorage(); setSidebar(); }
  });
  const resetBtn = document.getElementById('resetDone');
  if (resetBtn) resetBtn.onclick = () => { state.done.clear(); setStorage(); updateStats(); render(); };
}
function renderHome(){
  els.crumbs.textContent = 'Home';
  els.pageTitle.textContent = 'IPD Brillian';
  els.pageSubtitle.textContent = 'Belajar lebih enak: rapi, searchable, dan bisa tracking progress.';
  const mobile = window.matchMedia('(max-width: 720px)').matches;
  const body = mobile ? renderHomeBodyMobile() : renderHomeBody();
  els.content.innerHTML = state.search.trim().length >= 2 ? renderSearchResults(state.search.trim()) + body : body;
  bindHomeCards();
}

async function init(){
  state.data = window.__GUIDE_DATA__ || null;
  if (!state.data) {
    const res = await fetch('./data/guide.json');
    state.data = await res.json();
  }
  state.data = normalizeData(state.data);
  const onSearch = value => { state.search = value; state.searchFilter = 'all'; syncSearchInputs(value); render(); };
  els.search.addEventListener('input', e => onSearch(e.target.value));
  if (els.mobileSearch) els.mobileSearch.addEventListener('input', e => onSearch(e.target.value));
  els.search.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openSearchHit(searchAll(state.search.trim())[0]);
    }
  });
  if (els.mobileSearch) els.mobileSearch.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openSearchHit(searchAll(state.search.trim())[0]);
    }
  });
  els.modeFocus.onclick = () => { state.focus = !state.focus; setStorage(); setFocus(); };
  els.modeTheme.onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; setStorage(); setTheme(); };
  els.modeHome.onclick = () => goHomeMode('home');
  els.modeStudy.onclick = () => goHomeMode('study');
  els.modeReview.onclick = () => goHomeMode('review');
  if (els.modeCga) els.modeCga.onclick = () => { state.mode = 'home'; location.hash = '#resource/cga-brillian'; };
  if (els.modeAi) els.modeAi.onclick = () => { state.mode = 'home'; state.search = ''; syncSearchInputs(''); location.hash = '#ai-tutor'; };
  if (els.bookmarkCard) els.bookmarkCard.onclick = () => { state.search = ''; syncSearchInputs(''); location.hash = '#bookmarks'; };
  if (els.sidebarToggle) els.sidebarToggle.onclick = () => { state.sidebarOpen = !state.sidebarOpen; setStorage(); setSidebar(); };
  if (els.sidebarBackdrop) els.sidebarBackdrop.onclick = () => { state.sidebarOpen = false; setStorage(); setSidebar(); };
  if (els.mobileHome) els.mobileHome.onclick = () => goHomeMode('home');
  if (els.mobileStudy) els.mobileStudy.onclick = () => goHomeMode('study');
  if (els.mobileReview) els.mobileReview.onclick = () => goHomeMode('review');
  if (els.mobileCga) els.mobileCga.onclick = () => { state.mode = 'home'; location.hash = '#resource/cga-brillian'; };
  if (els.mobileAi) els.mobileAi.onclick = () => { state.mode = 'home'; state.search = ''; syncSearchInputs(''); location.hash = '#ai-tutor'; };
  if (els.mobileTheme) els.mobileTheme.onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; setStorage(); setTheme(); };
  if (els.mobileThemeInline) els.mobileThemeInline.onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; setStorage(); setTheme(); };
  if (els.content) els.content.addEventListener('submit', e => {
    if (e.target?.id === 'aiForm') {
      e.preventDefault();
      const input = document.getElementById('aiInput');
      submitAiTutor(input?.value || '');
    }
  });
  if (els.content) els.content.addEventListener('click', e => {
    const prompt = e.target.closest('[data-ai-prompt]');
    if (prompt) { e.preventDefault(); submitAiTutor(prompt.dataset.aiPrompt || ''); return; }
    const clear = e.target.closest('[data-ai-clear]');
    if (clear) { e.preventDefault(); state.aiHistory = []; setStorage(); renderAiTutor(); return; }
    const filter = e.target.closest('[data-search-filter]');
    if (filter) {
      e.preventDefault();
      state.searchFilter = filter.dataset.searchFilter || 'all';
      render();
      return;
    }
    const hit = e.target.closest('.search-hit');
    if (hit) {
      e.preventDefault();
      state.search = '';
      syncSearchInputs('');
      location.hash = hit.getAttribute('href') || '#home';
      if (location.hash === hit.getAttribute('href')) render();
    }
  });
  if (els.nav) els.nav.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link) {
      state.search = '';
      syncSearchInputs('');
      if (window.matchMedia('(max-width: 720px)').matches) {
        state.sidebarOpen = false;
        setStorage();
        setSidebar();
      }
    }
  });
  window.addEventListener('hashchange', setRoute);
  setTheme();
  setFocus();
  syncSearchInputs(state.search);
  setRoute();
}

init();
