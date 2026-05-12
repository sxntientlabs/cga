from pathlib import Path
from zipfile import ZipFile
from lxml import etree
from html import escape
import json, re

SRC = Path('/home/rafael/.openclaw/media/inbound/Internal_Medicine_Study_Guide---6e19ec46-fadd-4158-bbec-91f229afdda0.docx')
OUT = Path('/home/rafael/.openclaw/workspace/internal-medicine-wiki-lms')
DATA = OUT / 'data' / 'guide.json'

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s or 'x'


def clean(s: str) -> str:
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def clean_title(s: str) -> str:
    s = clean(s)
    s = s.replace('██ ', '').replace('██', '')
    s = s.replace('  ', ' ')
    return s.strip()


def part_display(s: str):
    s = clean_title(s)
    m = re.match(r'PART\s+([IVXLC0-9]+)\s*[:\-]?\s*(.*)$', s, re.I)
    if m:
        num = m.group(1)
        rest = m.group(2).strip()
        return f'Part {num.upper()} · {rest.title() if rest.isupper() else rest}'
    return s.title() if s.isupper() else s


def topic_display(s: str):
    s = clean_title(s)
    m = re.match(r'TOPIC\s+(\d+)\s*[:\-]?\s*(.*)$', s, re.I)
    if m:
        num = m.group(1)
        rest = m.group(2).strip()
        rest = rest.title() if rest.isupper() else rest
        return f'Topic {num} · {rest}'
    return s.title() if s.isupper() else s


def get_text(node):
    texts = node.xpath('.//w:t/text()', namespaces=NS)
    return clean(''.join(texts))


def get_style(node):
    style = node.xpath('./w:pPr/w:pStyle/@w:val', namespaces=NS)
    return style[0] if style else 'Normal'


def parse_docx(path: Path):
    with ZipFile(path) as z:
        root = etree.fromstring(z.read('word/document.xml'))
    items = []
    for child in root.xpath('.//w:body/*', namespaces=NS):
        tag = etree.QName(child).localname
        if tag == 'p':
            txt = get_text(child)
            if not txt:
                continue
            items.append({'type': 'p', 'style': get_style(child), 'text': txt})
        elif tag == 'tbl':
            rows = []
            for tr in child.xpath('./w:tr', namespaces=NS):
                row = []
                for tc in tr.xpath('./w:tc', namespaces=NS):
                    row.append(get_text(tc))
                rows.append(row)
            if rows:
                items.append({'type': 'table', 'rows': rows})
    return items


def build_structure(items):
    parts = []
    cur_part = None
    cur_topic = None
    cur_section = None

    def ensure_topic():
        nonlocal cur_part, cur_topic
        if cur_part is None:
            cur_part = {'title': 'Front Matter', 'display': 'Front Matter', 'slug': 'front-matter', 'topics': []}
            parts.append(cur_part)
        if cur_topic is None:
            cur_topic = {
                'title': 'Overview',
                'display': 'Overview',
                'slug': 'overview',
                'sections': [],
                'intro': [],
                'searchText': '',
                'blockCount': 0,
            }
            cur_part['topics'].append(cur_topic)

    def push_block(block):
        nonlocal cur_topic, cur_section
        ensure_topic()
        target = cur_section['blocks'] if cur_section else cur_topic['intro']
        target.append(block)
        cur_topic['blockCount'] += 1

    for item in items:
        if item['type'] == 'p':
            style = item['style']
            text = item['text']
            # Skip noisy TOC/front cover lines.
            if text in {'Table of Contents', 'Introduction', 'Notes'}:
                continue
            if style == 'Heading1':
                cur_part = {
                    'title': clean_title(text),
                    'display': part_display(text),
                    'slug': slugify(clean_title(text)),
                    'topics': [],
                }
                parts.append(cur_part)
                cur_topic = None
                cur_section = None
                continue
            if style == 'Heading2':
                if cur_part is None:
                    cur_part = {'title': 'Unsorted', 'display': 'Unsorted', 'slug': 'unsorted', 'topics': []}
                    parts.append(cur_part)
                cur_topic = {
                    'title': clean_title(text),
                    'display': topic_display(text),
                    'slug': slugify(clean_title(text)),
                    'sections': [],
                    'intro': [],
                    'searchText': '',
                    'blockCount': 0,
                }
                cur_part['topics'].append(cur_topic)
                cur_section = None
                continue
            if style == 'Heading3':
                ensure_topic()
                cur_section = {'title': clean_title(text), 'slug': slugify(clean_title(text)), 'blocks': []}
                cur_topic['sections'].append(cur_section)
                continue
            if style == 'Heading4':
                ensure_topic()
                cur_section = {'title': clean_title(text), 'slug': slugify(clean_title(text)), 'blocks': []}
                cur_topic['sections'].append(cur_section)
                continue
            # content
            if cur_topic is None:
                continue
            if text.startswith('• ') or text.startswith('- ') or text.startswith('▪ '):
                push_block({'type': 'bullet', 'text': text[2:].strip()})
            elif re.match(r'^\d+\.\s+', text):
                push_block({'type': 'num', 'text': re.sub(r'^\d+\.\s+', '', text)})
            else:
                push_block({'type': 'p', 'text': text})
        else:
            if cur_topic is None:
                continue
            rows = [[c for c in row if c is not None] for row in item['rows']]
            push_block({'type': 'table', 'rows': rows})

    # finalize search text and counts
    for part in parts:
        for topic in part['topics']:
            buf = [topic['title'], topic['display']]
            for blk in topic['intro']:
                if blk['type'] != 'table':
                    buf.append(blk.get('text', ''))
                else:
                    for row in blk['rows']:
                        buf.extend(row)
            for sec in topic['sections']:
                buf.append(sec['title'])
                for blk in sec['blocks']:
                    if blk['type'] == 'table':
                        for row in blk['rows']:
                            buf.extend(row)
                    else:
                        buf.append(blk.get('text', ''))
            topic['searchText'] = clean(' '.join(buf)).lower()
            topic['sectionCount'] = len(topic['sections'])
            topic['display'] = topic['display']
            topic['partTitle'] = part['display']
            topic['partSlug'] = part['slug']
    return parts


