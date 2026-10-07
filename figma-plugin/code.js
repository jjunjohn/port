// @ts-check
// MD 포트폴리오 조립 플러그인
// 내용: docs/01_포트폴리오_페이지별원고.md / 디자인: docs/02_디자인_지시문.md
// 단계마다 메뉴 명령 하나. 지금은 1단계(00_스타일·컴포넌트)만 들어 있다.

// ───────────────────────── 상수 ─────────────────────────

const PAGE_STYLE = '00_스타일·컴포넌트';

// 디자인 지시문 2절 — 이 5개만 사용
const COLORS = [
  { name: 'bg', hex: '#FFFFFF', use: '배경' },
  { name: 'ink', hex: '#000000', use: '제목·본문' },
  { name: 'accent', hex: '#6EC6FF', use: '하이라이트 띠, 차트 강조 막대, 표지·CONTACT 블록 (글자색 금지)' },
  { name: 'chart-gray', hex: '#E3E3E3', use: '차트 나머지 계열, 이미지 자리표시, 표 구분선' },
  { name: 'note', hex: '#888888', use: '각주·출처·정의·작은 설명' },
];

// 디자인 지시문 3절 — 범위 안에서 값 하나로 고정
const TYPE = [
  { name: 'H1', size: 88, weight: 'ExtraBold', lh: 115, ls: -2, use: '표지 이름, 섹션 큰 제목' },
  { name: 'H2', size: 44, weight: 'Bold', lh: 135, ls: -1, use: '페이지 헤드라인(결론 한 문장)' },
  { name: 'H3', size: 30, weight: 'Bold', lh: 135, ls: -1, use: '소제목, 라벨 열, 표 머리글' },
  { name: 'Body', size: 22, weight: 'Regular', lh: 155, ls: 0, use: '본문, 내용 열' },
  { name: 'Num', size: 22, weight: 'Light', lh: 135, ls: 0, use: '번호(01. 02.), 표 숫자' },
  { name: 'Caption', size: 15, weight: 'Regular', lh: 150, ls: 0, use: '각주·출처 (#888)' },
];

// 글꼴 굵기 이름이 글꼴마다 달라서 대체 순서를 둔다
const WEIGHT_FALLBACK = {
  ExtraBold: ['ExtraBold', 'Extra Bold', 'Black', 'Bold'],
  Bold: ['Bold', 'SemiBold', 'Semi Bold'],
  Regular: ['Regular'],
  Light: ['Light', 'ExtraLight', 'Extra Light', 'Regular'],
};
const FAMILY_CANDIDATES = ['Pretendard', 'Pretendard Variable', 'Noto Sans KR'];
// figma.createText()의 기본 글꼴 — 스타일을 입히기 전에 불러 둔다
const DEFAULT_FONT = { family: 'Inter', style: 'Regular' };

// 레이아웃 기준 (1920×1080, 좌우 120 / 상하 96)
const PAGE_W = 1920;
const MARGIN_X = 120;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 1680

// Highlight Text 띠가 글자보다 좌우로 더 나가는 길이 (4~10px)
const HL_PAD = { H1: 10, H2: 8, H3: 6, Body: 4 };

// ───────────────────────── 공통 도구 ─────────────────────────

/** @param {string} hex */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** @param {string} hex @returns {SolidPaint} */
function solid(hex) {
  return { type: 'SOLID', color: rgb(hex) };
}

/**
 * @typedef {{
 *   family: string,
 *   paint: Record<string, string>,
 *   text: Record<string, TextStyle>,
 * }} Ctx
 */

/** 문서 전체에 글꼴 하나: Pretendard, 없으면 Noto Sans KR */
async function pickFamily() {
  const saved = figma.root.getPluginData('fontFamily');
  const fonts = await figma.listAvailableFontsAsync();
  /** @type {Record<string, Set<string>>} */
  const byFamily = {};
  for (const f of fonts) {
    if (!byFamily[f.fontName.family]) byFamily[f.fontName.family] = new Set();
    byFamily[f.fontName.family].add(f.fontName.style);
  }
  const order = saved ? [saved].concat(FAMILY_CANDIDATES) : FAMILY_CANDIDATES;
  for (const fam of order) {
    if (byFamily[fam]) return { family: fam, styles: byFamily[fam] };
  }
  throw new Error('Pretendard와 Noto Sans KR 둘 다 Figma 글꼴 목록에 없습니다.');
}

