/* =========================================================================
   상품 사진 자동 태깅 (MediaPipe Image Classifier + 대표 컬러 추출)
   - 사진은 브라우저 안에서만 처리되고 어디에도 전송·저장되지 않습니다.
   - MediaPipe 모델을 못 불러오는 환경에서는 컬러·썸네일 검수만 하고 카테고리는 수동 지정으로 둡니다.
   ========================================================================= */
(function () {
  "use strict";
  const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/";
  const MODEL = "https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite";
  let classifier = null, loading = null;

  async function getClassifier() {
    if (classifier) return classifier;
    if (!loading) {
      loading = (async () => {
        const mod = await import(MP + "vision_bundle.mjs");
        const fs = await mod.FilesetResolver.forVisionTasks(MP + "wasm");
        classifier = await mod.ImageClassifier.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate: "CPU" }, runningMode: "IMAGE", maxResults: 5 });
        return classifier;
      })().catch(e => { loading = null; throw e; });
    }
    return loading;
  }

  // ImageNet 라벨 → 패션 카테고리 (키워드 포함 여부)
  const CAT_MAP = [
    ["아우터", ["trench coat", "fur coat", "parka", "lab coat", "cloak", "poncho", "bulletproof vest"]],
    ["니트", ["cardigan", "wool", "sweater"]],
    ["셋업", ["suit", "academic gown"]],
    ["원피스", ["gown", "overskirt", "hoopskirt", "abaya", "kimono", "apron"]],
    ["상의", ["jersey", "t-shirt", "sweatshirt", "blouse", "polo"]],
    ["팬츠", ["jean", "trouser", "pajama"]],
    ["스커트", ["miniskirt", "sarong"]],
    ["가방", ["purse", "handbag", "backpack", "mailbag", "wallet", "pencil case"]],
    ["신발", ["shoe", "boot", "loafer", "sandal", "clog", "sneaker", "slipper"]],
    ["액세서리", ["sunglass", "stole", "bow tie", "cowboy hat", "sombrero", "bonnet", "mitten", "necklace", "beanie", "scarf"]]
  ];
  const KO_LABEL = { "trench coat": "트렌치 코트", "fur coat": "퍼 코트", "cardigan": "가디건", "jersey": "티셔츠/저지", "sweatshirt": "스웨트셔츠", "jean": "데님", "miniskirt": "미니스커트", "suit": "수트", "gown": "드레스", "purse": "지갑/핸드백", "backpack": "백팩", "mailbag": "메신저백", "running shoe": "운동화", "loafer": "로퍼", "cowboy boot": "부츠", "sandal": "샌들", "clog": "클로그", "stole": "숄/머플러", "sunglass": "선글라스", "sunglasses": "선글라스", "wool": "울/니트", "poncho": "판초", "cloak": "망토", "bow tie": "보타이", "mitten": "장갑", "pajama": "파자마", "overskirt": "오버스커트", "abaya": "롱 원피스", "kimono": "로브", "lab coat": "롱 코트", "apron": "에이프런", "sarong": "랩스커트", "wallet": "지갑", "necklace": "목걸이", "bonnet": "모자", "sombrero": "모자", "cowboy hat": "모자", "parka": "파카" };

  function toCategory(cats) {
    for (const c of cats) {
      const name = (c.categoryName || "").toLowerCase();
      for (const [ko, keys] of CAT_MAP) if (keys.some(k => name.includes(k))) return { cat: ko, label: c.categoryName, score: c.score };
    }
    return null;
  }

  // ---- 대표 컬러 (배경 제외 후 k-means) ------------------------------------
  const NAMED = { "블랙": [29, 29, 31], "화이트": [246, 246, 244], "아이보리": [238, 230, 214], "베이지": [214, 194, 160], "카멜": [181, 130, 80], "브라운": [110, 74, 51], "그레이": [163, 166, 170], "차콜": [70, 72, 77], "네이비": [37, 51, 90], "블루": [47, 92, 184], "스카이블루": [169, 200, 234], "카키": [111, 107, 69], "그린": [63, 122, 74], "레드": [192, 50, 47], "버건디": [111, 29, 46], "핑크": [233, 180, 193], "퍼플": [108, 85, 168], "옐로우": [232, 197, 71], "오렌지": [224, 122, 54] };
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  function lab([r, g, b]) {
    const R = lin(r), G = lin(g), B = lin(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const NAMED_LAB = Object.entries(NAMED).map(([k, v]) => [k, lab(v), v]);
  const nearestName = rgb => { const L = lab(rgb); let best = null, bd = 1e9; NAMED_LAB.forEach(([k, l]) => { const d = dist(L, l); if (d < bd) { bd = d; best = k; } }); return best; };
  const hex = ([r, g, b]) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");

  function colors(canvas) {
    const S = 72, c = document.createElement("canvas"); c.width = S; c.height = S;
    const ctx = c.getContext("2d"); ctx.drawImage(canvas, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;
    const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    // 배경색 = 테두리 픽셀 평균
    const border = []; for (let i = 0; i < S; i++) { border.push(px[i], px[(S - 1) * S + i], px[i * S], px[i * S + S - 1]); }
    const bg = [0, 1, 2].map(k => border.reduce((s, p) => s + p[k], 0) / border.length);
    const bgL = lab(bg);
    const fg = px.filter(p => dist(lab(p), bgL) > 14);
    const fill = fg.length / px.length;
    const pts = (fg.length > 50 ? fg : px).map(p => ({ p, l: lab(p) }));
    // k-means k=3
    let cent = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map(x => x.l.slice());
    let assign = new Array(pts.length).fill(0);
    for (let it = 0; it < 8; it++) {
      pts.forEach((x, i) => { let bd = 1e9; cent.forEach((c, j) => { const dd = dist(x.l, c); if (dd < bd) { bd = dd; assign[i] = j; } }); });
      cent = cent.map((c, j) => { const m = pts.filter((_, i) => assign[i] === j); if (!m.length) return c; return [0, 1, 2].map(k => m.reduce((s, x) => s + x.l[k], 0) / m.length); });
    }
    const groups = cent.map((_, j) => { const m = pts.filter((_, i) => assign[i] === j); const rgb = m.length ? [0, 1, 2].map(k => m.reduce((s, x) => s + x.p[k], 0) / m.length) : [0, 0, 0]; return { share: m.length / pts.length, rgb }; })
      .filter(g => g.share > 0.04).sort((a, b) => b.share - a.share);
    const merged = [];
    groups.forEach(g => { const name = nearestName(g.rgb), m = merged.find(x => x.name === name); if (m) m.share += g.share; else merged.push({ name, hex: hex(g.rgb), share: g.share }); });
    return { fill, bg: hex(bg), palette: merged.sort((a, b) => b.share - a.share) };
  }

  function ratioLabel(w, h) {
    const r = w / h, opts = [["1:1", 1], ["4:5", 0.8], ["3:4", 0.75], ["2:3", 0.667], ["16:9", 1.778]];
    let best = opts[0]; opts.forEach(o => { if (Math.abs(o[1] - r) < Math.abs(best[1] - r)) best = o; });
    return Math.abs(best[1] - r) < 0.03 ? best[0] : `${w}×${h}`;
  }

  async function analyze(file, onStatus) {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const s = Math.min(1, 640 / Math.max(W, H));
    const cv = document.createElement("canvas"); cv.width = Math.round(W * s); cv.height = Math.round(H * s);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const col = colors(cv);
    let cls = null, labels = [], method = "mediapipe";
    try {
      onStatus && onStatus("MediaPipe 이미지 분류 모델 불러오는 중…");
      const c = await getClassifier();
      onStatus && onStatus("카테고리 분류 중…");
      const r = c.classify(cv);
      const cats = (r.classifications[0] || {}).categories || [];
      labels = cats.map(x => ({ en: x.categoryName, ko: KO_LABEL[x.categoryName] || x.categoryName, score: x.score }));
      cls = toCategory(cats);
    } catch (e) {
      console.warn("MediaPipe unavailable", e);
      method = "fallback";
    }
    return { url, w: W, h: H, ratio: ratioLabel(W, H), fill: col.fill, palette: col.palette, color: col.palette[0] && col.palette[0].name, colorHex: col.palette[0] && col.palette[0].hex, category: cls && cls.cat, catLabel: cls && (KO_LABEL[cls.label] || cls.label), catScore: cls && cls.score, labels, method };
  }

  window.FMDVision = { analyze };
})();
