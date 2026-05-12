const state = {
  data: null,
  route: 'home',
  search: '',
  mode: 'home',
  theme: localStorage.getItem('im-theme') || 'light',
  focus: JSON.parse(localStorage.getItem('im-focus') || 'false'),
  bookmarks: new Set(JSON.parse(localStorage.getItem('im-bookmarks') || '[]')),
  done: new Set(JSON.parse(localStorage.getItem('im-done') || '[]')),
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
  modeHome: document.getElementById('modeHome'),
  modeStudy: document.getElementById('modeStudy'),
  modeReview: document.getElementById('modeReview'),
  modeCga: document.getElementById('modeCga'),
  modeFocus: document.getElementById('modeFocus'),
  modeTheme: document.getElementById('modeTheme'),
};

function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function safeText(v, fallback=''){ return String(v ?? fallback); }
function norm(s){return String(s).toLowerCase().replace(/[^a-z0-9\s]+/g,' ').replace(/\s+/g,' ').trim();}
function topicKey(partSlug, topicSlug){return `${partSlug}/${topicSlug}`;}
function setStorage(){
  localStorage.setItem('im-bookmarks', JSON.stringify([...state.bookmarks]));
  localStorage.setItem('im-done', JSON.stringify([...state.done]));
  localStorage.setItem('im-focus', JSON.stringify(!!state.focus));
  localStorage.setItem('im-theme', state.theme);
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
      intro: normalizeBlocks(topic.intro),
      sections: normalizeSections(topic.sections).map(sec => ({...sec, blocks: normalizeBlocks(sec.blocks)})),
    })),
  }));
  out.resources = normalizeSections(out.resources).map(page => ({
    ...page,
    intro: normalizeBlocks(page.intro),
    sections: normalizeSections(page.sections).map(sec => ({...sec, blocks: normalizeBlocks(sec.blocks)})),
  }));
  return out;
}
function allTopics(){ return allModules().flatMap(p => normalizeSections(p.topics).map(t => ({...t, part: p}))); }
function allPages(){ return [...allModules().map(p => ({kind:'module', ...p})), ...allResources().map(r => ({kind:'resource', ...r}))]; }
function topicDoneCount(){ return allTopics().filter(t => state.done.has(topicKey(t.partSlug, t.slug))).length; }
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
}
function setFocus(){
  document.body.classList.toggle('focus-mode', !!state.focus);
  if (els.modeFocus) els.modeFocus.classList.toggle('active', !!state.focus);
}
function setRoute(){
  state.route = location.hash.replace(/^#/, '') || 'home';
  render();
}
function parseRoute(){
  const parts = state.route.split('/').filter(Boolean);
  const slugPart = (parts[1] || '').split('#')[0];
  const anchor = (parts[1] || '').includes('#') ? (parts[1] || '').split('#').slice(1).join('#') : '';
  if (parts[0] === 'part' && slugPart) return {type:'part', slug: slugPart, anchor};
  if (parts[0] === 'topic' && slugPart) return {type:'topic', slug: slugPart, anchor};
  if (parts[0] === 'resource' && slugPart) return {type:'resource', slug: slugPart, anchor};
  return {type:'home'};
}
function summaryFromBlocks(blocks){
  const t = [];
  for (const b of normalizeBlocks(blocks)) {
    if (b.type === 'p' || b.type === 'bullet') t.push(b.text);
    if (t.join(' ').length > 220) break;
  }
  return t.join(' ').replace(/\s+/g,' ').trim();
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
function searchAll(q){
  const query = norm(q);
  if (!query) return [];
  const results = [];
  for (const part of allModules()) {
    const partScore = scoreMatch(part.display + ' ' + part.title, query);
    if (partScore) results.push({type:'module', score: partScore, title: part.display, subtitle: `${part.topics.length} topics`, href:`#part/${part.slug}`});
    for (const topic of part.topics) {
      const text = topicSearchText({...topic, partTitle: part.display});
      const topicScore = scoreMatch(topic.display + ' ' + topic.title + ' ' + text, query);
      if (topicScore) results.push({type:'topic', score: topicScore + 10, title: topic.display, subtitle: `${part.display} · ${topic.sections[0]?.title || 'Open topic'}`, href:`#topic/${topic.slug}`});
      for (const sec of topic.sections) {
        const secText = [sec.title, summaryFromBlocks(sec.blocks)].join(' ');
        const secScore = scoreMatch(secText, query);
        if (secScore) results.push({type:'section', score: secScore + 20, title: sec.title, subtitle: `${topic.display} · ${part.display}`, href:`#topic/${topic.slug}#sec-${sec.slug}`});
      }
    }
  }
  for (const page of allResources()) {
    const pageScore = scoreMatch([page.display, page.title, page.searchText].filter(Boolean).join(' '), query);
    if (pageScore) results.push({type:'resource', score: pageScore, title: safeText(page.display, page.title || 'Resource'), subtitle: `${normalizeSections(page.sections).length || 1} sections`, href:resourcePageUrl(page.slug)});
    for (const sec of normalizeSections(page.sections)) {
      const secScore = scoreMatch([sec.title, sec.display, sec.searchText || ''].join(' '), query);
      if (secScore) results.push({type:'resource section', score: secScore + 10, title: safeText(sec.display, sec.title || 'Section'), subtitle: safeText(page.display, 'Resource'), href:`#resource/${page.slug}#sec-${sec.slug}`});
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
    const sections = (page.sections || [])
      .map(s => ({s, score: query ? scoreMatch(`${s.display} ${s.title} ${s.searchText || ''}`, query) : 1}))
      .filter(x => !query || x.score > 0)
      .sort((a,b) => b.score - a.score)
      .map(x => x.s);
    const active = parseRoute().type === 'resource' && state.route.includes(page.slug);
    return `<div class="nav-part"><details ${active ? 'open' : ''}>
      <summary><span>${esc(safeText(page.display, page.title || 'Resource'))}</span><span class="part-meta">${sections.length} section</span></summary>
      <div class="nav-topics">${sections.map(s => `<a class="nav-topic ${state.route.includes(`resource/${page.slug}#sec-${s.slug}`) ? 'active' : ''}" href="#resource/${page.slug}#sec-${s.slug}" title="${esc(safeText(s.title, s.display || 'Section'))}">${esc(safeText(s.display, s.title || 'Section'))}</a>`).join('') || `<div class="empty" style="padding:10px 12px">${query ? 'No match' : 'Open the page'}</div>`}</div>
    </details></div>`;
  }).join('');
  els.nav.innerHTML = moduleHtml + (resourceHtml ? `<div class="section-title" style="margin:14px 0 8px"><h3>Resources</h3><span>references & review</span></div>${resourceHtml}` : '');
}
function renderTable(rows){
  const htmlRows = rows.map((row, i) => `<tr>${row.map(cell => i===0 ? `<th>${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
  return `<table class="doc-table">${htmlRows}</table>`;
}
function renderBlocks(blocks){
  let html='';
  let mode=null; let items=[];
  const flush=()=>{
    if (!items.length) return;
    const tag = mode === 'num' ? 'ol' : 'ul';
    html += `<${tag}>${items.map(x => `<li>${esc(x)}</li>`).join('')}</${tag}>`;
    mode=null; items=[];
  };
  for (const b of normalizeBlocks(blocks)) {
    if (b.type === 'bullet') { if (mode && mode !== 'bullet') flush(); mode = 'bullet'; items.push(b.text); continue; }
    if (b.type === 'num') { if (mode && mode !== 'num') flush(); mode = 'num'; items.push(b.text); continue; }
    flush();
    if (b.type === 'p') html += `<p>${esc(b.text)}</p>`;
    else if (b.type === 'table') html += renderTable(b.rows);
  }
  flush();
  return html;
}
function renderSearchResults(q){
  const results = searchAll(q);
  const counts = results.reduce((m,r) => ((m[r.type]=(m[r.type]||0)+1), m), {});
  return `
    <div class="section-card">
      <h3>Search results for “${esc(q)}”</h3>
      <div class="toolbar">
        <span class="badge">${counts.topic || 0} topics</span>
        <span class="badge">${counts.section || 0} sections</span>
        <span class="badge">${counts.module || 0} modules</span>
        <span class="badge">${(counts.resource || 0) + (counts['resource section'] || 0)} resources</span>
      </div>
    <div class="search-results">
        ${(results.length ? results : [{type:'none',score:0,title:'No match',subtitle:'Try a different keyword',href:'#home'}]).map(r => `
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
  const next = topics.find(t => !state.done.has(topicKey(t.partSlug, t.slug))) || topics[0];
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
          <a class="btn" href="#resource/cga-brillian">Open CGA</a>
          <button class="btn" id="resetDone">Reset progress</button>
        </div>
        <div class="note">Tip: search buat lompat langsung ke diagnosis, obat, protocol, atau section tertentu.</div>
      </div>
    </div>
    <div class="section-title"><h3>Modules</h3><span>klik untuk masuk ke wiki section</span></div>
    <div class="module-grid">${modules}</div>
    <div class="section-title"><h3>Quick access</h3><span>recent · high-yield</span></div>
    <div class="card pad">
      <div class="toolbar">${recent.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(t.display)}</a>`).join('')}</div>
    </div>
  `;
  const resetBtn = document.getElementById('resetDone');
  if (resetBtn) resetBtn.onclick = () => { state.done.clear(); setStorage(); updateStats(); render(); };
  document.querySelectorAll('[data-href]').forEach(el => el.onclick = () => location.hash = el.dataset.href);
}
function renderPart(slug){
  const part = allModules().find(p => p.slug === slug);
  if (!part) return renderNotFound();
  els.crumbs.textContent = `Home / ${part.display}`;
  els.pageTitle.textContent = part.display;
  els.pageSubtitle.textContent = `${part.topics.length} topic · curated learning path`;
  els.content.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><span>Topics</span><strong>${part.topics.length}</strong></div>
      <div class="kpi"><span>Completed</span><strong>${part.topics.filter(t => state.done.has(topicKey(part.slug, t.slug))).length}</strong></div>
      <div class="kpi"><span>First topic</span><strong style="font-size:1rem">${esc(part.topics[0]?.display || '-')}</strong></div>
    </div>
    <div class="section-title"><h3>Topics in this module</h3><span>urut sesuai materi</span></div>
    <div class="module-grid">
      ${part.topics.map(t => `
        <div class="module-card" data-href="#topic/${t.slug}">
          <span class="badge">${t.sectionCount} sections</span>
          <span class="card-arrow">↗</span>
          <h3>${esc(t.display)}</h3>
          <p>${esc((t.sections[0]?.title || 'Core clinical note'))}</p>
        </div>`).join('')}
    </div>`;
  document.querySelectorAll('[data-href]').forEach(el => el.onclick = () => location.hash = el.dataset.href);
}
function renderResource(slug){
  const page = allResources().find(p => p.slug === slug);
  if (!page) return renderNotFound();
  if (page.slug === 'cga-brillian') return renderCgaBrillianResource(page);
  els.crumbs.textContent = `Home / Resources / ${page.display}`;
  els.pageTitle.textContent = page.display;
  const pageSections = normalizeSections(page.sections);
  els.pageSubtitle.textContent = `${pageSections.length || 1} sections · reference page`;
  const intro = page.intro?.length ? `<div class="section-card" id="sec-overview"><h3>Overview</h3>${renderBlocks(page.intro)}</div>` : '';
  const sections = pageSections.map(sec => `<div class="section-card" id="sec-${sec.slug}"><h3>${esc(sec.display || sec.title || 'Section')}</h3>${renderBlocks(sec.blocks)}</div>`).join('');
  const tocSections = pageSections.length ? pageSections : [{slug:'overview', display:'Overview', blocks: page.intro || []}];
  const toc = tocSections.map(sec => `<a href="#resource/${page.slug}#sec-${sec.slug}">${esc(sec.display)}</a>`).join('');
  els.content.innerHTML = `
    <div class="view-grid">
      <article class="card article">
        <div class="article-head">
          <div>
            <span class="badge">Resource</span>
            <h2>${esc(page.display)}</h2>
            <p>${pageSections.length || 1} sections</p>
          </div>
        </div>
        ${intro}
        ${sections || ''}
        ${!sections && !page.intro?.length ? `<div class="section-card" id="sec-overview"><h3>Overview</h3><p>No detailed section yet.</p></div>` : ''}
      </article>
      <aside class="card toc">
        <h4>On this page</h4>
        <a href="#top">Top</a>
        ${toc}
      </aside>
    </div>`;
  if (parseRoute().anchor) {
    requestAnimationFrame(() => document.getElementById(parseRoute().anchor)?.scrollIntoView({block:'start'}));
  }
}
function renderCgaBrillianResource(page){
  els.crumbs.textContent = `Home / Resources / ${page.display}`;
  els.pageTitle.textContent = page.display;
  els.pageSubtitle.textContent = 'Integrated CGA assessment inside LMS Wiki';
  const src = './cga-brillian/index.html';
  els.content.innerHTML = `
    <div class="section-card cga-embed-card">
      <div class="article-head" style="margin-bottom:14px">
        <div>
          <span class="badge">Interactive feature</span>
          <h2 style="margin-top:10px">CGA Brillian</h2>
          <p>${esc(page.intro?.[0]?.text || 'Comprehensive Geriatric Assessment terintegrasi langsung ke LMS Wiki.')}</p>
        </div>
        <div class="toolbar" style="margin:0;justify-content:flex-end">
          <a class="btn primary" href="${src}" target="_blank" rel="noreferrer">Open full page</a>
        </div>
      </div>
      <div class="resource-frame">
        <iframe src="${src}" title="CGA Brillian" loading="lazy"></iframe>
      </div>
    </div>`;
}
function buildQuiz(topic){
  const others = topic.sections.map(sec => summaryFromBlocks(sec.blocks)).filter(Boolean);
  return topic.sections.slice(0, 4).map((sec, idx) => {
    const correct = summaryFromBlocks(sec.blocks) || sec.title;
    const distractors = others.filter(x => x !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
    while (distractors.length < 3) distractors.push(topic.display);
    return {
      id: idx,
      question: `Which option best matches ${sec.title}?`,
      options: [correct, ...distractors].sort(() => Math.random() - 0.5),
      answer: correct,
      explanation: correct,
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
  const quizScore = quiz.reduce((acc, q) => acc + (quizState.answers?.[q.id] === q.answer ? 1 : 0), 0);
  const quizProgress = quiz.length ? Math.round((answeredCount / quiz.length) * 100) : 0;
  const quizOptions = currentQuiz ? currentQuiz.options.map(opt => {
    const cls = chosen ? (opt === currentQuiz.answer ? 'correct' : opt === chosen ? 'wrong' : '') : '';
    return `<button class="option ${cls}" data-answer="${esc(opt)}" ${chosen ? 'disabled' : ''}>${esc(opt)}</button>`;
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
          <div class="feedback">${chosen ? (chosen === currentQuiz.answer ? 'Correct — good catch.' : `Best answer: ${esc(currentQuiz.answer)}`) : 'Choose one option to continue.'}</div>
          ${chosen ? `<div class="quiz-explanation"><strong>Why this matters:</strong> ${esc(currentQuiz.explanation)}</div>` : ''}
          <div class="toolbar" style="margin-top:14px">
            <button class="btn" id="quizPrev" ${quizState.index === 0 ? 'disabled' : ''}>Prev</button>
            <button class="btn primary" id="quizNext" ${(!chosen && answeredCount < quiz.length) ? 'disabled' : ''}>${quizState.index >= quiz.length - 1 ? 'Finish' : 'Next'}</button>
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
  const sections = topic.sections.map(sec => `<div class="section-card" id="sec-${sec.slug}"><h3>${esc(sec.title)}</h3>${renderBlocks(sec.blocks)}</div>`).join('');
  const intro = topic.intro.length ? `<div class="section-card"><h3>Overview</h3>${renderBlocks(topic.intro)}</div>` : '';
  const toc = topic.sections.map(sec => `<a href="#sec-${sec.slug}">${esc(sec.title)}</a>`).join('');
  els.crumbs.textContent = `Home / ${topic.partTitle} / ${topic.display}`;
  els.pageTitle.textContent = topic.display;
  els.pageSubtitle.textContent = `${topic.sectionCount} sections · ${topic.partTitle} · high-yield review`;
  els.content.innerHTML = `
    <div class="view-grid">
      <article class="card article">
        <div class="article-head">
          <div>
            <span class="badge">${esc(topic.partTitle)}</span>
            <h2>${esc(topic.display)}</h2>
            <p>${topic.sectionCount} sections · ${topic.blockCount} blocks · high-yield review</p>
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
        <a href="#top">Top</a>
        ${toc}
        <div style="height:12px"></div>
        <div class="note">Progress button buat tracking, search buat lompat cepat ke topik tertentu.</div>
      </aside>
    </div>`;
  document.getElementById('markDone').onclick = () => { state.done.has(key) ? state.done.delete(key) : state.done.add(key); setStorage(); updateStats(); render(); };
  document.getElementById('bookmarkBtn').onclick = () => { state.bookmarks.has(key) ? state.bookmarks.delete(key) : state.bookmarks.add(key); setStorage(); updateStats(); render(); };
  document.querySelectorAll('.quiz .option').forEach(btn => {
    btn.onclick = () => {
      const qid = Number(btn.closest('.quiz').dataset.qid);
      const info = state.quizState[key] || {index: 0, answers: {}, finished: false};
      info.answers = info.answers || {};
      info.answers[qid] = btn.dataset.answer;
      state.quizState[key] = info;
      renderTopic(slug);
    };
  });
  const quizPrev = document.getElementById('quizPrev');
  const quizNext = document.getElementById('quizNext');
  const quizReset = document.getElementById('quizReset');
  if (quizPrev) quizPrev.onclick = () => { const info = state.quizState[key] || {index: 0, answers: {}, finished: false}; info.index = Math.max(0, (info.index || 0) - 1); info.finished = false; state.quizState[key] = info; renderTopic(slug); };
  if (quizNext) quizNext.onclick = () => { const info = state.quizState[key] || {index: 0, answers: {}, finished: false}; if ((info.index || 0) >= quiz.length - 1) info.finished = true; else info.index = Math.min(quiz.length - 1, (info.index || 0) + 1); state.quizState[key] = info; renderTopic(slug); };
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
    <div class="toolbar">${doneTopics.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(t.display)}</a>`).join('') || '<div class="empty">Belum ada yang ditandai selesai.</div>'}</div>
    <div class="section-title"><h3>Need review</h3><span>lanjutkan belajar</span></div>
    <div class="toolbar">${pendingTopics.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(t.display)}</a>`).join('') || '<div class="empty">Semua topik sudah selesai 🎉</div>'}</div>
  `;
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
  renderNav();
  const route = parseRoute();
  els.modeHome.classList.toggle('active', state.mode === 'home');
  els.modeStudy.classList.toggle('active', state.mode === 'study');
  els.modeReview.classList.toggle('active', state.mode === 'review');
  if (els.modeCga) els.modeCga.classList.toggle('active', route.type === 'resource' && route.slug === 'cga-brillian');
  const q = state.search.trim();
  if (state.mode === 'review') return renderReview();
  if (route.type === 'topic') return renderTopic(route.slug);
  if (route.type === 'resource') return renderResource(route.slug);
  if (route.type === 'part') return renderPart(route.slug);
  if (q.length >= 2) {
    els.crumbs.textContent = 'Search';
    els.pageTitle.textContent = 'Search results';
    els.pageSubtitle.textContent = `Smart search for “${q}”`;
    els.content.innerHTML = renderSearchResults(q) + renderHomeBody();
    bindHomeCards();
    return;
  }
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
      <h3>${esc(part.display)}</h3>
      <p>${esc(first.display)} → ${esc(last.display)}</p>
    </div>`;
  }).join('');
  const next = topics.find(t => !state.done.has(topicKey(t.partSlug, t.slug))) || topics[0];
  const done = topicDoneCount();
  const resources = allResources();
  const resourceCards = resources.map(page => `
    <div class="module-card" data-href="${resourcePageUrl(page.slug)}">
      <span class="badge">${normalizeSections(page.sections).length || 1} sections</span>
      <span class="card-arrow">↗</span>
      <h3>${esc(safeText(page.display, page.title || 'Resource'))}</h3>
      <p>${esc(safeText(normalizeSections(page.sections)[0]?.display || page.intro?.[0]?.text, 'Reference page'))}</p>
    </div>`).join('');
  return `
    <div class="hero-grid">
      <div class="card hero pad">
        <span class="badge">Wiki style · LMS friendly</span>
        <h2>Belajar internal medicine dengan struktur yang nyaman dibaca.</h2>
        <p>Semua materi dipecah per part dan topic, bisa dicari cepat, diberi progress, dan dibuka seperti wiki yang bersih.</p>
        <div class="stat-row">
          <div class="stat"><span>Modules</span><strong>${state.data.stats.modules}</strong></div>
          <div class="stat"><span>Topics</span><strong>${state.data.stats.topics}</strong></div>
          <div class="stat"><span>Resources</span><strong>${state.data.stats.resources}</strong></div>
          <div class="stat"><span>Sections</span><strong>${state.data.stats.resourceSections}</strong></div>
          <div class="stat"><span>Done</span><strong>${done}</strong></div>
        </div>
      </div>
      <div class="card pad">
        <h3 style="margin-top:0">Continue learning</h3>
        <p style="color:var(--muted);line-height:1.6">Lanjutkan ke topic berikutnya atau buka module yang kamu mau.</p>
        <div class="toolbar">
          <a class="btn primary" href="#topic/${next.slug}">Start / Continue</a>
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
      <div class="toolbar">${recent.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(t.display)}</a>`).join('')}</div>
    </div>`;
}
function bindHomeCards(){
  document.querySelectorAll('[data-href]').forEach(el => el.onclick = () => location.hash = el.dataset.href);
  const resetBtn = document.getElementById('resetDone');
  if (resetBtn) resetBtn.onclick = () => { state.done.clear(); setStorage(); updateStats(); render(); };
}
function renderHome(){
  els.crumbs.textContent = 'Home';
  els.pageTitle.textContent = 'IPD Brillian';
  els.pageSubtitle.textContent = 'Belajar lebih enak: rapi, searchable, dan bisa tracking progress.';
  els.content.innerHTML = state.search.trim().length >= 2 ? renderSearchResults(state.search.trim()) + renderHomeBody() : renderHomeBody();
  bindHomeCards();
}

async function init(){
  state.data = window.__GUIDE_DATA__ || null;
  if (!state.data) {
    const res = await fetch('./data/guide.json');
    state.data = await res.json();
  }
  state.data = normalizeData(state.data);
  els.search.addEventListener('input', e => { state.search = e.target.value; render(); });
  els.search.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const hit = searchAll(state.search.trim())[0];
      if (hit) location.hash = hit.href;
    }
  });
  els.modeFocus.onclick = () => { state.focus = !state.focus; setStorage(); setFocus(); };
  els.modeTheme.onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; setStorage(); setTheme(); };
  els.modeHome.onclick = () => { state.mode = 'home'; render(); };
  els.modeStudy.onclick = () => { state.mode = 'study'; render(); };
  els.modeReview.onclick = () => { state.mode = 'review'; render(); };
  if (els.modeCga) els.modeCga.onclick = () => { location.hash = '#resource/cga-brillian'; };
  window.addEventListener('hashchange', setRoute);
  setTheme();
  setFocus();
  setRoute();
}

init();