/** @param {Set<string>} styles @param {string} weight */
function pickWeight(styles, weight) {
  const list = WEIGHT_FALLBACK[weight];
  for (const s of list) if (styles.has(s)) return s;
  throw new Error('글꼴 굵기 ' + weight + '를 찾지 못했습니다.');
}

/** 색 스타일 5개 — 이미 있으면 값만 갱신 (id 유지) */
async function upsertPaintStyles() {
  const existing = await figma.getLocalPaintStylesAsync();
  /** @type {Record<string, string>} */
  const ids = {};
  for (const c of COLORS) {
    let st = existing.find((s) => s.name === c.name);
    if (!st) st = figma.createPaintStyle();
    st.name = c.name;
    st.paints = [solid(c.hex)];
    st.description = c.hex + ' · ' + c.use;
    ids[c.name] = st.id;
  }
  return ids;
}

/** 텍스트 스타일 6개 — 이미 있으면 값만 갱신 */
async function upsertTextStyles() {
  const { family, styles } = await pickFamily();
  figma.root.setPluginData('fontFamily', family);
  await figma.loadFontAsync(DEFAULT_FONT);
  const existing = await figma.getLocalTextStylesAsync();
  /** @type {Record<string, TextStyle>} */
  const out = {};
  /** @type {string[]} */
  const substituted = [];
  for (const t of TYPE) {
    const style = pickWeight(styles, t.weight);
    if (style !== t.weight) substituted.push(t.name + ' ' + t.weight + '→' + style);
    const fontName = { family, style };
    await figma.loadFontAsync(fontName);
    let st = existing.find((s) => s.name === t.name);
    if (!st) st = figma.createTextStyle();
    st.name = t.name;
    st.fontName = fontName;
    st.fontSize = t.size;
    st.lineHeight = { unit: 'PERCENT', value: t.lh };
    st.letterSpacing = { unit: 'PERCENT', value: t.ls };
    st.description = t.size + 'px ' + style + ' · ' + t.use;
    out[t.name] = st;
  }
  return { family, text: out, substituted };
}

/** 이미 만든 스타일을 읽어 온다 (2단계 이후용) @returns {Promise<Ctx>} */
async function loadCtx() {
  const paints = await figma.getLocalPaintStylesAsync();
  const texts = await figma.getLocalTextStylesAsync();
  await figma.loadFontAsync(DEFAULT_FONT);
  /** @type {Ctx} */
  const ctx = { family: figma.root.getPluginData('fontFamily'), paint: {}, text: {} };
  for (const c of COLORS) {
    const st = paints.find((s) => s.name === c.name);
    if (!st) throw new Error('색 스타일 ' + c.name + '이 없습니다. 1단계를 먼저 실행하세요.');
    ctx.paint[c.name] = st.id;
  }
  for (const t of TYPE) {
    const st = texts.find((s) => s.name === t.name);
    if (!st) throw new Error('텍스트 스타일 ' + t.name + '이 없습니다. 1단계를 먼저 실행하세요.');
    await figma.loadFontAsync(st.fontName);
    ctx.text[t.name] = st;
  }
  return ctx;
}

/**
 * 텍스트 노드 하나 (스타일·색은 등록된 스타일로만)
 * @param {Ctx} ctx @param {string} chars @param {string} type @param {string} color
 */
async function txt(ctx, chars, type, color) {
  const t = figma.createText();
  await t.setTextStyleIdAsync(ctx.text[type].id);
  t.characters = chars;
  await t.setFillStyleIdAsync(ctx.paint[color]);
  return t;
}

/**
 * 오토 레이아웃 프레임 (배경 없음)
 * @template {FrameNode | ComponentNode | ComponentSetNode} F
 * @param {F} f
 * @param {'HORIZONTAL' | 'VERTICAL'} dir
 * @param {{gap?: number, px?: number, py?: number, align?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE'}} [o]
 */