def build_index(parts):
    topics = [t for p in parts for t in p['topics']]
    return {
        'title': 'Internal Medicine Master Study Guide',
        'parts': parts,
        'stats': {
            'parts': len(parts),
            'topics': len(topics),
            'sections': sum(t['sectionCount'] for t in topics),
            'blocks': sum(t['blockCount'] for t in topics),
        }
    }


def render_home_html(data):
    parts = data['parts']
    topics = [t for p in parts for t in p['topics']]
    done = 0
    next_topic = topics[0] if topics else None
    module_cards = []
    for part in parts:
        if not part.get('topics'):
            continue
        first = part['topics'][0]
        last = part['topics'][-1]
        module_cards.append(f'''<div class="module-card" data-href="#part/{part['slug']}">
          <span class="badge">{len(part['topics'])} topics</span>
          <span class="card-arrow">↗</span>
          <h3>{escape(part['display'])}</h3>
          <p>{escape(first['display'])} → {escape(last['display'])}</p>
        </div>''')
    recent = ''.join(f'<a class="badge" href="#topic/{t["slug"]}">{escape(t["display"])}</a>' for t in topics[:6])
    next_href = f'#topic/{next_topic["slug"]}' if next_topic else '#home'
    return f'''
    <div class="hero-grid">
      <div class="card hero pad">
        <span class="badge">Wiki style · LMS friendly</span>
        <h2>Belajar internal medicine dengan struktur yang nyaman dibaca.</h2>
        <p>Semua materi dipecah per part dan topic, bisa dicari cepat, diberi progress, dan dibuka seperti wiki yang bersih.</p>
        <div class="stat-row">
          <div class="stat"><span>Parts</span><strong>{data['stats']['parts']}</strong></div>
          <div class="stat"><span>Topics</span><strong>{data['stats']['topics']}</strong></div>
          <div class="stat"><span>Sections</span><strong>{data['stats']['sections']}</strong></div>
          <div class="stat"><span>Done</span><strong>{done}</strong></div>
        </div>
      </div>
      <div class="card pad">
        <h3 style="margin-top:0">Continue learning</h3>
        <p style="color:var(--muted);line-height:1.6">Lanjutkan ke topic berikutnya atau buka module yang kamu mau.</p>
        <div class="toolbar">
          <a class="btn primary" href="{next_href}">Start / Continue</a>
          <button class="btn" type="button">Reset progress</button>
        </div>
        <div class="note">Tip: pakai search untuk loncat ke diagnosis / obat / protocol.</div>
      </div>
    </div>
    <div class="section-title"><h3>Modules</h3><span>klik untuk masuk ke wiki section</span></div>
    <div class="module-grid">{''.join(module_cards)}</div>
    <div class="section-title"><h3>Quick access</h3><span>recent / high-yield</span></div>
    <div class="card pad">
      <div class="toolbar">{recent}</div>
    </div>'''