function autoLayout(f, dir, o) {
  o = o || {};
  f.layoutMode = dir;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = o.gap || 0;
  f.paddingLeft = f.paddingRight = o.px || 0;
  f.paddingTop = f.paddingBottom = o.py || 0;
  if (o.align) f.counterAxisAlignItems = o.align;
  f.fills = [];
  f.clipsContent = false;
  return f;
}

/** 아래쪽 가로 구분선만 (세로선 없음) @param {Ctx} ctx @param {FrameNode | ComponentNode} f */
async function bottomRule(ctx, f) {
  f.strokes = [solid('#E3E3E3')];
  await f.setStrokeStyleIdAsync(ctx.paint['chart-gray']);
  f.strokeAlign = 'INSIDE';
  f.strokeTopWeight = 0;
  f.strokeLeftWeight = 0;
  f.strokeRightWeight = 0;
  f.strokeBottomWeight = 1;
}

/**
 * 형광펜 띠: 오토 레이아웃 부모 안에 절대 위치 사각형을 깔고,
 * 높이는 부모 높이의 아래쪽 50% (45%~95% 구간), 좌우는 부모 padding만큼 글자보다 길다.
 * constraints로 글자 길이·높이를 따라 늘어난다.
 * @param {Ctx} ctx @param {FrameNode | ComponentNode} parent
 */
async function addHighlightBar(ctx, parent) {
  const bar = figma.createRectangle();
  bar.name = 'highlight';
  parent.insertChild(0, bar);
  bar.layoutPositioning = 'ABSOLUTE';
  const h = parent.height;
  bar.resize(Math.max(1, parent.width), Math.max(1, Math.round(h * 0.5)));
  bar.x = 0;
  bar.y = Math.round(h * 0.45);
  bar.constraints = { horizontal: 'STRETCH', vertical: 'SCALE' };
  bar.fills = [solid('#6EC6FF')];
  await bar.setFillStyleIdAsync(ctx.paint.accent);
  return bar;
}

/**
 * 컴포넌트 세트에 TEXT/BOOLEAN 속성을 만들고 각 변형의 레이어(이름으로 찾음)에 연결
 * @param {ComponentSetNode | ComponentNode} owner
 * @param {ComponentNode[]} variants
 * @param {string} prop @param {'TEXT' | 'BOOLEAN'} type @param {string | boolean} def
 * @param {string} layerName
 */
function bindProp(owner, variants, prop, type, def, layerName) {
  const key = owner.addComponentProperty(prop, type, def);
  for (const v of variants) {
    const nodes = v.findAll((n) => n.name === layerName);
    for (const n of nodes) {
      if (type === 'TEXT') n.componentPropertyReferences = { characters: key };
      else n.componentPropertyReferences = { visible: key };
    }
  }
  return key;
}

/** @template {SceneNode} T @param {T} n @param {string} name @returns {T} */
function named(n, name) {
  n.name = name;
  return n;
}

/** @param {string} name */
async function findOrCreatePage(name) {
  let page = figma.root.children.find((p) => p.name === name);
  if (!page) {
    page = figma.createPage();
    page.name = name;
  }
  await page.loadAsync();
  return page;
}

// ───────────────────────── 1단계: 컴포넌트 ─────────────────────────

/** 1. Highlight Text — size 변형 H1/H2/H3/Body @param {Ctx} ctx */
async function buildHighlightText(ctx) {
  /** @type {ComponentNode[]} */
  const vs = [];
  for (const size of ['H1', 'H2', 'H3', 'Body']) {
    const c = figma.createComponent();
    c.name = 'size=' + size;
    autoLayout(c, 'HORIZONTAL', { px: HL_PAD[size] });
    const t = named(await txt(ctx, '하이라이트 텍스트', size, 'ink'), 'text');
    c.appendChild(t);
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
    await addHighlightBar(ctx, c);
    vs.push(c);
  }
  const set = figma.combineAsVariants(vs, figma.currentPage);
  set.name = 'Highlight Text';
  autoLayout(set, 'VERTICAL', { gap: 24, px: 24, py: 24 });
  set.description = '텍스트 + 뒤 accent 사각형(텍스트 높이의 아래쪽 50%, 좌우 4~10px 더 길게). 텍스트 길이를 따라 늘어난다.';
  bindProp(set, vs, 'text', 'TEXT', '하이라이트 텍스트', 'text');
  return set;
}

/** 2. Label Row — highlight 변형 off/on @param {Ctx} ctx */
async function buildLabelRow(ctx) {
  /** @type {ComponentNode[]} */
  const vs = [];
  for (const hl of ['off', 'on']) {
    const c = figma.createComponent();
    c.name = 'highlight=' + hl;
    autoLayout(c, 'HORIZONTAL', { gap: 40, py: 18, align: 'BASELINE' });
    c.primaryAxisSizingMode = 'FIXED';
    c.resize(CONTENT_W, Math.max(1, c.height));
    await bottomRule(ctx, c);

    const label = named(await txt(ctx, '라벨', 'H3', 'ink'), 'label');
    c.appendChild(label);
    label.textAutoResize = 'HEIGHT';
    label.resize(280, label.height);

    const content = named(await txt(ctx, '내용', 'Body', 'ink'), 'content');
    if (hl === 'off') {
      c.appendChild(content);
      content.textAutoResize = 'HEIGHT';
      content.layoutSizingHorizontal = 'FILL';
    } else {
      const wrap = autoLayout(named(figma.createFrame(), 'content-highlight'), 'HORIZONTAL', { px: HL_PAD.Body });
      c.appendChild(wrap);
      wrap.appendChild(content);
      content.textAutoResize = 'WIDTH_AND_HEIGHT';
      await addHighlightBar(ctx, wrap);
    }
    vs.push(c);
  }
  const set = figma.combineAsVariants(vs, figma.currentPage);
  set.name = 'Label Row';
  autoLayout(set, 'VERTICAL', { gap: 24, px: 24, py: 24 });
  set.description = '왼쪽 라벨(H3, 280px 고정) | 오른쪽 내용(Body). highlight=on은 내용 한 줄에 형광펜.';
  bindProp(set, vs, 'label', 'TEXT', '라벨', 'label');
  bindProp(set, vs, 'content', 'TEXT', '내용', 'content');
  return set;
}

/** 3. TOC Row — size 변형 H1/H2, 제목은 Highlight Text 인스턴스 @param {Ctx} ctx @param {ComponentSetNode} hlSet */
async function buildTocRow(ctx, hlSet) {
  /** @type {ComponentNode[]} */
  const vs = [];
  for (const size of ['H1', 'H2']) {
    const c = figma.createComponent();
    c.name = 'size=' + size;
    autoLayout(c, 'HORIZONTAL', { gap: 32, align: 'CENTER' });

    const num = named(await txt(ctx, '01', 'Num', 'ink'), 'number');
    c.appendChild(num);
    num.textAutoResize = 'HEIGHT';
    num.resize(56, num.height);

    const main = /** @type {ComponentNode} */ (hlSet.children.find((n) => n.name === 'size=' + size));
    const title = named(main.createInstance(), 'title');
    c.appendChild(title);
    title.isExposedInstance = true;
    const textKey = Object.keys(hlSet.componentPropertyDefinitions).find((k) => k.indexOf('text#') === 0);
    if (textKey) title.setProperties({ [textKey]: size === 'H1' ? 'About Me' : 'Data — 26SS Denim Review' });
    vs.push(c);
  }
  const set = figma.combineAsVariants(vs, figma.currentPage);
  set.name = 'TOC Row';
  autoLayout(set, 'VERTICAL', { gap: 24, px: 24, py: 24 });
  set.description = '번호(Num, Light) + 제목(Highlight Text). 제목 문구는 노출된 인스턴스 속성 title > text에서 바꾼다.';
  bindProp(set, vs, 'number', 'TEXT', '01', 'number');
  return set;
}