def main():
    items = parse_docx(SRC)
    parts = build_structure(items)
    data = build_index(parts)
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    home_html = render_home_html(data)

    html = '''<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Internal Medicine Wiki LMS</title>
  <link rel="stylesheet" href="./assets/styles.css" />
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">IM</div>
        <div>
          <div class="brand-title">Internal Medicine</div>
          <div class="brand-sub">Wiki • LMS • Review</div>
        </div>
      </div>
      <input id="search" class="search" type="search" placeholder="Cari topic, diagnosis, obat..." />
      <div class="sidebar-meta">
        <div class="meta-card">
          <span>Progress</span>
          <strong id="progressLabel">0%</strong>
          <div class="progress"><div id="progressBar"></div></div>
        </div>
        <div class="meta-card compact">
          <span>Bookmarked</span>
          <strong id="bookmarkCount">0</strong>
        </div>
      </div>
      <nav id="nav"></nav>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <div id="crumbs" class="crumbs">Home</div>
          <h1 id="pageTitle">Internal Medicine Wiki LMS</h1>
          <p id="pageSubtitle">Belajar lebih enak: rapi, searchable, dan bisa tracking progress.</p>
        </div>
        <div class="top-actions">
          <button id="modeHome" class="chip active">Home</button>
          <button id="modeStudy" class="chip">Study</button>
          <button id="modeReview" class="chip">Review</button>
          <button id="modeFocus" class="chip">Focus</button>
        </div>
      </header>
      <section id="content" class="content">{home_html}</section>
    </main>
  </div>
  <script>window.__GUIDE_DATA__ = {json.dumps(data, ensure_ascii=False)};</script>
  <script src="./assets/app.js"></script>
</body>
</html>'''
    (OUT / 'index.html').write_text(html, encoding='utf-8')

    css = ''':root{
  --bg:#f4f7fb; --panel:#ffffff; --panel-2:#f8fbff; --line:#dbe6f2; --ink:#16324f; --muted:#6b7b8f;
  --accent:#2563eb; --accent-2:#0ea5e9; --good:#16a34a; --warn:#f59e0b; --shadow:0 14px 40px rgba(15,23,42,.08);
  --radius:18px;
}
*{box-sizing:border-box} html,body{height:100%}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:linear-gradient(180deg,#eef4fb 0%, #f7f9fc 100%);color:var(--ink)}
a{color:inherit;text-decoration:none}
.app-shell{display:grid;grid-template-columns:340px 1fr;min-height:100vh}
.sidebar{position:sticky;top:0;height:100vh;overflow:auto;background:rgba(255,255,255,.86);backdrop-filter:blur(18px);border-right:1px solid var(--line);padding:20px}
.brand{display:flex;gap:14px;align-items:center;margin-bottom:18px}
.brand-mark{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;font-weight:800;box-shadow:var(--shadow)}
.brand-title{font-weight:800;font-size:1.02rem}.brand-sub{color:var(--muted);font-size:.86rem;margin-top:2px}
.search{width:100%;padding:13px 14px;border:1px solid var(--line);border-radius:14px;background:#fff;outline:none;box-shadow:0 4px 18px rgba(15,23,42,.04)}
.search:focus{border-color:#9bc1ff;box-shadow:0 0 0 4px rgba(37,99,235,.1)}
.sidebar-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.meta-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 6px 18px rgba(15,23,42,.04)}
.meta-card span{display:block;color:var(--muted);font-size:.8rem}.meta-card strong{font-size:1.15rem}.meta-card.compact{display:flex;align-items:center;justify-content:space-between}.progress{height:8px;border-radius:999px;background:#e8eef7;overflow:hidden;margin-top:10px}.progress > div{height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:inherit}
.nav-part{border:1px solid var(--line);border-radius:16px;background:#fff;margin-bottom:10px;overflow:hidden}.nav-part details{padding:0}.nav-part summary{list-style:none;cursor:pointer;padding:14px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:700}.nav-part summary::-webkit-details-marker{display:none}.nav-part .part-meta{color:var(--muted);font-size:.82rem}.nav-topics{padding:0 6px 8px 6px}.nav-topic{display:block;padding:10px 12px;border-radius:12px;color:var(--ink);margin:4px 0}.nav-topic:hover{background:#eef5ff}.nav-topic.active{background:linear-gradient(90deg,rgba(37,99,235,.11),rgba(14,165,233,.10));border:1px solid rgba(37,99,235,.15)}
.main{padding:24px 28px 40px}.topbar{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.crumbs{color:var(--muted);font-size:.86rem;text-transform:uppercase;letter-spacing:.08em}.topbar h1{margin:.3rem 0 .25rem;font-size:2rem;line-height:1.1}.topbar p{margin:0;color:var(--muted);max-width:72ch}.top-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;font-weight:700;color:var(--ink);cursor:pointer}.chip.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.content{display:block}.hero-grid{display:grid;grid-template-columns:1.5fr .9fr;gap:18px;margin-bottom:18px}.card{background:rgba(255,255,255,.9);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}.card.pad{padding:20px}.hero{padding:24px;background:linear-gradient(135deg,#ffffff 0%, #f4f8ff 100%)}.hero h2{margin:0 0 8px;font-size:1.6rem}.hero p{margin:0;color:var(--muted);line-height:1.6}.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.stat{padding:14px;border-radius:14px;background:#fff;border:1px solid var(--line)}.stat span{display:block;color:var(--muted);font-size:.8rem}.stat strong{font-size:1.3rem}.module-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.module-card{position:relative;padding:16px;border:1px solid var(--line);border-radius:16px;background:#fff;cursor:pointer;transition:.18s}.module-card:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(15,23,42,.08)}.module-card h3{margin:.1rem 0 .35rem;font-size:1rem}.module-card p{margin:0;color:var(--muted);font-size:.92rem;line-height:1.5}.card-arrow{position:absolute;top:14px;right:14px;color:var(--muted);font-weight:800}.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:.78rem;font-weight:700}.section-title{display:flex;justify-content:space-between;align-items:end;margin:22px 0 12px}.section-title h3{margin:0;font-size:1.1rem}.section-title span{color:var(--muted);font-size:.9rem}.view-grid{display:grid;grid-template-columns:1.65fr .8fr;gap:18px;align-items:start}.article{padding:24px}.article-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:18px}.article-head h2{margin:0 0 6px;font-size:1.6rem}.article-head p{margin:0;color:var(--muted)}.btn{border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}.btn.primary{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-color:transparent}.toc{position:sticky;top:20px;padding:16px}.toc h4{margin:0 0 10px}.toc a{display:block;padding:8px 10px;border-radius:10px;color:var(--muted);font-size:.92rem}.toc a:hover{background:#eef5ff;color:var(--ink)}
.section-card{padding:16px 18px;border:1px solid var(--line);border-radius:16px;background:#fff;margin-bottom:12px}.section-card h3{margin:0 0 12px;font-size:1.03rem}.section-card p{line-height:1.72;margin:.6rem 0;color:var(--ink)}.section-card ul,.section-card ol{margin:.5rem 0 .8rem 1.2rem;color:var(--ink)}.section-card li{margin:.3rem 0;line-height:1.6}.doc-table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;margin:12px 0;background:#fff}.doc-table th,.doc-table td{padding:10px 12px;border-bottom:1px solid #edf2f7;border-right:1px solid #edf2f7;vertical-align:top;text-align:left;line-height:1.55}.doc-table th{background:#eef5ff;font-size:.9rem}.doc-table tr:last-child td{border-bottom:none}.doc-table td:last-child,.doc-table th:last-child{border-right:none}.note{padding:14px 16px;border-radius:14px;background:#f8fbff;border:1px solid #dbeafe;color:#14324a}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.empty{padding:24px;text-align:center;color:var(--muted)}
.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.kpi{padding:16px;background:#fff;border:1px solid var(--line);border-radius:16px}.kpi span{display:block;color:var(--muted);font-size:.82rem}.kpi strong{display:block;font-size:1.35rem;margin-top:4px}
@media (max-width: 1180px){.app-shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto}.hero-grid,.view-grid{grid-template-columns:1fr}.stat-row,.module-grid,.kpi-row{grid-template-columns:repeat(2,1fr)}.topbar{flex-direction:column}.top-actions{justify-content:flex-start}}
@media (max-width: 720px){.main{padding:16px}.stat-row,.module-grid,.kpi-row{grid-template-columns:1fr}.topbar h1{font-size:1.6rem}.article{padding:18px}.sidebar-meta{grid-template-columns:1fr}}
.focus-mode .sidebar{display:none}.focus-mode .app-shell{grid-template-columns:1fr}.focus-mode .view-grid{grid-template-columns:1fr}.focus-mode .toc{display:none}.focus-mode .main{padding-inline:clamp(18px,4vw,72px)}
'''
    (OUT / 'assets' / 'styles.css').write_text(css, encoding='utf-8')

    js = r'''
const state = {
  data: null,
  route: 'home',
  search: '',
  mode: 'home',
  bookmarks: new Set(JSON.parse(localStorage.getItem('im-bookmarks') || '[]')),
  done: new Set(JSON.parse(localStorage.getItem('im-done') || '[]')),
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
};

function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function topicKey(partSlug, topicSlug){return `${partSlug}/${topicSlug}`;}
function setStorage(){
  localStorage.setItem('im-bookmarks', JSON.stringify([...state.bookmarks]));
  localStorage.setItem('im-done', JSON.stringify([...state.done]));
}
function allTopics(){ return state.data.parts.flatMap(p => p.topics.map(t => ({...t, part: p}))); }
function topicDoneCount(){ return allTopics().filter(t => state.done.has(topicKey(t.partSlug, t.slug))).length; }
function updateStats(){
  const total = allTopics().length || 1;
  const done = topicDoneCount();
  const pct = Math.round(done * 100 / total);
  els.progressLabel.textContent = `${pct}%`;
  els.progressBar.style.width = `${pct}%`;
  els.bookmarkCount.textContent = state.bookmarks.size;
}
function setRoute(){
  const hash = location.hash.replace(/^#/, '') || 'home';
  state.route = hash;
  render();
}
function parseRoute(){
  const parts = state.route.split('/').filter(Boolean);
  if (parts[0] === 'part' && parts[1]) return {type:'part', slug: parts[1]};
  if (parts[0] === 'topic' && parts[1]) return {type:'topic', slug: parts[1]};
  return {type:'home'};
}
function renderNav(){
  const q = state.search.trim().toLowerCase();
  const html = state.data.parts.map(part => {
    const topics = part.topics.filter(t => !q || t.searchText.includes(q) || t.display.toLowerCase().includes(q));
    const activePart = parseRoute().type !== 'home' && state.route.includes(part.slug);
    return `<div class="nav-part"><details ${activePart ? 'open' : ''}>
      <summary><span>${esc(part.display)}</span><span class="part-meta">${topics.length} topic</span></summary>
      <div class="nav-topics">${topics.map(t => {
        const active = state.route === `topic/${t.slug}`;
        return `<a class="nav-topic ${active?'active':''}" href="#topic/${t.slug}" title="${esc(t.title)}">${esc(t.display)}</a>`;
      }).join('') || '<div class="empty" style="padding:10px 12px">No match</div>'}</div>
    </details></div>`;
  }).join('');
  els.nav.innerHTML = html;
}
function renderHome(){
  const topics = allTopics();
  const recent = topics.slice(0, 6);
  const modules = state.data.parts.filter(p => p.topics.length).map(part => {
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
  els.crumbs.textContent = 'Home';
  els.pageTitle.textContent = 'Internal Medicine Wiki LMS';
  els.pageSubtitle.textContent = 'Belajar lebih enak: rapi, searchable, dan bisa tracking progress.';
  els.content.innerHTML = `
    <div class="hero-grid">
      <div class="card hero pad">
        <span class="badge">Wiki style · LMS friendly</span>
        <h2>Belajar internal medicine dengan struktur yang nyaman dibaca.</h2>
        <p>Semua materi dipecah per part dan topic, bisa dicari cepat, diberi progress, dan dibuka seperti wiki yang bersih.</p>
        <div class="stat-row">
          <div class="stat"><span>Parts</span><strong>${state.data.stats.parts}</strong></div>
          <div class="stat"><span>Topics</span><strong>${state.data.stats.topics}</strong></div>
          <div class="stat"><span>Sections</span><strong>${state.data.stats.sections}</strong></div>
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
        <div class="note">Tip: pakai search untuk loncat ke diagnosis / obat / protocol.</div>
      </div>
    </div>
    <div class="section-title"><h3>Modules</h3><span>klik untuk masuk ke wiki section</span></div>
    <div class="module-grid">${modules}</div>
    <div class="section-title"><h3>Quick access</h3><span>recent / high-yield</span></div>
    <div class="card pad">
      <div class="toolbar">${recent.map(t => `<a class="badge" href="#topic/${t.slug}">${esc(t.display)}</a>`).join('')}</div>
    </div>
  `;
  const resetBtn = document.getElementById('resetDone');
  if (resetBtn) resetBtn.onclick = () => { state.done.clear(); setStorage(); updateStats(); render(); };
  document.querySelectorAll('[data-href]').forEach(el => el.onclick = () => location.hash = el.dataset.href);
}
function renderPart(slug){
  const part = state.data.parts.find(p => p.slug === slug);
  if (!part) return renderNotFound();
  els.crumbs.textContent = `Home / ${part.display}`;
  els.pageTitle.textContent = part.display;
  els.pageSubtitle.textContent = `${part.topics.length} topic · learning path module`;
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
  for (const b of blocks) {
    if (b.type === 'bullet') { if (mode && mode !== 'bullet') flush(); mode = 'bullet'; items.push(b.text); continue; }
    if (b.type === 'num') { if (mode && mode !== 'num') flush(); mode = 'num'; items.push(b.text); continue; }
    flush();
    if (b.type === 'p') html += `<p>${esc(b.text)}</p>`;
    else if (b.type === 'table') html += renderTable(b.rows);
  }
  flush();
  return html;
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
  els.pageSubtitle.textContent = `${topic.sectionCount} sections · ${topic.partTitle}`;
  els.content.innerHTML = `
    <div class="view-grid">
      <article class="card article">
        <div class="article-head">
          <div>
            <span class="badge">${esc(topic.partTitle)}</span>
            <h2>${esc(topic.display)}</h2>
            <p>${topic.sectionCount} sections · ${topic.blockCount} blocks</p>
          </div>
          <div class="toolbar" style="margin:0;justify-content:flex-end">
            <button class="btn ${done?'primary':''}" id="markDone">${done ? 'Completed ✓' : 'Mark done'}</button>
            <button class="btn" id="bookmarkBtn">${bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button>
          </div>
        </div>
        ${intro}
        ${sections}
      </article>
      <aside class="card toc">
        <h4>On this page</h4>
        <a href="#top">Top</a>
        ${toc}
        <div style="height:12px"></div>
        <div class="note">Use progress buttons untuk tracking belajar. Search di sidebar buat loncat cepat.</div>
      </aside>
    </div>`;
  document.getElementById('markDone').onclick = () => {
    if (state.done.has(key)) state.done.delete(key); else state.done.add(key);
    setStorage(); updateStats(); render();
  };
  document.getElementById('bookmarkBtn').onclick = () => {
    if (state.bookmarks.has(key)) state.bookmarks.delete(key); else state.bookmarks.add(key);
    setStorage(); updateStats(); render();
  };
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
  renderNav();
  els.modeHome.classList.toggle('active', state.mode === 'home');
  els.modeStudy.classList.toggle('active', state.mode === 'study');
  els.modeReview.classList.toggle('active', state.mode === 'review');
  const route = parseRoute();
  if (state.mode === 'review') return renderReview();
  if (route.type === 'topic') return renderTopic(route.slug);
  if (route.type === 'part') return renderPart(route.slug);
  return renderHome();
}

async function init(){
  state.data = window.__GUIDE_DATA__ || null;
  if (!state.data) {
    const res = await fetch('./data/guide.json');
    state.data = await res.json();
  }
  els.search.addEventListener('input', e => { state.search = e.target.value; renderNav(); });
  els.search.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = state.search.trim().toLowerCase();
      const hit = allTopics().find(t => t.searchText.includes(q) || t.display.toLowerCase().includes(q));
      if (hit) location.hash = `#topic/${hit.slug}`;
    }
  });
  els.modeFocus = document.getElementById('modeFocus');
  state.focus = JSON.parse(localStorage.getItem('im-focus') || 'false');
  function syncFocus(){
    document.body.classList.toggle('focus-mode', !!state.focus);
    if (els.modeFocus) els.modeFocus.classList.toggle('active', !!state.focus);
  }
  syncFocus();
  els.modeHome.onclick = () => { state.mode = 'home'; render(); };
  els.modeStudy.onclick = () => { state.mode = 'study'; render(); };
  els.modeReview.onclick = () => { state.mode = 'review'; render(); };
  els.modeFocus.onclick = () => { state.focus = !state.focus; localStorage.setItem('im-focus', JSON.stringify(!!state.focus)); syncFocus(); };
  window.addEventListener('hashchange', setRoute);
  setRoute();
}

init();
'''
    (OUT / 'assets' / 'app.js').write_text(js, encoding='utf-8')

if __name__ == '__main__':
    main()