/** 4. Page Header @param {Ctx} ctx */
async function buildPageHeader(ctx) {
  const c = figma.createComponent();
  c.name = 'Page Header';
  autoLayout(c, 'VERTICAL', { gap: 20 });
  c.counterAxisSizingMode = 'FIXED';
  c.resize(CONTENT_W, Math.max(1, c.height));

  const sec = named(await txt(ctx, '02 DATA', 'Caption', 'note'), 'section');
  c.appendChild(sec);
  sec.textAutoResize = 'HEIGHT';
  sec.layoutSizingHorizontal = 'FILL';

  const head = named(await txt(ctx, '페이지 헤드라인 — 결론 한 문장', 'H2', 'ink'), 'headline');
  c.appendChild(head);
  head.textAutoResize = 'HEIGHT';
  head.layoutSizingHorizontal = 'FILL';

  c.description = '왼쪽 위 섹션 표시(Caption) + 헤드라인(H2). 핵심 숫자 하이라이트는 페이지에서 헤드라인 뒤에 accent 띠를 깐다(페이지당 최대 3곳).';
  bindProp(c, [c], 'section', 'TEXT', '02 DATA', 'section');
  bindProp(c, [c], 'headline', 'TEXT', '페이지 헤드라인 — 결론 한 문장', 'headline');
  return c;
}

/** 5. Footnote @param {Ctx} ctx */
async function buildFootnote(ctx) {
  const c = figma.createComponent();
  c.name = 'Footnote';
  autoLayout(c, 'VERTICAL');
  c.counterAxisSizingMode = 'FIXED';
  c.resize(CONTENT_W, Math.max(1, c.height));
  const t = named(await txt(ctx, '※ 각주·출처·정의', 'Caption', 'note'), 'text');
  c.appendChild(t);
  t.textAutoResize = 'HEIGHT';
  t.layoutSizingHorizontal = 'FILL';
  c.description = '페이지 하단 고정(아래 여백 96px), Caption #888, 여러 줄 가능. 줄바꿈은 Shift+Enter.';
  bindProp(c, [c], 'text', 'TEXT', '※ 각주·출처·정의', 'text');
  return c;
}

/** 6. Case Block — 라벨 붙은 세로 블록, 칸 7개(뒤 2개는 기본 숨김) @param {Ctx} ctx */
async function buildCaseBlock(ctx) {
  const labels = ['관찰', '판단', '행동', '결과', '돌아보며', '추가 1', '추가 2'];
  const c = figma.createComponent();
  c.name = 'Case Block';
  autoLayout(c, 'VERTICAL');
  c.counterAxisSizingMode = 'FIXED';
  c.resize(900, Math.max(1, c.height));

  for (let i = 0; i < labels.length; i++) {
    const n = i + 1;
    const row = autoLayout(named(figma.createFrame(), 'slot ' + n), 'HORIZONTAL', { gap: 24, py: 16, align: 'BASELINE' });
    c.appendChild(row);
    row.layoutSizingHorizontal = 'FILL';
    row.visible = i < 5;
    await bottomRule(ctx, row);

    const lab = named(await txt(ctx, labels[i], 'H3', 'ink'), 'label ' + n);
    row.appendChild(lab);
    lab.textAutoResize = 'HEIGHT';
    lab.resize(150, lab.height);

    const body = named(await txt(ctx, labels[i] + ' 내용', 'Body', 'ink'), 'body ' + n);
    row.appendChild(body);
    body.textAutoResize = 'HEIGHT';
    body.layoutSizingHorizontal = 'FILL';
  }
  c.description = '05·07 사례용. 칸마다 라벨·내용·표시 여부를 속성으로 바꾼다. 기본 라벨: 관찰/판단/행동/결과/돌아보며.';
  for (let i = 0; i < labels.length; i++) {
    const n = i + 1;
    bindProp(c, [c], 'label ' + n, 'TEXT', labels[i], 'label ' + n);
    bindProp(c, [c], 'body ' + n, 'TEXT', labels[i] + ' 내용', 'body ' + n);
    bindProp(c, [c], 'show ' + n, 'BOOLEAN', i < 5, 'slot ' + n);
  }
  return c;
}

/** 7. Assumption Badge @param {Ctx} ctx */
async function buildAssumptionBadge(ctx) {
  const c = figma.createComponent();
  c.name = 'Assumption Badge';
  autoLayout(c, 'HORIZONTAL', { px: 16, py: 10 });
  c.strokes = [solid('#888888')];
  await c.setStrokeStyleIdAsync(ctx.paint.note);
  c.strokeWeight = 1;
  c.strokeAlign = 'INSIDE';
  const t = named(await txt(ctx, '가정 시나리오', 'Caption', 'note'), 'text');
  c.appendChild(t);
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  c.description = '"가정 시나리오" 표시 박스(#888 테두리, Caption). 04B-4 계산 페이지 상단 고지에도 사용.';
  bindProp(c, [c], 'text', 'TEXT', '가정 시나리오', 'text');
  return c;
}

/** (보조) Image Placeholder — 디자인 지시문 1절의 이미지 자리표시 @param {Ctx} ctx */
async function buildImagePlaceholder(ctx) {
  const c = figma.createComponent();
  c.name = 'Image Placeholder';
  c.layoutMode = 'VERTICAL';
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'FIXED';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';
  c.resize(720, 480);
  c.fills = [solid('#E3E3E3')];
  await c.setFillStyleIdAsync(ctx.paint['chart-gray']);
  const t = named(await txt(ctx, '[이미지: 무엇]', 'Body', 'note'), 'label');
  c.appendChild(t);
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  c.description = '#E3E3E3 사각형 + 가운데 [이미지: 무엇](#888). 크기는 인스턴스에서 조절.';
  bindProp(c, [c], 'label', 'TEXT', '[이미지: 무엇]', 'label');
  return c;
}

// ───────────────────────── 1단계: 스타일 안내판 ─────────────────────────

/** @param {Ctx} ctx @param {string} title */
async function section(ctx, title) {
  const f = autoLayout(named(figma.createFrame(), title), 'VERTICAL', { gap: 32 });
  f.appendChild(named(await txt(ctx, title, 'H3', 'ink'), 'section title'));
  return f;
}

/** @param {Ctx} ctx */
async function buildColorBoard(ctx) {
  const sec = await section(ctx, '색 스타일 (5)');
  const row = autoLayout(named(figma.createFrame(), 'swatches'), 'HORIZONTAL', { gap: 32 });
  sec.appendChild(row);
  for (const c of COLORS) {
    const cell = autoLayout(named(figma.createFrame(), c.name), 'VERTICAL', { gap: 10 });
    row.appendChild(cell);
    const sw = figma.createRectangle();
    sw.name = 'swatch';
    sw.resize(220, 140);
    sw.fills = [solid(c.hex)];
    await sw.setFillStyleIdAsync(ctx.paint[c.name]);
    sw.strokes = [solid('#E3E3E3')];
    await sw.setStrokeStyleIdAsync(ctx.paint['chart-gray']);
    sw.strokeWeight = 1;
    cell.appendChild(sw);
    cell.appendChild(await txt(ctx, c.name + '  ' + c.hex, 'Body', 'ink'));
    const use = await txt(ctx, c.use, 'Caption', 'note');
    cell.appendChild(use);
    use.textAutoResize = 'HEIGHT';
    use.resize(220, use.height);
  }
  return sec;
}

/** @param {Ctx} ctx @param {string[]} substituted */
async function buildTypeBoard(ctx, substituted) {
  const sec = await section(ctx, '텍스트 스타일 (6) · 글꼴: ' + ctx.family);
  for (const t of TYPE) {
    const st = ctx.text[t.name];
    const row = autoLayout(named(figma.createFrame(), t.name), 'HORIZONTAL', { gap: 40, align: 'BASELINE' });
    sec.appendChild(row);
    const meta = await txt(ctx, t.name + ' · ' + t.size + ' ' + st.fontName.style + ' · 행간 ' + t.lh + '%', 'Caption', 'note');
    row.appendChild(meta);
    meta.textAutoResize = 'HEIGHT';
    meta.resize(320, meta.height);
    row.appendChild(await txt(ctx, t.name === 'Num' ? '01. 02. 48.9%' : '데이터로 찾고, 현장으로 확인하고', t.name, t.name === 'Caption' ? 'note' : 'ink'));
  }
  if (substituted.length) {
    sec.appendChild(await txt(ctx, '※ 글꼴에 없는 굵기를 대체: ' + substituted.join(', '), 'Caption', 'note'));
  }
  return sec;
}

/** @param {Ctx} ctx @param {string} title @param {SceneNode} node */
async function componentCell(ctx, title, node) {
  const cell = autoLayout(named(figma.createFrame(), title), 'VERTICAL', { gap: 16 });
  cell.appendChild(await txt(ctx, title, 'Caption', 'note'));
  cell.appendChild(node);
  return cell;
}

// ───────────────────────── 1단계 실행 ─────────────────────────

async function step1() {
  const page = await findOrCreatePage(PAGE_STYLE);
  await figma.setCurrentPageAsync(page);

  if (page.findOne((n) => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET')) {
    figma.closePlugin('이미 컴포넌트가 있습니다. 다시 만들려면 "' + PAGE_STYLE + '" 페이지 내용을 지운 뒤 실행하세요.');
    return;
  }

  const paint = await upsertPaintStyles();
  const typed = await upsertTextStyles();
  /** @type {Ctx} */
  const ctx = { family: typed.family, paint, text: typed.text };

  const board = autoLayout(named(figma.createFrame(), '00 Style Guide'), 'VERTICAL', { gap: 96, px: MARGIN_X, py: 96 });
  board.fills = [solid('#FFFFFF')];
  await board.setFillStyleIdAsync(ctx.paint.bg);
  page.appendChild(board);
  board.appendChild(await txt(ctx, '00 스타일·컴포넌트', 'H1', 'ink'));
  board.appendChild(await buildColorBoard(ctx));
  board.appendChild(await buildTypeBoard(ctx, typed.substituted));

  const comps = await section(ctx, '컴포넌트 (7 + 보조 1)');
  board.appendChild(comps);
  const grid = autoLayout(named(figma.createFrame(), 'components'), 'VERTICAL', { gap: 64 });
  comps.appendChild(grid);

  const hl = await buildHighlightText(ctx);
  grid.appendChild(await componentCell(ctx, '1. Highlight Text', hl));
  grid.appendChild(await componentCell(ctx, '2. Label Row', await buildLabelRow(ctx)));
  grid.appendChild(await componentCell(ctx, '3. TOC Row', await buildTocRow(ctx, hl)));
  grid.appendChild(await componentCell(ctx, '4. Page Header', await buildPageHeader(ctx)));
  grid.appendChild(await componentCell(ctx, '5. Footnote', await buildFootnote(ctx)));
  grid.appendChild(await componentCell(ctx, '6. Case Block', await buildCaseBlock(ctx)));
  grid.appendChild(await componentCell(ctx, '7. Assumption Badge', await buildAssumptionBadge(ctx)));
  grid.appendChild(await componentCell(ctx, '+ Image Placeholder (보조)', await buildImagePlaceholder(ctx)));

  figma.viewport.scrollAndZoomIntoView([board]);
  figma.closePlugin('1단계 완료: 색 5 · 텍스트 6 · 컴포넌트 7(+보조 1) · 글꼴 ' + ctx.family);
}

// ───────────────────────── 진입점 ─────────────────────────

/** @type {Record<string, () => Promise<void>>} */
const COMMANDS = { step1 };

(async () => {
  try {
    const run = COMMANDS[figma.command];
    if (!run) throw new Error('알 수 없는 명령: ' + figma.command);
    await run();
  } catch (e) {
    console.error(e);
    figma.closePlugin('오류: ' + (e && /** @type {Error} */ (e).message ? /** @type {Error} */ (e).message : String(e)));
  }
})();

// 2단계 이후에서 사용
void loadCtx;
