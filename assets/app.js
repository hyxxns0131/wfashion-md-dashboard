/* =========================================================================
   Fashion MD Workspace — 화면 · 계산 · 규칙
   원칙(Reboot 대시보드에서 가져옴): "판단은 규칙이 하고, 근거를 함께 보여주고, 최종 결정은 MD가 한다."
   ========================================================================= */
(function () {
  "use strict";
  const D = window.FMD;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const N = D.dates.length;
  const brandOf = id => D.BRANDS.find(b => b.id === id);
  const prodOf = id => D.PRODUCTS.find(p => p.id === id);

  /* ---------------- 포맷 ---------------- */
  const fmt = n => Math.round(n).toLocaleString("ko-KR");
  const won = n => { const a = Math.abs(n); if (a >= 1e8) return (n / 1e8).toFixed(2) + "억"; if (a >= 1e4) return fmt(n / 1e4) + "만"; return fmt(n) + "원"; };
  const pct = (n, d = 1) => (n * 100).toFixed(d) + "%";
  const delta = (cur, prev) => prev ? (cur - prev) / prev : 0;
  const dTag = (v, inv) => { const good = inv ? v < 0 : v >= 0; return `<span class="${good ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v * 100).toFixed(1)}%</span>`; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = s => s.slice(5).replace("-", "/");
  const dd = (a, b) => Math.round((new Date(a) - new Date(b)) / 864e5);
  const todayStr = D.util.dayStr(D.TODAY);
  const brandColor = id => ["#2b5fc4", "#e07a36", "#1f9d74", "#c99a00", "#d4628d", "#4a7a2a", "#6a55c9", "#cf4b4b", "#3d8fb5", "#8a6d3b", "#5c6ac4", "#a0522d"][D.BRANDS.findIndex(b => b.id === id) % 12];
  const toast = msg => { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); };
  const copy = async (txt, msg) => { try { await navigator.clipboard.writeText(txt); toast(msg || "복사했어요"); } catch (e) { toast("복사 권한이 없어 아래 내용을 직접 선택해 복사해 주세요"); } };

  /* ---------------- 공통 계산 ---------------- */
  const netPrice = p => p.price * (1 - p.disc / 100);
  const sumRange = (arr, a, b) => arr.slice(a, b).reduce((s, v) => s + v, 0);
  function gmvDaily(filter) {
    const out = new Array(N).fill(0);
    D.PRODUCTS.forEach(p => { if (filter && !filter(p)) return; const np = netPrice(p); p.daily.forEach((q, i) => out[i] += q * np); });
    return out;
  }
  const qtyDaily = filter => { const out = new Array(N).fill(0); D.PRODUCTS.forEach(p => { if (filter && !filter(p)) return; p.daily.forEach((q, i) => out[i] += q); }); return out; };
  const optCoverDays = o => { const r = o.sold7 / 7; return r > 0 ? o.stock / r : Infinity; };
  const prodStock = p => p.options.reduce((s, o) => s + o.stock, 0);
  const prodSold28 = p => p.options.reduce((s, o) => s + o.sold28, 0);
  const sellThrough = p => { const s = prodSold28(p), st = prodStock(p); return s + st ? s / (s + st) : 0; };

  // 브랜드 지표
  const BSTAT = D.BRANDS.map(b => {
    const ps = D.PRODUCTS.filter(p => p.brand === b.id);
    const g = gmvDaily(p => p.brand === b.id);
    const cur = sumRange(g, N - 7, N), prev = sumRange(g, N - 14, N - 7), m28 = sumRange(g, N - 28, N);
    const opts = ps.flatMap(p => p.options);
    const sold = opts.reduce((s, o) => s + o.sold28, 0), stock = opts.reduce((s, o) => s + o.stock, 0);
    const oos = opts.filter(o => o.stock === 0).length / opts.length;
    const rv = ps.reduce((s, p) => s + p.reviews, 0);
    const rating = ps.reduce((s, p) => s + p.rating * p.reviews, 0) / rv;
    const voc = D.VOC.filter(v => v.brand === b.id);
    const neg = voc.filter(v => v.rating <= 3).length / (voc.length || 1);
    const wow = delta(cur, prev);
    const st = sold / (sold + stock);
    const exclCur = ps.filter(p => p.excl).reduce((a, p) => a + sumRange(p.daily, N - 7, N) * netPrice(p), 0);
    // 등급 점수 (가중치는 MD가 조정할 수 있는 가정값)
    const score = 50 + wow * 60 + (st - 0.45) * 60 + (rating - 4.2) * 25 - (b.ret - 0.09) * 180 - oos * 40;
    const grade = score >= 58 ? "A" : score >= 44 ? "B" : "C";
    return { b, ps, cur, prev, m28, wow, st, oos, excl: cur ? exclCur / cur : 0, rating, reviews: rv, ret: b.ret, neg, voc, grade, score, fee: cur * b.fee, skus: opts.length };
  });
  const avgRet = BSTAT.reduce((s, x) => s + x.ret * x.m28, 0) / BSTAT.reduce((s, x) => s + x.m28, 0);

  /* ---------------- VOC 주제 분류 (Reboot 챗봇 질문 분석처럼 키워드 규칙) ---------------- */
  const TOPICS = [
    ["사이즈", ["사이즈", "작아", "커서", "치수", "어깨", "기장", "허리", "실측", "핏이 작"]],
    ["재입고", ["재입고", "다시 들어", "품절"]],
    ["색상", ["색", "컬러", "어두워", "회색빛"]],
    ["소재·품질", ["보풀", "혼용", "봉제", "얇아", "세탁", "소재"]],
    ["배송", ["출고", "배송", "포장이", "예약"]],
    ["만족", ["예뻐", "최고", "좋아", "재구매"]]
  ];
  const classify = t => { for (const [k, ws] of TOPICS) if (ws.some(w => t.includes(w))) return k; return "기타"; };
  D.VOC.forEach(v => v.topic = classify(v.text));

  /* ---------------- 상품 등록 검수 규칙 (Reboot 컴플라이언스 판정 체계 응용) ---------------- */
  const LEVEL = { PASS: 0, REVIEW: 1, REVISE: 2, BLOCK: 3 };
  const LV_TAG = { PASS: "good", REVIEW: "opp", REVISE: "warn", BLOCK: "crit" };
  const RULES = [
    { code: "F01", name: "소재(혼용률) 표기", lv: "REVISE", why: "상품정보제공고시 필수 항목 · 소재 문의/반품의 주요 원인" },
    { code: "F02", name: "제조국 표기", lv: "REVISE", why: "상품정보제공고시 필수 항목" },
    { code: "F03", name: "세탁·취급 주의", lv: "REVIEW", why: "니트·울 소재 클레임 예방" },
    { code: "F04", name: "실측 사이즈표", lv: "REVISE", why: "반품 사유 1위가 사이즈 → 실측표 없으면 반려" },
    { code: "F05", name: "근거 없는 최상급 표현", lv: "REVISE", why: "'최저가·최고·1위' 등은 근거 자료 없으면 표시광고 위반 소지" },
    { code: "F06", name: "타 브랜드 연상 표현", lv: "BLOCK", why: "'명품st·○○스타일'은 상표권 분쟁 소지 → 등록 불가" },
    { code: "F07", name: "상품명 소재 과장", lv: "REVISE", why: "상품명에 '캐시미어' 등 고가 소재를 앞세웠는데 함량이 낮으면 오인 소지" },
    { code: "F08", name: "썸네일 해상도·비율", lv: "REVIEW", why: "1000px 이상, 1:1·3:4·4:5 비율 권장" },
    { code: "F09", name: "썸네일 상품 비중", lv: "REVIEW", why: "화면 대비 상품이 40% 미만이면 목록에서 눈에 띄지 않음" },
    { code: "F10", name: "등록 할인율 상한", lv: "REVIEW", why: "등록 시점 50% 초과 할인은 가격 정책 확인 필요" },
    { code: "F11", name: "컬러 옵션 ↔ 사진 대표색", lv: "REVIEW", why: "'색상 상이' 반품 예방 · MediaPipe 사진 분석 결과와 비교" },
    { code: "F12", name: "카테고리 ↔ 사진 분류", lv: "REVIEW", why: "잘못된 카테고리는 검색·기획전 노출 누락 · MediaPipe 분류 결과와 비교" }
  ];
  const SIMILAR = { "블랙": ["차콜"], "차콜": ["블랙", "그레이"], "그레이": ["차콜", "실버"], "아이보리": ["화이트", "베이지"], "화이트": ["아이보리"], "베이지": ["아이보리", "카멜"], "카멜": ["베이지", "브라운", "오렌지"], "브라운": ["카멜", "버건디"], "네이비": ["블루", "블랙"], "버건디": ["브라운", "레드"], "스카이블루": ["블루"], "카키": ["그린", "브라운"] };
  function review(item, vision) {
    const hits = [];
    const add = (code, msg) => { const r = RULES.find(x => x.code === code); hits.push({ ...r, msg }); };
    if (!item.material) add("F01", "혼용률이 비어 있어요. 브랜드에 소재 정보를 요청하세요.");
    if (!item.origin) add("F02", "제조국이 비어 있어요.");
    if (!item.care) add("F03", "세탁·취급 주의가 없어요.");
    if (!item.sizeChart) add("F04", "실측 사이즈표가 없어요. 이 브랜드 반품 사유 1위가 사이즈인지 확인하세요.");
    const sup = ["최저가", "최고", "1위", "역대급", "완판"].filter(w => item.name.includes(w));
    if (sup.length) add("F05", `상품명에 '${sup.join("', '")}' 표현이 있어요. 근거가 없으면 삭제하세요.`);
    if (/명품|st\b|st |스타일$/i.test(item.name) || /[가-힣a-z]st\s/i.test(item.name + " ")) add("F06", "타 브랜드·명품을 연상시키는 표현이 있어요. 상품명에서 빼야 등록할 수 있어요.");
    const m = item.material.match(/캐시미어\s*(\d+)%/);
    if (item.name.includes("캐시미어") && (!m || +m[1] < 30)) add("F07", `상품명은 '캐시미어'인데 함량은 ${m ? m[1] + "%" : "표기 없음"}이에요. '캐시미어 블렌드' 등으로 수정 권장.`);
    const img = vision ? { w: vision.w, h: vision.h, ratio: vision.ratio, fill: vision.fill } : item.img;
    if (img) {
      const okRatio = ["1:1", "3:4", "4:5"].includes(img.ratio);
      if (Math.min(img.w, img.h) < 1000 || !okRatio) add("F08", `${img.w}×${img.h}px · 비율 ${img.ratio}${Math.min(img.w, img.h) < 1000 ? " (해상도 부족)" : ""}${okRatio ? "" : " (권장 비율 아님)"}`);
      if (img.fill < 0.4) add("F09", `상품이 화면의 ${pct(img.fill, 0)}만 차지해요. 크롭해서 40% 이상으로.`);
    }
    if (item.disc > 50) add("F10", `등록 할인율 ${item.disc}% — 정가 부풀리기 여부 확인.`);
    if (vision && vision.color) {
      const same = vision.color === item.color || (SIMILAR[item.color] || []).includes(vision.color);
      if (!same) add("F11", `옵션은 '${item.color}'인데 사진 대표색은 '${vision.color}'로 보여요. 옵션명 또는 사진 확인.`);
    }
    if (vision && vision.category && vision.category !== item.cat) add("F12", `등록 카테고리는 '${item.cat}', 사진 분류는 '${vision.category}'(${vision.catLabel}).`);
    const top = hits.reduce((m2, h) => LEVEL[h.lv] > LEVEL[m2] ? h.lv : m2, "PASS");
    return { verdict: top, hits };
  }
  const REG_RESULT = Object.fromEntries(D.REG_QUEUE.map(it => [it.id, review(it)]));

  /* ---------------- 이번 주 할 일 (규칙 → 근거) ---------------- */
  function buildTodos() {
    const T = [];
    // R1 품절 임박 (히트 옵션)
    D.PRODUCTS.forEach(p => {
      const risky = p.options.filter(o => o.sold7 >= 8 && optCoverDays(o) <= 7);
      if (risky.length) {
        const days = Math.min(...risky.map(optCoverDays));
        T.push({ g: "긴급", rule: "R1", title: `${p.excl ? "[W.only 단독] " : ""}${brandOf(p.brand).name} '${p.name}' 리오더 요청`, why: `${risky.map(o => o.color + " " + o.size).slice(0, 3).join(", ")} 재고가 ${days < 1 ? "1일" : Math.floor(days) + "일"}치만 남음 (최근 7일 ${fmt(risky.reduce((s, o) => s + o.sold7, 0))}개 판매)`, go: "#sales", w: 100 + risky.reduce((s2, o) => s2 + o.sold7, 0) + (p.excl ? 500 : 0) });
      }
    });
    // R2 기획전 준비 시작일
    D.PROMOS.filter(p => p.lead).forEach(p => {
      const prep = D.util.dayStr(D.util.addDays(new Date(p.start), -p.lead));
      const dday = dd(p.start, todayStr);
      if (todayStr >= prep && dday > 0) T.push({ g: dday <= 14 ? "긴급" : "기회", rule: "R2", title: `'${p.name}' 참여 브랜드·상품 확정`, why: `D-${dday} · 준비 시작일(${md(prep)}) 지남 · 목표 거래액 ${won(p.target)}`, go: "#promo", w: 90 - dday });
    });
    // R3 반품률·사이즈
    BSTAT.forEach(x => {
      const top = Object.entries(x.b.retReasons).sort((a, b) => b[1] - a[1])[0];
      if (x.ret >= avgRet + 0.04 && top[0] === "사이즈 불만") T.push({ g: "긴급", rule: "R3", title: `${x.b.name}에 실측 사이즈표 보완 요청`, why: `반품률 ${pct(x.ret)} (평균 ${pct(avgRet)}) · 반품 사유 1위 사이즈 ${pct(top[1], 0)}`, go: "#brands", w: 70 + x.ret * 100 });
    });
    // R4 매출 급감
    BSTAT.filter(x => x.wow <= -0.15).forEach(x => T.push({ g: x.wow <= -0.25 ? "긴급" : "참고", rule: "R4", title: `${x.b.name} 매출 하락 원인 확인`, why: `최근 7일 거래액 ${won(x.cur)} · 전주 대비 ${pct(x.wow)}`, go: "#brands", w: 60 - x.wow * 100 }));
    // R5 등록 검수
    const bad = D.REG_QUEUE.filter(it => ["REVISE", "BLOCK"].includes(REG_RESULT[it.id].verdict));
    if (bad.length) T.push({ g: "참고", rule: "R5", title: `등록 대기 ${bad.length}건 수정 요청 회신`, why: `${bad.map(it => brandOf(it.brand).name).join(", ")} · BLOCK ${bad.filter(it => REG_RESULT[it.id].verdict === "BLOCK").length}건 포함`, go: "#register", w: 40 });
    // R6 수요-공급 갭
    CAT_GAP().filter(c => c.searchWow >= 0.15 && c.gap > 0.01).slice(0, 2).forEach(c => T.push({ g: "기회", rule: "R6", title: `${c.cat} 신규 브랜드 소싱 검토`, why: `검색 수요 전주 대비 +${pct(c.searchWow, 0)} · 수요 비중 ${pct(c.demandShare)} vs 상품 비중 ${pct(c.supplyShare)}`, go: "#sourcing", w: 50 + c.gap * 100 }));
    // R7 재입고 문의
    const re = {}; D.VOC.filter(v => v.topic === "재입고").forEach(v => re[v.product] = (re[v.product] || 0) + 1);
    const reTop = Object.entries(re).sort((a, b) => b[1] - a[1])[0];
    if (reTop && reTop[1] >= 3) { const p = prodOf(reTop[0]); T.push({ g: "기회", rule: "R7", title: `'${p.name}' 재입고 알림 대상 확보`, why: `최근 28일 재입고 문의 ${reTop[1]}건 (${brandOf(p.brand).name})`, go: "#voc", w: 45 }); }
    // R8 기획전 목표 페이스
    PROMO_STAT().filter(s => s.p.status === "진행 중" && s.pace < -0.08).forEach(s => T.push({ g: "긴급", rule: "R8", title: `'${s.p.name}' 메인 노출·쿠폰 보강`, why: `기간 ${pct(s.elapsed, 0)} 지났는데 목표 달성 ${pct(s.achv, 0)}`, go: "#promo", w: 85 }));
    // R9 저평점
    D.PRODUCTS.filter(p => p.rating < 4.0 && p.reviews >= 10).forEach(p => T.push({ g: "참고", rule: "R9", title: `'${p.name}' 상세페이지·노출 순서 점검`, why: `평점 ${p.rating} (리뷰 ${p.reviews}개) · ${brandOf(p.brand).name}`, go: "#voc", w: 30 }));
    // R10 인플루언서 PICK
    PICK_STAT().forEach(k => {
      if (k.cvr >= 0.05) T.push({ g: "기회", rule: "R10", title: `${k.who} × ${brandOf(k.brand).name} 2차 PICK 협업 제안`, why: `전환율 ${pct(k.cvr)} · 매출 ${won(k.gmv)}${k.reorder ? " · 리오더로 연결됨" : ""}`, go: "#promo", w: 60 + k.cvr * 100 });
      else if (k.cvr < 0.015) T.push({ g: "참고", rule: "R10", title: `${k.who} PICK 링크 노출 조정 검토`, why: `유입 ${fmt(k.clicks)}회 대비 전환율 ${pct(k.cvr)} (상품 ${k.product})`, go: "#promo", w: 25 });
    });
    const order = { "긴급": 0, "기회": 1, "참고": 2 };
    const CAP = { R1: 3, R3: 2, R4: 2, R6: 2, R9: 1, R10: 1 }, used = {};
    return T.sort((a, b) => order[a.g] - order[b.g] || b.w - a.w)
      .filter(t => { used[t.rule] = (used[t.rule] || 0) + 1; return used[t.rule] <= (CAP[t.rule] || 9); })
      .slice(0, 10).map((t, i) => ({ ...t, id: "t" + i }));
  }
  const GTAG = { "긴급": "crit", "기회": "opp", "참고": "ref" };
  const RULE_TXT = { R1: "재고 7일치 이하 + 최근 7일 8개 이상 판매 → 긴급 (W.only 단독 상품 우선, 판매량 큰 순 3건)", R2: "기획전 준비 시작일 도래 → D-14 이내 긴급, 그 외 기회", R3: "반품률이 평균+4%p 이상이고 사유 1위가 사이즈 → 긴급", R4: "브랜드 거래액 전주 대비 -15% 이하 → 참고(-25% 이하 긴급)", R5: "등록 대기 중 REVISE·BLOCK → 참고", R6: "검색 수요 +15% 이상 & 수요 비중 > 상품 비중 → 기회", R7: "같은 상품 재입고 문의 3건 이상 → 기회", R8: "진행 기획전 목표 달성률이 기간 경과율보다 8%p 이상 낮음 → 긴급", R9: "평점 4.0 미만 & 리뷰 10개 이상 → 참고", R10: "인플루언서 PICK 전환율 5% 이상 → 재협업 기회 / 1.5% 미만 → 참고" };

  /* ---------------- 카테고리 갭 · 기획전 ---------------- */
  function CAT_GAP() {
    const cats = Object.keys(D.CATEGORIES);
    const totalSearch = cats.reduce((s, c) => s + D.CATEGORIES[c].search, 0);
    const totalSku = D.PRODUCTS.length;
    return cats.map(c => {
      const ps = D.PRODUCTS.filter(p => p.cat === c), C = D.CATEGORIES[c];
      const g = gmvDaily(p => p.cat === c);
      const sold = ps.reduce((s, p) => s + prodSold28(p), 0), stock = ps.reduce((s, p) => s + prodStock(p), 0);
      return { cat: c, demandShare: C.search / totalSearch, supplyShare: ps.length / totalSku, gap: C.search / totalSearch - ps.length / totalSku, searchWow: delta(C.search, C.searchPrev), products: ps.length, brands: new Set(ps.map(p => p.brand)).size, gmv7: sumRange(g, N - 7, N), gmvPrev: sumRange(g, N - 14, N - 7), st: sold / (sold + stock || 1), avgPrice: ps.reduce((s, p) => s + p.price, 0) / (ps.length || 1) };
    }).sort((a, b) => b.gap - a.gap);
  }
  function PROMO_STAT() {
    return D.PROMOS.map(p => {
      const a = D.dates.indexOf(p.start), b = D.dates.indexOf(p.end);
      const inWin = a >= 0 || b >= 0 || (p.start < D.dates[0] && p.end > todayStr);
      const g = gmvDaily(x => p.cats.length === 0 || p.cats.includes(x.cat));
      const from = a < 0 ? 0 : a, to = b < 0 ? N - 1 : b;
      const actual = inWin && p.status !== "준비" && p.status !== "기획" ? sumRange(g, from, Math.min(to, N - 1) + 1) * 0.55 : 0; // 기획전 페이지 경유 비중 55% 가정
      const total = dd(p.end, p.start) + 1, gone = Math.max(0, Math.min(total, dd(todayStr, p.start) + 1));
      const elapsed = gone / total, achv = actual / p.target;
      return { p, actual, achv, elapsed, pace: achv - elapsed, dday: dd(p.start, todayStr), prep: D.util.dayStr(D.util.addDays(new Date(p.start), -(p.lead || 14))) };
    });
  }

  function PICK_STAT() {
    return (D.PICKS || []).map(k => { const p = D.PRODUCTS.find(x => x.brand === k.brand && x.name === k.product) || D.PRODUCTS.find(x => x.brand === k.brand); const price = p ? netPrice(p) : 100000; const gmv = k.orders * price; return { ...k, p, cvr: k.orders / k.clicks, gmv, perK: k.orders / (k.follow / 1000), fee: gmv * brandOf(k.brand).fee }; }).sort((a, b) => b.gmv - a.gmv);
  }
  /* ---------------- 공통 UI ---------------- */
  const charts = {};
  function chart(id, cfg) { if (!window.Chart) { const el = document.getElementById(id); if (el) el.parentElement.innerHTML = '<p class="cap">차트 라이브러리를 불러오지 못했어요.</p>'; return; } if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }
  if (window.Chart) { Chart.defaults.font.family = '"Noto Sans KR",system-ui,sans-serif'; Chart.defaults.font.size = 11.5; Chart.defaults.color = "#4d5670"; }
  const TT = { backgroundColor: "#1b2440", padding: 10, cornerRadius: 10, boxPadding: 4 };
  const axes = (yfmt, extra = {}) => ({ x: { grid: { display: false }, border: { color: "#e6e9f0" }, ...(extra.x || {}) }, y: { beginAtZero: true, grid: { color: "#eef0f5" }, border: { display: false }, ticks: { callback: yfmt || (v => v) }, ...(extra.y || {}) } });
  const brandIco = b => `<span class="ico" style="background:${brandColor(b.id)}">${esc(b.name.slice(0, 1))}</span>`;
  const sw = c => `<span class="sw" style="background:${D.COLOR_HEX[c] || "#ccc"}"></span>`;
  const tableHTML = (head, rows, cls = "") => `<div class="wrap"><table class="tbl ${cls}"><tr>${head.map(h => `<th class="${h.startsWith("#") ? "num" : ""}">${h.replace(/^#/, "")}</th>`).join("")}</tr>${rows.join("")}</table></div>`;
  const tblToggle = (id, html) => `<button class="tbtn" data-t="${id}">표로 보기</button><div id="${id}" hidden>${html}</div>`;
  document.addEventListener("click", e => { const b = e.target.closest(".tbtn"); if (!b) return; const t = document.getElementById(b.dataset.t); t.hidden = !t.hidden; b.textContent = t.hidden ? "표로 보기" : "표 닫기"; });

  /* ---------------- 상태 ---------------- */
  let DONE = {}; try { DONE = JSON.parse(localStorage.getItem("fmd_done") || "{}"); } catch (e) { }
  const saveDone = () => { try { localStorage.setItem("fmd_done", JSON.stringify(DONE)); } catch (e) { } };
  const TODOS = buildTodos();

  /* =======================================================================
     ① 홈 · 데일리 브리핑
     ======================================================================= */
  function vHome() {
    const g = gmvDaily(), q = qtyDaily();
    const cur = sumRange(g, N - 7, N), prev = sumRange(g, N - 14, N - 7);
    const qc = sumRange(q, N - 7, N), qp = sumRange(q, N - 14, N - 7);
    const fee = BSTAT.reduce((s, x) => s + x.fee, 0), feePrev = BSTAT.reduce((s, x) => s + x.prev * x.b.fee, 0);
    const allOpt = D.PRODUCTS.flatMap(p => p.options);
    const oos = allOpt.filter(o => o.stock === 0).length;
    const ps = PROMO_STAT();
    const live = ps.filter(s => s.p.status === "진행 중");
    const urgent = TODOS.filter(t => t.g === "긴급").length;
    const pendingReg = D.REG_QUEUE.length;
    return `
    <div class="ph"><h1>오늘의 브리핑</h1><button class="sq" title="새로고침" onclick="location.reload()">${I.refresh}</button>
      <div class="right"><span class="sample">예시 데이터</span><span class="cap" style="margin:0;color:var(--muted)">기준일 2026.11.12 (목) · 최근 7일 vs 직전 7일</span></div></div>
    <p class="desc">판매·재고·기획전·VOC를 규칙으로 점검해 오늘 먼저 처리할 일을 근거와 함께 보여줍니다.</p>

    <div class="sec">QUICK ACCESS</div>
    <div class="quick">
      ${live.map((s, i) => `<button class="folder ${i === 0 ? "blue" : ""}" onclick="location.hash='promo'">
        <span class="lab">진행 중 기획전</span><span class="v">${pct(s.achv, 0)}</span>
        <span class="chips">${D.BRANDS.filter(b => s.p.cats.length === 0 || b.main.some(c => s.p.cats.includes(c))).slice(0, 4).map(b => `<i style="background:${brandColor(b.id)};color:#fff">${esc(b.name[0])}</i>`).join("")}</span>
        <span class="k">기획전</span><span class="n">${esc(s.p.name)} · ${s.p.end.slice(5).replace("-", "/")} 종료</span></button>`).join("")}
      <button class="folder" onclick="document.getElementById('todo').scrollIntoView({behavior:'smooth'})"><span class="lab">이번 주 할 일</span><span class="v">${urgent}<small style="font-size:13px;color:var(--muted)"> 긴급 / ${TODOS.length}</small></span><span class="k">TO-DO</span><span class="n">규칙 기반 · 근거 포함</span></button>
      <button class="folder" onclick="location.hash='register'"><span class="lab">등록 대기 상품</span><span class="v">${pendingReg}<small style="font-size:13px;color:var(--muted)">건</small></span><span class="k">상품 검수</span><span class="n">수정 필요 ${Object.values(REG_RESULT).filter(r => r.verdict !== "PASS" && r.verdict !== "REVIEW").length}건</span></button>
    </div>

    <div class="sec">KEY METRICS <span class="hint">담당 브랜드 12개 기준</span></div>
    <div class="grid g4">
      <div class="kpi"><div class="k">거래액 (7일)</div><div class="v">${won(cur)}</div><div class="s">${dTag(delta(cur, prev))} 전주 대비</div></div>
      <div class="kpi"><div class="k">판매 수량 (7일)</div><div class="v">${fmt(qc)}개</div><div class="s">${dTag(delta(qc, qp))} · 평균 판매가 ${won(cur / qc)}</div></div>
      <div class="kpi"><div class="k">수수료 수익 (7일)</div><div class="v">${won(fee)}</div><div class="s">${dTag(delta(fee, feePrev))} · 평균 수수료율 ${pct(fee / cur)}</div></div>
      <div class="kpi"><div class="k">품절 옵션</div><div class="v">${oos}<small style="font-size:13px"> / ${allOpt.length} SKU</small></div><div class="s">품절률 ${pct(oos / allOpt.length)}</div></div>
    </div>

    <div class="grid g32" style="margin-top:16px">
      <div class="card" id="todo">
        <h3>이번 주 할 일 — 긴급 ${urgent}건</h3>
        <p class="cap">판단은 규칙이 하고, 근거를 함께 보여줍니다. 체크한 항목은 이 브라우저에 저장돼요.</p>
        ${TODOS.map(t => `<div class="todo ${DONE[t.title] ? "done" : ""}" data-k="${esc(t.title)}">
          <button class="chk" aria-label="완료">${DONE[t.title] ? "✓" : ""}</button>
          <div><span class="tag ${GTAG[t.g]}">${t.g}</span> <b style="display:inline">${esc(t.title)}</b><div class="why">${esc(t.why)} <em title="${esc(RULE_TXT[t.rule])}">· 규칙 ${t.rule}</em></div></div>
          <a class="go" href="${t.go}">열기 →</a></div>`).join("")}
        <details style="margin-top:10px;font-size:12px;color:var(--ink-2)"><summary style="cursor:pointer">적용 규칙 10개 보기</summary><ul style="margin:6px 0 0;padding-left:18px">${Object.entries(RULE_TXT).map(([k, v]) => `<li><b>${k}</b> ${esc(v)}</li>`).join("")}</ul></details>
      </div>
      <div class="card">
        <h3>기획전 캘린더</h3><p class="cap">준비 시작일 = 오픈일 − 준비 기간 (Reboot 시즌 캘린더 방식)</p>
        <div class="cal">${ps.filter(s => s.p.status !== "종료").map(s => `<div class="ev"><div class="d">${s.dday > 0 ? "D-" + s.dday : "진행"}<small>${md(s.p.start)}</small></div>
          <div><b>${esc(s.p.name)}</b><span>${esc(s.p.theme)} · 준비 시작 ${md(s.prep)} · 목표 ${won(s.p.target)}</span></div>
          <span class="tag ${s.p.status === "진행 중" ? "good" : todayStr >= s.prep ? "crit" : "ref"}">${s.p.status === "진행 중" ? "진행 중" : todayStr >= s.prep ? "준비 중" : "예정"}</span></div>`).join("")}</div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>${delta(cur, prev) >= 0 ? "이번 주 거래액이 지난주보다 " + pct(delta(cur, prev)) + " 늘었어요" : "이번 주 거래액이 지난주보다 " + pct(-delta(cur, prev)) + " 줄었어요"}</h3>
      <p class="cap">일별 거래액 (요일 맞춤 비교)</p>
      <div class="legend"><span><i style="background:var(--blue)"></i>이번 주</span><span><i style="background:var(--cmp)"></i>지난주</span></div>
      <div class="chart sm"><canvas id="cWeek"></canvas></div>
    </div>`;
  }
  function afterHome() {
    const g = gmvDaily();
    const labels = D.dates.slice(N - 7).map(s => md(s) + " " + "일월화수목금토"[new Date(s).getDay()]);
    chart("cWeek", { type: "line", data: { labels, datasets: [
      { label: "이번 주", data: g.slice(N - 7), borderColor: "#2b5fc4", backgroundColor: "#2b5fc4", borderWidth: 2, pointRadius: 3, tension: .3 },
      { label: "지난주", data: g.slice(N - 14, N - 7), borderColor: "#b9c1d1", backgroundColor: "#b9c1d1", borderWidth: 2, pointRadius: 0, borderDash: [5, 4], tension: .3 }] },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...TT, callbacks: { label: c => `${c.dataset.label}: ${won(c.parsed.y)}` } } }, scales: axes(v => won(v)) } });
    $$(".todo").forEach(el => $(".chk", el).addEventListener("click", () => { const k = el.dataset.k; DONE[k] = !DONE[k]; saveDone(); el.classList.toggle("done"); $(".chk", el).textContent = DONE[k] ? "✓" : ""; }));
  }

  /* =======================================================================
     ② 입점 브랜드 관리
     ======================================================================= */
  let brandSort = "grade", brandQuery = "";
  function vBrands() {
    const list = BSTAT.filter(x => !brandQuery || x.b.name.includes(brandQuery));
    const sorted = [...list].sort((a, b) => brandSort === "grade" ? a.grade.localeCompare(b.grade) || b.score - a.score : brandSort === "gmv" ? b.cur - a.cur : brandSort === "wow" ? a.wow - b.wow : b.ret - a.ret);
    const cnt = g => BSTAT.filter(x => x.grade === g).length;
    return `
    <div class="ph"><h1>입점 브랜드 관리</h1><button class="sq">${I.brand}</button><div class="right"><span class="sample">예시 데이터</span></div></div>
    <p class="desc">브랜드별 거래액·성장·판매율·품절·반품·평점을 한 줄로 보고, 등급과 다음 미팅 제안을 자동으로 정리합니다.</p>
    <div class="grid g4">
      <div class="kpi"><div class="k">담당 브랜드</div><div class="v">${BSTAT.length}개</div><div class="s">A ${cnt("A")} · B ${cnt("B")} · C ${cnt("C")}</div></div>
      <div class="kpi"><div class="k">평균 반품률</div><div class="v">${pct(avgRet)}</div><div class="s">거래액 가중 · 28일</div></div>
      <div class="kpi"><div class="k">평균 판매율</div><div class="v">${pct(BSTAT.reduce((s, x) => s + x.st, 0) / BSTAT.length)}</div><div class="s">판매 ÷ (판매+재고) · 28일</div></div>
      <div class="kpi"><div class="k">W.only 단독 매출 비중</div><div class="v">${pct(BSTAT.reduce((a, x) => a + x.excl * x.cur, 0) / BSTAT.reduce((a, x) => a + x.cur, 0), 0)}</div><div class="s">최근 7일 · C등급 ${cnt("C")}개</div></div>
    </div>
    <div class="sec">ALL BRANDS <span class="hint">행을 누르면 상세·미팅 아젠다</span>
      <span class="more"><span class="seg" id="bsort">${[["grade", "등급순"], ["gmv", "거래액순"], ["wow", "하락순"], ["ret", "반품순"]].map(([k, v]) => `<button data-k="${k}" class="${brandSort === k ? "on" : ""}">${v}</button>`).join("")}</span></span></div>
    ${tableHTML(["브랜드", "등급", "#거래액 7일", "#전주 대비", "#단독 비중", "#판매율", "#품절 SKU", "#반품률", "#평점", "#등록 리드타임", "다음 액션"], sorted.map(x => `
      <tr class="click" data-b="${x.b.id}"><td><div class="nm">${brandIco(x.b)}<div>${esc(x.b.name)}<div class="sub">${x.b.main.join(" · ")} · 수수료 ${pct(x.b.fee, 0)}</div></div></div></td>
      <td><span class="grade ${x.grade}">${x.grade}</span></td><td class="num">${won(x.cur)}</td><td class="num">${dTag(x.wow)}</td><td class="num">${pct(x.excl, 0)}</td>
      <td class="num">${pct(x.st, 0)}</td><td class="num">${pct(x.oos, 0)}</td><td class="num ${x.ret >= avgRet + 0.04 ? "down" : ""}">${pct(x.ret)}</td><td class="num">★ ${x.rating.toFixed(1)}</td><td class="num">${x.b.leadReg}일</td>
      <td>${brandAction(x).map(a => `<span class="tag ${a[0]}">${a[1]}</span>`).join(" ")}</td></tr>`))}
    <p class="note">등급 점수 = 성장(전주 대비) + 판매율 + 평점 − 반품률 − 품절률 (가중치는 가정값, 팀 기준에 맞게 조정)</p>`;
  }
  function brandAction(x) {
    const a = [];
    const top = Object.entries(x.b.retReasons).sort((p, q) => q[1] - p[1])[0][0];
    if (x.ret >= avgRet + 0.04 && top === "사이즈 불만") a.push(["crit", "실측표 보완"]);
    if (x.wow <= -0.15) a.push(["crit", "매출 하락 점검"]);
    if (x.ps.some(p => p.options.some(o => o.sold7 >= 8 && optCoverDays(o) <= 5))) a.push(["warn", "리오더"]);
    if (x.b.leadReg >= 5) a.push(["warn", "등록 지연"]);
    if (x.grade === "A" && x.wow > 0.05) a.push(["opp", "더블유위크 메인 제안"]);
    if (x.excl < 0.1 && x.grade !== "C") a.push(["opp", "단독 컬러 협의"]);
    if (!a.length) a.push(["good", "유지"]);
    return a.slice(0, 2);
  }
  function afterBrands() {
    $$("#bsort button").forEach(b => b.onclick = () => { brandSort = b.dataset.k; render(); });
    $$("tr[data-b]").forEach(tr => tr.onclick = () => openBrand(tr.dataset.b));
  }
  function openBrand(id) {
    const x = BSTAT.find(s => s.b.id === id);
    const top = x.ps.map(p => ({ p, g: sumRange(p.daily, N - 7, N) * netPrice(p) })).sort((a, b) => b.g - a.g);
    const vt = {}; x.voc.forEach(v => vt[v.topic] = (vt[v.topic] || 0) + 1);
    const vtop = Object.entries(vt).filter(e => e[0] !== "만족").sort((a, b) => b[1] - a[1]);
    const risky = x.ps.flatMap(p => p.options.filter(o => o.sold7 >= 4 && optCoverDays(o) <= 10).map(o => ({ p, o })));
    const agenda = [
      `[${x.b.name} 정기 미팅 아젠다] ${todayStr}`,
      `1. 지난주 실적: 거래액 ${won(x.cur)} (전주 대비 ${pct(x.wow)}), 판매율 ${pct(x.st, 0)}, 평점 ${x.rating.toFixed(1)}`,
      risky.length ? `2. 리오더 요청: ${risky.slice(0, 4).map(r => `${r.p.name} ${r.o.color}/${r.o.size}(재고 ${r.o.stock}개, ${Math.floor(optCoverDays(r.o))}일치)`).join(", ")}` : "2. 리오더 요청: 없음",
      `3. 반품 개선: 반품률 ${pct(x.ret)} (담당 평균 ${pct(avgRet)}), 주요 사유 ${Object.entries(x.b.retReasons).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0] + " " + pct(e[1], 0)).join(", ")}`,
      vtop.length ? `4. 고객 VOC: ${vtop.slice(0, 3).map(e => e[0] + " " + e[1] + "건").join(", ")}` : "4. 고객 VOC: 특이사항 없음",
      `5. 기획전 제안: ${D.PROMOS.filter(p => p.status !== "종료" && (p.cats.length === 0 || p.cats.some(c => x.b.main.includes(c)))).map(p => p.name).slice(0, 2).join(", ") || "해당 없음"} 참여 상품·할인 분담 협의`
    ].join("\n");
    drawer(`<h2>${esc(x.b.name)} <span class="grade ${x.grade}" style="vertical-align:4px">${x.grade}</span></h2>
      <p class="cap">${x.b.main.join(" · ")} · 입점 ${x.b.since} · 수수료 ${pct(x.b.fee, 0)} · SKU ${x.skus}개</p>
      <div class="grid g2" style="margin:14px 0">
        <div class="kpi"><div class="k">거래액 7일</div><div class="v">${won(x.cur)}</div><div class="s">${dTag(x.wow)}</div></div>
        <div class="kpi"><div class="k">반품률</div><div class="v">${pct(x.ret)}</div><div class="s">평균 ${pct(avgRet)}</div></div></div>
      <h3 style="font-size:14px">반품 사유</h3>
      ${Object.entries(x.b.retReasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="display:grid;grid-template-columns:90px 1fr 44px;gap:8px;align-items:center;font-size:12.5px;margin:6px 0"><span>${k}</span><div class="bar-in"><i style="width:${v * 100}%"></i></div><span class="num">${pct(v, 0)}</span></div>`).join("")}
      <h3 style="font-size:14px;margin-top:16px">상품별 (최근 7일)</h3>
      ${tableHTML(["상품", "#거래액", "#판매율", "#평점"], top.map(t => `<tr><td>${esc(t.p.name)}<div class="sub">${t.p.cat} · ${won(netPrice(t.p))}</div></td><td class="num">${won(t.g)}</td><td class="num">${pct(sellThrough(t.p), 0)}</td><td class="num">★ ${t.p.rating.toFixed(1)}</td></tr>`))}
      <h3 style="font-size:14px;margin-top:16px">다음 미팅 아젠다 (자동 정리)</h3>
      <pre style="white-space:pre-wrap;background:var(--blue-ll);border-radius:12px;padding:12px;font-size:12.5px;font-family:inherit;margin:0">${esc(agenda)}</pre>
      <button class="btn" style="margin-top:10px" id="cpAgenda">${I.copy} 아젠다 복사</button>`);
    $("#cpAgenda").onclick = () => copy(agenda, "미팅 아젠다를 복사했어요");
  }

  /* =======================================================================
     ③ 소싱
     ======================================================================= */
  function vSourcing() {
    const gaps = CAT_GAP();
    const gapCats = gaps.filter(c => c.gap > 0).map(c => c.cat);
    const cand = D.SOURCING.map(s => {
      const c = gaps.find(x => x.cat === s.cat);
      const fitGap = gapCats.includes(s.cat) ? 30 : 8;
      const fitGrowth = Math.min(25, s.growth * 45);
      const pr = s.priceAvg / c.avgPrice;
      const fitPrice = pr > 0.7 && pr < 1.3 ? 15 : pr > 0.5 && pr < 1.6 ? 8 : 3;
      const fitW = (s.designer ? 10 : 0) + (s.exclusive ? 10 : 0) + Math.round((1 - s.overlap) * 10);
      return { ...s, score: Math.round(fitGap + fitGrowth + fitPrice + fitW), fitW, pr, c };
    }).sort((a, b) => b.score - a.score);
    window.__cand = cand;
    return `
    <div class="ph"><h1>소싱</h1><button class="sq">${I.search}</button><div class="right"><span class="sample">예시 데이터</span></div></div>
    <p class="desc">검색 수요(고객이 찾는 것)와 상품 구성(우리가 가진 것)의 차이로 소싱할 카테고리를 고르고, 후보 브랜드를 적합도 순으로 정리합니다.</p>
    <div class="grid g32">
      <div class="card"><h3>${gaps[0].cat}·${gaps[1].cat}는 찾는 사람에 비해 상품이 부족해요</h3><p class="cap">카테고리별 수요 비중(검색 지수, 가정) vs 상품 비중(SKU 수), %</p>
        <div class="legend"><span><i style="background:var(--blue)"></i>수요 비중</span><span><i style="background:var(--cmp)"></i>상품 비중</span></div>
        <div class="chart"><canvas id="cGap"></canvas></div>
        ${tblToggle("tGap", tableHTML(["카테고리", "#수요 비중", "#상품 비중", "#갭", "#검색 전주 대비"], gaps.map(c => `<tr><td>${c.cat}</td><td class="num">${pct(c.demandShare)}</td><td class="num">${pct(c.supplyShare)}</td><td class="num">${(c.gap * 100).toFixed(1)}%p</td><td class="num">${dTag(c.searchWow)}</td></tr>`)))}
      </div>
      <div class="card"><h3>카테고리 체크</h3><p class="cap">갭이 크고, 판매율도 높으면 소싱 우선</p>
        ${tableHTML(["카테고리", "#갭", "#판매율", "#브랜드"], gaps.slice(0, 6).map(c => `<tr><td>${c.cat}</td><td class="num ${c.gap > 0 ? "up" : ""}">${c.gap > 0 ? "+" : ""}${(c.gap * 100).toFixed(1)}%p</td><td class="num">${pct(c.st, 0)}</td><td class="num">${c.brands}개</td></tr>`))}
      </div>
    </div>
    <div class="sec">SOURCING CANDIDATES <span class="hint">적합도 = 공백 카테고리 30 + 성장률 25 + 가격대 15 + <b>W컨셉 적합도 30</b> (디자이너 브랜드 10 · 단독 협의 가능 10 · 기존 브랜드와 스타일 중복 낮음 10)</span></div>
    ${tableHTML(["후보 브랜드", "카테고리", "#평균가", "#가격대 비교", "#성장률", "W컨셉 적합", "판매 채널", "메모", "#적합도", ""], cand.map((s, i) => `
      <tr><td><div class="nm"><span class="ico" style="background:#8c94a8">${esc(s.name[0])}</span>${esc(s.name)}</div></td><td>${s.cat}${gapCats.includes(s.cat) ? ' <span class="tag opp">공백</span>' : ""}</td>
      <td class="num">${won(s.priceAvg)}</td><td class="num">${s.pr > 1 ? "+" : ""}${((s.pr - 1) * 100).toFixed(0)}%</td><td class="num">+${pct(s.growth, 0)}</td><td>${s.designer ? '<span class="tag opp">디자이너</span> ' : ""}${s.exclusive ? '<span class="tag good">단독 가능</span> ' : ""}${s.overlap >= 0.6 ? '<span class="tag warn">스타일 중복</span>' : ""}${s.designer && s.growth >= 0.3 ? ' <span class="tag ref">뉴컨셉 후보</span>' : ""}</td>
      <td>${esc(s.channel)}</td><td class="sub">${esc(s.note)}</td><td class="num"><b>${s.score}</b></td><td><button class="btn sm ghost" data-mail="${i}">입점 제안 메일</button></td></tr>`))}
    <p class="note">W컨셉은 신진 디자이너 브랜드 발굴(매주 '뉴컨셉' 소개, 육성 프로그램 'W 스테이지')과 단독(W.only)이 핵심이라 이 기준을 점수에 넣었어요. 후보 브랜드·수치는 가상이며, 실제로는 외부 플랫폼 랭킹·SNS 성장·리오더 이력을 같은 점수 체계로 넣습니다.</p>`;
  }
  function afterSourcing() {
    const gaps = CAT_GAP();
    chart("cGap", { type: "bar", data: { labels: gaps.map(c => c.cat), datasets: [
      { label: "수요 비중", data: gaps.map(c => c.demandShare * 100), backgroundColor: "#2b5fc4", borderRadius: 4, barPercentage: .8, categoryPercentage: .6 },
      { label: "상품 비중", data: gaps.map(c => c.supplyShare * 100), backgroundColor: "#b9c1d1", borderRadius: 4, barPercentage: .8, categoryPercentage: .6 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...TT, callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } } }, scales: axes(v => v + "%") } });
    $$("[data-mail]").forEach(b => b.onclick = () => {
      const s = window.__cand[+b.dataset.mail];
      const txt = `제목: [입점 제안] ${s.name} × 패션 플랫폼 ${s.cat} 카테고리 입점 제안드립니다\n\n안녕하세요, ${s.name} 담당자님.\n패션 플랫폼 온라인MD 강현서입니다.\n\n최근 저희 플랫폼에서 ${s.cat} 카테고리 검색이 전주 대비 ${pct(s.c.searchWow, 0)} 늘었지만, 고객이 찾는 만큼 상품이 충분하지 않은 상황입니다.\n${s.name}의 ${s.note.split(",")[0]} 라인업이 이 공백을 채울 수 있다고 판단해 입점을 제안드립니다.\n\n- 예상 수수료율: 협의 (카테고리 평균 ${pct(D.BRANDS.reduce((a, x) => a + x.fee, 0) / D.BRANDS.length, 0)})\n- 첫 노출: 다가오는 '${D.PROMOS.find(p => p.status !== "종료" && (p.cats.length === 0 || p.cats.includes(s.cat))).name}' 기획전 참여 가능\n- 등록 지원: 상품 등록 검수 기준(소재·실측표·썸네일) 가이드 제공\n\n편하신 일정에 20분 정도 온라인 미팅 가능하실까요?\n감사합니다.`;
      drawer(`<h2>입점 제안 메일 초안</h2><p class="cap">${esc(s.name)} · 데이터 근거가 자동으로 들어갑니다. 보내기 전에 MD가 직접 확인·수정하세요.</p><pre style="white-space:pre-wrap;background:var(--blue-ll);border-radius:12px;padding:14px;font-size:13px;font-family:inherit">${esc(txt)}</pre><button class="btn" id="cpMail">${I.copy} 복사</button>`);
      $("#cpMail").onclick = () => copy(txt, "메일 초안을 복사했어요");
    });
  }

  /* =======================================================================
     ④ 상품 등록 검수
     ======================================================================= */
  let regSel = D.REG_QUEUE[0].id; const VISION = {};
  function vRegister() {
    const it = D.REG_QUEUE.find(x => x.id === regSel);
    const res = review(it, VISION[it.id]);
    REG_RESULT[it.id] = res;
    const v = VISION[it.id];
    const cnt = k => Object.values(REG_RESULT).filter(r => r.verdict === k).length;
    return `
    <div class="ph"><h1>상품 등록 검수</h1><button class="sq">${I.upload}</button><div class="right"><span class="sample">예시 데이터</span></div></div>
    <p class="desc">브랜드가 올린 상품 정보를 12개 규칙으로 검수하고, 상품 사진은 MediaPipe로 카테고리·대표 컬러·썸네일 품질을 확인합니다.</p>
    <div class="grid g4">
      <div class="kpi"><div class="k">등록 대기</div><div class="v">${D.REG_QUEUE.length}건</div><div class="s">평균 리드타임 ${(D.BRANDS.reduce((s, b) => s + b.leadReg, 0) / D.BRANDS.length).toFixed(1)}일</div></div>
      <div class="kpi"><div class="k">통과 · 확인</div><div class="v">${cnt("PASS") + cnt("REVIEW")}건</div><div class="s">PASS ${cnt("PASS")} · REVIEW ${cnt("REVIEW")}</div></div>
      <div class="kpi"><div class="k">수정 요청</div><div class="v">${cnt("REVISE")}건</div><div class="s">REVISE</div></div>
      <div class="kpi"><div class="k">등록 불가</div><div class="v">${cnt("BLOCK")}건</div><div class="s">BLOCK</div></div>
    </div>
    <div class="grid g23" style="margin-top:16px">
      <div class="card"><h3>등록 대기 목록</h3><p class="cap">행을 눌러 검수 결과 보기</p>
        ${tableHTML(["상품", "브랜드", "판정"], D.REG_QUEUE.map(x => `<tr class="click ${x.id === regSel ? "sel" : ""}" data-r="${x.id}"><td><b style="font-size:13px">${esc(x.name)}</b><div class="sub">${x.id} · ${x.cat} · ${md(x.submitted)} 접수</div></td><td>${esc(brandOf(x.brand).name)}</td><td><span class="tag ${LV_TAG[REG_RESULT[x.id].verdict]}">${REG_RESULT[x.id].verdict}</span></td></tr>`))}
      </div>
      <div class="card">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">${esc(it.name)}</h3><span class="tag ${LV_TAG[res.verdict]}" style="font-size:13px">${res.verdict}</span></div>
        <p class="cap">${it.id} · ${esc(brandOf(it.brand).name)} · ${won(it.price)}${it.disc ? ` · 할인 ${it.disc}%` : ""}</p>
        <div class="grid g2">
          <div>
            ${[["카테고리", it.cat], ["컬러 옵션", sw(it.color) + it.color], ["소재", it.material || '<span class="down">비어 있음</span>'], ["제조국", it.origin || '<span class="down">비어 있음</span>'], ["세탁·취급", it.care || '<span class="down">비어 있음</span>'], ["실측 사이즈표", it.sizeChart ? "있음" : '<span class="down">없음</span>'], ["썸네일(등록값)", `${it.img.w}×${it.img.h} · ${it.img.ratio}`]].map(f => `<div class="field"><label>${f[0]}</label><div>${f[1]}</div></div>`).join("")}
          </div>
          <div>
            <label class="drop" id="drop"><input type="file" accept="image/*" id="regFile" hidden>${I.upload}<br><b>상품 사진 올려서 AI 검수</b><br><span class="sub">MediaPipe가 카테고리·대표 컬러·상품 비중을 확인해요 (사진은 저장·전송 안 됨)</span></label>
            <div id="vStatus" class="cap" style="margin-top:8px"></div>
            ${v ? `<div class="thumb"><img src="${v.url}" alt="업로드한 상품 사진"><div style="font-size:12.5px;line-height:1.7">
              <b>사진 분석 결과</b>${v.method === "fallback" ? ' <span class="tag warn">AI 모델 미사용</span>' : ""}<br>
              카테고리: <b>${v.category || "판단 어려움"}</b>${v.catLabel ? ` <span class="sub">(${esc(v.catLabel)} ${pct(v.catScore, 0)})</span>` : ""}<br>
              대표 컬러: ${v.palette.slice(0, 3).map(p => `${sw(p.name)}${p.name} ${pct(p.share, 0)}`).join(" · ")}<br>
              ${v.w}×${v.h}px · ${v.ratio} · 상품 비중 ${pct(v.fill, 0)}</div></div>` : ""}
          </div>
        </div>
        <h3 style="font-size:14px;margin-top:14px">걸린 규칙 ${res.hits.length}개</h3>
        ${res.hits.length ? res.hits.map(h => `<div class="rule"><code>${h.code}</code><div><b>${esc(h.name)}</b> — ${esc(h.msg)}<div class="sub">${esc(h.why)}</div></div><span class="tag ${LV_TAG[h.lv]}">${h.lv}</span></div>`).join("") : '<p class="cap">걸린 규칙이 없어요.</p>'}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" id="reqFix" ${res.hits.length ? "" : "disabled"}>${I.copy} 브랜드 수정 요청문 복사</button></div>
        <p class="note">PASS는 규칙에 걸리지 않았다는 뜻이지 최종 승인이 아니에요. 등록 승인은 MD가 직접 확인합니다. (Reboot 컴플라이언스 판정 원칙)</p>
      </div>
    </div>
    <div class="sec">검수 규칙 12개 <span class="hint">PASS → REVIEW(확인) → REVISE(수정 요청) → BLOCK(등록 불가)</span></div>
    ${tableHTML(["코드", "규칙", "판정", "이유"], RULES.map(r => `<tr><td><code>${r.code}</code></td><td><b>${esc(r.name)}</b></td><td><span class="tag ${LV_TAG[r.lv]}">${r.lv}</span></td><td class="sub">${esc(r.why)}</td></tr>`))}`;
  }
  function afterRegister() {
    $$("tr[data-r]").forEach(tr => tr.onclick = () => { regSel = tr.dataset.r; render(); });
    const it = D.REG_QUEUE.find(x => x.id === regSel);
    const f = $("#regFile"), drop = $("#drop");
    const run = async file => {
      if (!file) return;
      $("#vStatus").textContent = "사진 분석 중…";
      try { VISION[it.id] = await window.FMDVision.analyze(file, m => { const s = $("#vStatus"); if (s) s.textContent = m; }); render(); toast("사진 분석을 검수에 반영했어요"); }
      catch (e) { $("#vStatus").textContent = "사진을 읽지 못했어요. 다른 이미지로 시도해 주세요."; }
    };
    f.onchange = () => run(f.files[0]);
    ["dragover", "dragenter"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("on"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("on"); }));
    drop.addEventListener("drop", e => run(e.dataTransfer.files[0]));
    const res = REG_RESULT[it.id];
    const btn = $("#reqFix");
    if (btn) btn.onclick = () => copy(`[상품 등록 보완 요청] ${brandOf(it.brand).name} / ${it.id} ${it.name}\n\n아래 항목 수정 후 다시 등록 부탁드립니다.\n${res.hits.map((h, i) => `${i + 1}. (${h.lv}) ${h.name}: ${h.msg}`).join("\n")}\n\n기획전 노출 일정이 있어 ${md(D.util.dayStr(D.util.addDays(D.TODAY, 2)))}까지 회신 주시면 바로 승인하겠습니다.`, "수정 요청문을 복사했어요");
  }

  /* =======================================================================
     ⑤ 기획전 · 프로모션
     ======================================================================= */
  let simId = "pr1";
  function vPromo() {
    const ps = PROMO_STAT();
    const next = D.PROMOS.find(p => p.id === "pr5");
    const cand = D.PRODUCTS.map(p => {
      const cover = Math.min(...p.options.map(optCoverDays).filter(isFinite).concat([999]));
      const totalCover = prodStock(p) / Math.max(0.1, p.options.reduce((s, o) => s + o.sold7, 0) / 7);
      const st = sellThrough(p);
      let tag, cls;
      if (st >= 0.4 && totalCover >= 14 && p.rating >= 4.3) { tag = "메인 노출 추천"; cls = "good"; }
      else if (st >= 0.4 && totalCover < 14) { tag = "재고 확보 후 참여"; cls = "warn"; }
      else if (st < 0.25 && totalCover >= 40) { tag = "재고 소진용 할인"; cls = "opp"; }
      else return null;
      return { p, st, totalCover, tag, cls, g7: sumRange(p.daily, N - 7, N) * netPrice(p) };
    }).filter(Boolean).sort((a, b) => b.g7 - a.g7).slice(0, 12);
    return `
    <div class="ph"><h1>기획전 · 프로모션</h1><button class="sq">${I.promo}</button><div class="right"><span class="sample">예시 데이터</span></div></div>
    <p class="desc">진행 중 기획전의 목표 대비 페이스를 보고, 다음 기획전 상품을 판매율·재고·평점 규칙으로 고르고, 할인·쿠폰 분담에 따른 수익을 계산합니다.</p>
    <div class="sec">CAMPAIGNS</div>
    ${tableHTML(["기획전", "유형", "기간", "상태", "#목표", "#실적(가정)", "#달성률", "#기간 경과", "페이스", "#할인 / 쿠폰"], ps.map(s => `<tr>
      <td><div class="nm"><span class="ico" style="background:${s.p.status === "진행 중" ? "var(--blue)" : "#b9c1d1"}">${I.promoS}</span><div>${esc(s.p.name)}<div class="sub">${esc(s.p.theme)}</div></div></div></td>
      <td><span class="tag ${s.p.wc === "더블유위크" ? "crit" : s.p.wc === "단독" ? "good" : s.p.wc === "W LIVE" ? "opp" : "ref"}">${esc(s.p.wc || "기획전")}</span></td>
      <td>${md(s.p.start)} ~ ${md(s.p.end)}</td><td><span class="tag ${s.p.status === "진행 중" ? "good" : s.p.status === "종료" ? "ref" : "opp"}">${s.p.status}${s.dday > 0 ? " D-" + s.dday : ""}</span></td>
      <td class="num">${won(s.p.target)}</td><td class="num">${s.actual ? won(s.actual) : "—"}</td>
      <td class="num">${s.actual ? `<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end"><div class="bar-in" style="width:70px"><i style="width:${Math.min(100, s.achv * 100)}%"></i></div>${pct(s.achv, 0)}</div>` : "—"}</td>
      <td class="num">${s.actual ? pct(s.elapsed, 0) : "—"}</td>
      <td>${!s.actual ? "—" : s.p.status === "종료" ? (s.achv >= 1 ? '<span class="tag good">목표 달성</span>' : '<span class="tag crit">미달</span>') : s.pace < -0.08 ? '<span class="tag crit">● 뒤처짐</span>' : '<span class="tag good">✓ 정상</span>'}</td>
      <td class="num">${s.p.disc}% / ${s.p.coupon}%</td></tr>`))}
    <p class="note">실적은 카테고리 거래액 중 기획전 페이지 경유 비중을 55%로 가정했어요. 실제로는 기획전 유입 코드(Reboot의 크리에이터 전용 링크와 같은 방식)로 정확히 집계합니다.</p>

    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>할인·쿠폰 시뮬레이터 — 쿠폰을 더 뿌리면 남는 게 있을까?</h3>
        <p class="cap">브랜드 할인은 브랜드 부담(수수료 기준가가 내려감), 쿠폰은 플랫폼 부담으로 가정</p>
        <div class="field"><label>기획전</label><select id="simSel">${D.PROMOS.filter(p => p.status !== "종료").map(p => `<option value="${p.id}" ${p.id === simId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
        <div class="field"><label>브랜드 할인 <b id="dv"></b></label><input type="range" id="sd" min="0" max="50" step="1"></div>
        <div class="field"><label>플랫폼 쿠폰 <b id="cv"></b></label><input type="range" id="sc" min="0" max="25" step="1"></div>
        <div class="grid g2" style="margin-top:12px" id="simOut"></div>
        <p class="note" id="simMsg"></p>
        <p class="cap" style="margin-top:8px">가정: 기준 거래액 = 목표의 70%, 할인 1%p당 판매량 +2.2%, 쿠폰 1%p당 +3.0%, 평균 수수료율 ${pct(D.BRANDS.reduce((s, b) => s + b.fee, 0) / D.BRANDS.length, 0)}. 과거 기획전 데이터로 교체해 쓰세요.</p>
      </div>
      <div class="card"><h3>쿠폰율별 플랫폼 순수익</h3><p class="cap">현재 브랜드 할인율 기준 · 쿠폰 0~25%</p>
        <div class="chart"><canvas id="cSim"></canvas></div></div>
    </div>

    <div class="sec">'${esc(next.name)}' 상품 후보 <span class="hint">D-${dd(next.start, todayStr)} · 판매율 40%↑ · 재고 14일치↑ · 평점 4.3↑ → 메인 추천</span></div>
    ${tableHTML(["상품", "브랜드", "#판매율 28일", "#재고(일치)", "#평점", "#거래액 7일", "제안"], cand.map(c => `<tr><td><b>${esc(c.p.name)}</b><div class="sub">${c.p.cat} · ${c.p.colors.map(x => sw(x) + x).join(" ")}</div></td><td>${esc(brandOf(c.p.brand).name)}</td><td class="num">${pct(c.st, 0)}</td><td class="num">${isFinite(c.totalCover) ? Math.round(c.totalCover) + "일" : "—"}</td><td class="num">★ ${c.p.rating.toFixed(1)}</td><td class="num">${won(c.g7)}</td><td><span class="tag ${c.cls}">${c.tag}</span>${c.p.excl ? ' <span class="tag good">W.only</span>' : ""}</td></tr>`))}
    ${vPicks()}`;
  }
  function vPicks() {
    const ks = PICK_STAT();
    const tot = ks.reduce((a, k) => a + k.gmv, 0), clicks = ks.reduce((a, k) => a + k.clicks, 0), orders = ks.reduce((a, k) => a + k.orders, 0);
    return `<div class="sec">인플루언서 PICK 성과 <span class="hint">전용 링크 유입 기준 · Reboot 크리에이터 전용 링크 매출 추적 구조 응용</span></div>
    <div class="grid g4">
      <div class="kpi"><div class="k">PICK 협업</div><div class="v">${ks.length}건</div><div class="s">진행 중 · 가상 인플루언서</div></div>
      <div class="kpi"><div class="k">PICK 매출</div><div class="v">${won(tot)}</div><div class="s">링크 유입 주문 기준</div></div>
      <div class="kpi"><div class="k">평균 전환율</div><div class="v">${pct(orders / clicks)}</div><div class="s">주문 ÷ 링크 유입</div></div>
      <div class="kpi"><div class="k">리오더로 연결</div><div class="v">${ks.filter(k => k.reorder).length}건</div><div class="s">PICK 후 차수 리오더</div></div>
    </div>
    <div style="margin-top:12px">${tableHTML(["인플루언서", "브랜드 · 상품", "#팔로워", "#링크 유입", "#주문", "#전환율", "#매출", "#팔로워 1천명당 주문", "판단"], ks.map(k => `<tr>
      <td><b>${esc(k.who)}</b><div class="sub">${md(k.start)} 시작</div></td><td>${esc(brandOf(k.brand).name)}<div class="sub">${esc(k.product)}</div></td>
      <td class="num">${fmt(k.follow / 1000)}K</td><td class="num">${fmt(k.clicks)}</td><td class="num">${fmt(k.orders)}</td><td class="num">${pct(k.cvr)}</td><td class="num">${won(k.gmv)}</td><td class="num">${k.perK.toFixed(1)}</td>
      <td>${k.cvr >= 0.05 ? '<span class="tag good">2차 PICK 제안</span>' : k.cvr < 0.015 ? '<span class="tag crit">노출 조정</span>' : '<span class="tag ref">유지</span>'}${k.reorder ? ' <span class="tag opp">리오더 연결</span>' : ""}</td></tr>`))}</div>
    <p class="note">팔로워가 많다고 잘 팔리는 게 아니에요. '팔로워 1천 명당 주문'으로 보면 작은 인플루언서의 구매 전환이 더 높을 수 있어요. 다음 더블유위크 PICK 섭외는 이 지표로 우선순위를 정합니다.</p>`;
  }
  function simCalc(p, d, c) {
    const fee = D.BRANDS.reduce((s, b) => s + b.fee, 0) / D.BRANDS.length;
    const base = p.target * 0.7, d0 = p.disc, c0 = p.coupon;
    const vol = Math.max(0, 1 + 0.022 * (d - d0) + 0.03 * (c - c0));
    const listGmv = base / (1 - d0 / 100) * vol;          // 정가 기준
    const gmv = listGmv * (1 - d / 100);                    // 브랜드 할인 후 판매가 기준 거래액
    const commission = gmv * fee, couponCost = gmv * c / 100;
    return { gmv, commission, couponCost, profit: commission - couponCost, paid: gmv - couponCost };
  }
  function afterPromo() {
    const sel = $("#simSel"), sd = $("#sd"), sc = $("#sc");
    const setP = () => { const p = D.PROMOS.find(x => x.id === sel.value); sd.value = p.disc; sc.value = p.coupon; upd(); };
    const upd = () => {
      const p = D.PROMOS.find(x => x.id === sel.value), d = +sd.value, c = +sc.value; simId = p.id;
      $("#dv").textContent = d + "%"; $("#cv").textContent = c + "%";
      const r = simCalc(p, d, c), r0 = simCalc(p, p.disc, p.coupon);
      $("#simOut").innerHTML = [["예상 거래액", r.gmv, r0.gmv], ["수수료 수익", r.commission, r0.commission], ["쿠폰 비용", r.couponCost, r0.couponCost], ["플랫폼 순수익", r.profit, r0.profit]].map(([k, v, v0]) => `<div class="kpi"><div class="k">${k}</div><div class="v" style="font-size:20px">${won(v)}</div><div class="s">${v === v0 ? "현재 설정" : (k === "쿠폰 비용" ? dTag(delta(v, v0), true) : dTag(delta(v, v0))) + " 현재 대비"}</div></div>`).join("");
      let best = 0, bp = -1e18; for (let x = 0; x <= 25; x++) { const pr = simCalc(p, d, x).profit; if (pr > bp) { bp = pr; best = x; } }
      $("#simMsg").innerHTML = `이 가정에서는 쿠폰 <b>${best}%</b>일 때 플랫폼 순수익이 가장 커요 (${won(bp)}). 거래액 목표 ${won(p.target)} 대비 ${pct(r.gmv / p.target, 0)}.`;
      chart("cSim", { type: "line", data: { labels: Array.from({ length: 26 }, (_, i) => i + "%"), datasets: [{ label: "순수익", data: Array.from({ length: 26 }, (_, i) => simCalc(p, d, i).profit), borderColor: "#2b5fc4", borderWidth: 2, tension: .25, pointRadius: Array.from({ length: 26 }, (_, i) => i === c ? 6 : 0), pointBackgroundColor: "#2b5fc4", pointBorderColor: "#fff", pointBorderWidth: 2 }] },
        options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...TT, callbacks: { title: x => "쿠폰 " + x[0].label, label: x => `순수익 ${won(x.parsed.y)} · 거래액 ${won(simCalc(p, d, x.dataIndex).gmv)}` } } }, scales: axes(v => won(v), { y: { beginAtZero: false }, x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } } }) } });
    };
    sel.onchange = setP; sd.oninput = upd; sc.oninput = upd; setP();
  }

  /* =======================================================================
     ⑥ 매출 분석
     ======================================================================= */
  let period = 7, salesBrand = "all";
  function vSales() {
    const f = salesBrand === "all" ? null : p => p.brand === salesBrand;
    const g = gmvDaily(f), q = qtyDaily(f);
    const cur = sumRange(g, N - period, N), prev = sumRange(g, N - 2 * period, N - period);
    const qc = sumRange(q, N - period, N), qp = sumRange(q, N - 2 * period, N - period);
    const prods = D.PRODUCTS.filter(p => !f || f(p));
    const opts = prods.flatMap(p => p.options.map(o => ({ p, o })));
    const lostSales = opts.filter(x => x.o.stock === 0).reduce((s, x) => s + (x.o.sold28 / 28) * 7 * netPrice(x.p), 0);
    const risky = opts.filter(x => x.o.stock > 0 && x.o.sold7 >= 3 && optCoverDays(x.o) <= 10).sort((a, b) => optCoverDays(a.o) - optCoverDays(b.o)).slice(0, 10);
    const cats = Object.keys(D.CATEGORIES).map(c => { const gg = gmvDaily(p => p.cat === c && (!f || f(p))); return { c, cur: sumRange(gg, N - period, N), prev: sumRange(gg, N - 2 * period, N - period) }; }).filter(x => x.cur > 0).sort((a, b) => b.cur - a.cur);
    // 사이즈 커브: 판매 비중 vs 재고 비중 (S/M/L 카테고리)
    const sizeCats = ["아우터", "니트", "상의", "팬츠"].map(c => {
      const os = opts.filter(x => x.p.cat === c);
      const S = ["S", "M", "L"].map(s => { const so = os.filter(x => x.o.size === s); return { s, sold: so.reduce((a, x) => a + x.o.sold28, 0), stock: so.reduce((a, x) => a + x.o.stock, 0) }; });
      const ts = S.reduce((a, x) => a + x.sold, 0) || 1, tk = S.reduce((a, x) => a + x.stock, 0) || 1;
      return { c, S: S.map(x => ({ ...x, ss: x.sold / ts, ks: x.stock / tk })) };
    }).filter(x => x.S.some(s => s.sold));
    return `
    <div class="ph"><h1>매출 분석</h1><button class="sq">${I.sales}</button>
      <div class="right"><select id="sb"><option value="all">전체 브랜드</option>${D.BRANDS.map(b => `<option value="${b.id}" ${salesBrand === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
      <span class="seg" id="per">${[7, 14, 28].map(n => `<button data-n="${n}" class="${period === n ? "on" : ""}">${n}일</button>`).join("")}</span><span class="sample">예시 데이터</span></div></div>
    <p class="desc">기간 비교(Reboot 성과분석 방식), 카테고리·상품·옵션 단위로 내려가며 품절 위험과 사이즈 재고 불균형을 찾습니다.</p>
    <div class="grid g4">
      <div class="kpi"><div class="k">거래액 (${period}일)</div><div class="v">${won(cur)}</div><div class="s">${dTag(delta(cur, prev))} 직전 ${period}일 대비</div></div>
      <div class="kpi"><div class="k">판매 수량</div><div class="v">${fmt(qc)}개</div><div class="s">${dTag(delta(qc, qp))}</div></div>
      <div class="kpi"><div class="k">평균 판매가</div><div class="v">${won(cur / (qc || 1))}</div><div class="s">${dTag(delta(cur / (qc || 1), prev / (qp || 1)))}</div></div>
      <div class="kpi"><div class="k">품절 기회손실 (주간)</div><div class="v">${won(lostSales)}</div><div class="s">품절 SKU × 최근 판매 속도</div></div>
    </div>
    <div class="grid g32" style="margin-top:16px">
      <div class="card"><h3>최근 ${period}일 vs 직전 ${period}일 거래액</h3><p class="cap">일별 · 같은 순번의 날끼리 비교</p>
        <div class="legend"><span><i style="background:var(--blue)"></i>최근 ${period}일</span><span><i style="background:var(--cmp)"></i>직전 ${period}일</span></div>
        <div class="chart"><canvas id="cTrend"></canvas></div>
        ${tblToggle("tTrend", tableHTML(["날짜", "#거래액", "#직전 기간 같은 순번"], D.dates.slice(N - period).map((s, i) => `<tr><td>${md(s)}</td><td class="num">${won(g[N - period + i])}</td><td class="num">${won(g[N - 2 * period + i])}</td></tr>`)))}</div>
      <div class="card"><h3>${cats[0] ? cats[0].c + "가 거래액 1위" : "카테고리"}</h3><p class="cap">카테고리별 거래액 · 직전 기간 대비</p>
        ${tableHTML(["카테고리", "#거래액", "비중", "#증감"], cats.map(x => `<tr><td>${x.c}</td><td class="num">${won(x.cur)}</td><td><div class="bar-in"><i style="width:${x.cur / cats[0].cur * 100}%"></i></div></td><td class="num">${dTag(delta(x.cur, x.prev))}</td></tr>`))}</div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>품절 위험 옵션 TOP ${risky.length}</h3><p class="cap">재고 ÷ 최근 7일 하루 평균 판매 = 남은 일수 (10일 이하)</p>
        ${risky.length ? tableHTML(["상품 · 옵션", "#재고", "#7일 판매", "#남은 일수"], risky.map(x => `<tr><td><b style="font-size:12.5px">${esc(x.p.name)}</b><div class="sub">${esc(brandOf(x.p.brand).name)} · ${sw(x.o.color)}${x.o.color} / ${x.o.size}</div></td><td class="num">${x.o.stock}</td><td class="num">${x.o.sold7}</td><td class="num"><span class="tag ${optCoverDays(x.o) <= 5 ? "crit" : "warn"}">${optCoverDays(x.o) < 1 ? "1일 미만" : Math.floor(optCoverDays(x.o)) + "일"}</span></td></tr>`)) : '<p class="cap">위험 옵션이 없어요.</p>'}</div>
      <div class="card"><h3>사이즈 재고가 판매와 맞지 않는 곳</h3><p class="cap">사이즈별 판매 비중 vs 재고 비중 (28일) · 차이 8%p 이상 강조 → 다음 리오더 사이즈 비율에 반영</p>
        ${tableHTML(["카테고리", "S 판매/재고", "M 판매/재고", "L 판매/재고"], sizeCats.map(x => `<tr><td>${x.c}</td>${x.S.map(s => { const gap = s.ss - s.ks; return `<td class="${Math.abs(gap) >= 0.08 ? (gap > 0 ? "down" : "up") : ""}">${pct(s.ss, 0)} / ${pct(s.ks, 0)}${Math.abs(gap) >= 0.08 ? (gap > 0 ? " ▲부족" : " ▼과다") : ""}</td>`; }).join("")}</tr>`))}</div>
    </div>
    <div class="sec">TOP PRODUCTS <span class="hint">최근 ${period}일 거래액 순</span></div>
    ${tableHTML(["상품", "브랜드", "#거래액", "#판매량", "#판매율 28일", "#평점", "옵션 재고"], prods.map(p => ({ p, g: sumRange(p.daily, N - period, N) * netPrice(p), q: sumRange(p.daily, N - period, N) })).sort((a, b) => b.g - a.g).slice(0, 10).map(x => `
      <tr><td><b>${esc(x.p.name)}</b>${x.p.excl ? ' <span class="tag good">W.only</span>' : ""}<div class="sub">${x.p.cat} · ${won(netPrice(x.p))}${x.p.disc ? ` (${x.p.disc}%↓)` : ""}</div></td><td>${esc(brandOf(x.p.brand).name)}</td><td class="num">${won(x.g)}</td><td class="num">${fmt(x.q)}</td><td class="num">${pct(sellThrough(x.p), 0)}</td><td class="num">★ ${x.p.rating.toFixed(1)}</td>
      <td>${x.p.options.filter(o => o.stock === 0 || optCoverDays(o) <= 7).length ? `<span class="tag ${x.p.options.some(o => o.stock === 0) ? "crit" : "warn"}">${x.p.options.filter(o => o.stock === 0).length ? "품절 " + x.p.options.filter(o => o.stock === 0).length : "임박 " + x.p.options.filter(o => optCoverDays(o) <= 7).length}개 옵션</span>` : '<span class="tag good">충분</span>'}</td></tr>`))}`;
  }
  function afterSales() {
    $("#sb").onchange = e => { salesBrand = e.target.value; render(); };
    $$("#per button").forEach(b => b.onclick = () => { period = +b.dataset.n; render(); });
    const f = salesBrand === "all" ? null : p => p.brand === salesBrand;
    const g = gmvDaily(f);
    chart("cTrend", { type: "line", data: { labels: D.dates.slice(N - period).map(md), datasets: [
      { label: "최근", data: g.slice(N - period), borderColor: "#2b5fc4", backgroundColor: "#2b5fc4", borderWidth: 2, pointRadius: period > 14 ? 0 : 3, tension: .3 },
      { label: "직전", data: g.slice(N - 2 * period, N - period), borderColor: "#b9c1d1", borderWidth: 2, borderDash: [5, 4], pointRadius: 0, tension: .3 }] },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...TT, callbacks: { label: c => `${c.dataset.label}: ${won(c.parsed.y)}` } } }, scales: axes(v => won(v), { x: { ticks: { maxTicksLimit: 10 } } }) } });
  }

  /* =======================================================================
     ⑦ 고객 VOC
     ======================================================================= */
  let vocTopic = "전체", vocBrand = "all";
  function vVoc() {
    const T = ["사이즈", "재입고", "색상", "소재·품질", "배송", "만족"];
    const all = D.VOC;
    const tcount = Object.fromEntries(T.map(t => [t, all.filter(v => v.topic === t).length]));
    const neg = all.filter(v => v.topic !== "만족");
    const maxCell = Math.max(...D.BRANDS.flatMap(b => T.slice(0, 5).map(t => all.filter(v => v.brand === b.id && v.topic === t).length)));
    const list = all.filter(v => (vocTopic === "전체" || v.topic === vocTopic) && (vocBrand === "all" || v.brand === vocBrand)).slice(0, 14);
    const ACTION = { "사이즈": "실측 사이즈표·모델 착용 정보 보완 요청", "재입고": "리오더 + 재입고 알림 발송", "색상": "자연광 실물컷·컬러 설명 추가 요청", "소재·품질": "혼용률·세탁 안내 보완, 불량 시 QC 요청", "배송": "출고 리드타임 점검, 예약배송 안내 문구" };
    const brandIssues = D.BRANDS.map(b => { const vs = neg.filter(v => v.brand === b.id); const c = {}; vs.forEach(v => c[v.topic] = (c[v.topic] || 0) + 1); const top = Object.entries(c).sort((a, b2) => b2[1] - a[1])[0]; return { b, n: vs.length, top, share: top ? top[1] / vs.length : 0 }; }).filter(x => x.top && x.top[1] >= 4).sort((a, b) => b.top[1] - a.top[1]).slice(0, 5);
    const heat = n => { const t = n / (maxCell || 1); const c = ["#ffffff", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf"][Math.min(5, Math.ceil(t * 5))]; return `background:${n ? c : "#fff"};color:${t > 0.6 ? "#fff" : "inherit"}`; };
    return `
    <div class="ph"><h1>고객 VOC</h1><button class="sq">${I.voc}</button><div class="right"><span class="sample">예시 데이터</span></div></div>
    <p class="desc">리뷰·문의를 키워드 규칙으로 주제별로 나누고(Reboot 챗봇 질문 분석 방식), 브랜드별 이슈를 MD 액션으로 바꿉니다.</p>
    <div class="grid g4">
      <div class="kpi"><div class="k">리뷰·문의 (28일)</div><div class="v">${all.length}건</div><div class="s">리뷰 ${all.filter(v => v.kind === "리뷰").length} · 문의 ${all.filter(v => v.kind === "문의").length}</div></div>
      <div class="kpi"><div class="k">불만·문의 비중</div><div class="v">${pct(neg.length / all.length, 0)}</div><div class="s">만족 외 주제</div></div>
      <div class="kpi"><div class="k">사이즈 관련</div><div class="v">${pct(tcount["사이즈"] / (neg.length || 1), 0)}</div><div class="s">불만·문의 중 1위 주제</div></div>
      <div class="kpi"><div class="k">재입고 문의</div><div class="v">${tcount["재입고"]}건</div><div class="s">리오더 수요 신호</div></div>
    </div>
    <div class="grid g32" style="margin-top:16px">
      <div class="card"><h3>브랜드 × 주제 — 어디에 어떤 문제가 몰려 있나</h3><p class="cap">건수 · 진할수록 많음</p>
        ${tableHTML(["브랜드", ...T.slice(0, 5).map(t => "#" + t)], D.BRANDS.map(b => `<tr><td>${esc(b.name)}</td>${T.slice(0, 5).map(t => { const n = all.filter(v => v.brand === b.id && v.topic === t).length; return `<td class="num" style="${heat(n)}">${n || ""}</td>`; }).join("")}</tr>`), "heat")}</div>
      <div class="card"><h3>이번 주 브랜드 요청 사항</h3><p class="cap">주제 4건 이상 몰린 브랜드 → 자동 액션</p>
        ${brandIssues.map(x => `<div class="todo"><span class="tag ${x.top[0] === "재입고" ? "opp" : "crit"}">${x.top[0]}</span><div><b>${esc(x.b.name)}</b><div class="why">${x.top[1]}건 (불만·문의의 ${pct(x.share, 0)}) → ${ACTION[x.top[0]]}</div></div><span></span></div>`).join("")}
        <h3 style="font-size:14px;margin-top:14px">주제별 건수</h3>
        ${T.map(t => `<div style="display:grid;grid-template-columns:72px 1fr 34px;gap:8px;align-items:center;font-size:12.5px;margin:5px 0"><span>${t}</span><div class="bar-in"><i style="width:${tcount[t] / Math.max(...Object.values(tcount)) * 100}%;${t === "만족" ? "background:var(--cmp)" : ""}"></i></div><span class="num">${tcount[t]}</span></div>`).join("")}</div>
    </div>
    <div class="sec">RECENT <span class="more"><select id="vt">${["전체", ...T].map(t => `<option ${t === vocTopic ? "selected" : ""}>${t}</option>`).join("")}</select> <select id="vb"><option value="all">전체 브랜드</option>${D.BRANDS.map(b => `<option value="${b.id}" ${vocBrand === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></span></div>
    ${tableHTML(["내용", "주제", "브랜드 · 상품", "유형", "날짜"], list.map(v => `<tr><td>${"★".repeat(v.rating)}<span style="color:#d5d9e2">${"★".repeat(5 - v.rating)}</span> ${esc(v.text)}</td><td><span class="tag ${v.topic === "만족" ? "good" : v.topic === "재입고" ? "opp" : "ref"}">${v.topic}</span></td><td>${esc(brandOf(v.brand).name)}<div class="sub">${esc(prodOf(v.product).name)}</div></td><td>${v.kind}</td><td>${md(v.date)}</td></tr>`))}
    <p class="note">주제 분류는 키워드 규칙이라 설명이 가능하고 바로 고칠 수 있어요. 문장 요약이 필요하면 AI를 붙이되, 판단(주제·건수)은 규칙이 합니다.</p>`;
  }
  function afterVoc() { $("#vt").onchange = e => { vocTopic = e.target.value; render(); }; $("#vb").onchange = e => { vocBrand = e.target.value; render(); }; }

  /* =======================================================================
     ⑧ 프로젝트 소개 (포트폴리오)
     ======================================================================= */
  function vAbout() {
    return `
    <div class="ph"><h1>프로젝트 소개</h1><button class="sq">${I.info}</button></div>
    <p class="desc">강현서 · 온라인MD 지원 포트폴리오 · 1인 기획·제작 · 2026.11</p>
    <div class="card story" style="background:var(--blue);color:#fff;border:none">
      <div style="font-size:11px;letter-spacing:.12em;color:#c9d8f7;font-weight:700">한 줄 요약</div>
      <h2 style="margin:8px 0 6px;font-size:22px;letter-spacing:-.02em">마케팅 대시보드를 만든 경험을, 입점 브랜드를 관리하는 패션 온라인MD의 하루로 옮겼습니다</h2>
      <p style="margin:0;color:#dbe6fb">브랜드 운영 · 소싱/등록 · 기획전 · 매출 분석 — 공고의 주요업무 4가지를 메뉴로 1:1 구현 · W컨셉 실제 베스트·기획전 데이터에서 읽은 더블유위크 · W.only 단독 · 인플루언서 PICK을 운영 화면에 반영</p>
    </div>
    <div class="grid g3 story" style="margin-top:16px">
      <div class="card"><div class="cap">문제 정의</div><h3>MD의 판단 근거가 여러 화면에 흩어져 있다</h3><ul><li>인턴 때 행사 상품 가격·할인·실적을 엑셀 여러 장으로 관리</li><li>품절·반품·리뷰를 따로 봐야 해서 브랜드에 줄 피드백이 늦어짐</li><li>상품 등록 누락(소재·실측표)이 반품으로 이어짐</li></ul></div>
      <div class="card"><div class="cap">해결</div><h3>규칙이 먼저 판단하고, 근거를 보여준다</h3><ul><li>10개 규칙으로 '이번 주 할 일'을 긴급·기회·참고로 정렬</li><li>12개 규칙 + MediaPipe 사진 분석으로 상품 등록 검수</li><li>미팅 아젠다·입점 제안·수정 요청문 자동 정리</li></ul></div>
      <div class="card"><div class="cap">기대 효과 (가정)</div><div class="bigno">주 5시간 → 1시간</div><p class="cap">브랜드별 실적·재고·VOC 취합 시간 (엑셀 수작업 대비, 가정)</p><div class="bigno" style="font-size:22px">반품 사유 '사이즈' ↓</div><p class="cap">실측표 없는 상품 등록 차단(F04)</p></div>
    </div>
    <div class="card story" style="margin-top:16px"><h3>Reboot 마케팅 대시보드(6인 팀 프로젝트, 1위)에서 가져온 것</h3>
      ${tableHTML(["Reboot에서 배운 구조", "이 대시보드에 적용"], [
        ["홈 데일리 브리핑 · To-Do (AI/규칙, 근거 표시)", "오늘의 브리핑 · 규칙 9개로 '이번 주 할 일' + 근거"],
        ["시즌 캘린더 · 준비 시작일", "기획전 캘린더 · 준비 시작일(오픈 − 준비 기간)"],
        ["인사이트 주간 리뷰: '판단은 규칙, AI는 문장만'", "모든 판정을 규칙으로, 문장(아젠다·메일)은 템플릿으로 — 설명 가능한 판단"],
        ["컴플라이언스 PASS·REVIEW·REVISE·BLOCK", "상품 등록 검수 판정 체계 (소재·실측표·과장 표현·상표 연상)"],
        ["챗봇 질문 주제 분류(키워드 규칙)", "리뷰·문의 VOC 주제 분류 → 브랜드 요청 사항"],
        ["성과분석 기간 비교 · KPI", "매출 분석 기간 비교 · 품절 기회손실 · 사이즈 커브"],
        ["크리에이터 전용 링크 매출 추적", "인플루언서 PICK 성과 (링크 유입 · 전환율 · 팔로워 1천 명당 주문 · 리오더 연결)"]
      ].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`), "map")}
      <p class="cap" style="margin-top:8px">※ 팀 프로젝트에서 본인이 맡은 파트는 별도로 표기하세요.</p></div>
    <div class="grid g2 story" style="margin-top:16px">
      <div class="card" style="background:#eef4fc;border:none"><h3>🤖 AI가 한 일</h3><ul><li><b>MediaPipe Image Classifier</b>: 상품 사진 → 카테고리 후보</li><li>사진 픽셀 군집 → 대표 컬러 · 상품 비중 계산</li><li><b>Claude</b>: 화면·차트 코드 작성 보조</li></ul></div>
      <div class="card" style="background:#f6f2ea;border:none"><h3>🙋 내가 한 일</h3><ul><li>공고 주요업무 → 메뉴 구조 설계</li><li>할 일 규칙 9개 · 등록 검수 규칙 12개 기준 정의</li><li>KPI 정의: 판매율, 품절 기회손실, 사이즈 커브, 플랫폼 순수익</li><li>할인(브랜드 부담) · 쿠폰(플랫폼 부담) 수익 구조 설계</li></ul></div>
    </div>
    <p class="note">'W컨셉 베스트 분석' 메뉴는 W컨셉 공개 베스트 화면을 1회 읽은 실제 데이터(2026-11-11 기준)이고, 나머지 메뉴의 브랜드·상품·수치는 시연용 가상 데이터입니다. 실제 브랜드에 가상 지표를 붙이지 않았습니다.</p>`;
  }

  /* =======================================================================
     ⑨ W컨셉 베스트 분석 (실제 공개 데이터 스냅샷)
     ======================================================================= */
  const M = window.WC_MARKET;
  if (M) M.brands.forEach(x => x.items = x.items.map(i => i.length === 10 ? [...i.slice(0, 8), i[9]] : i));
  const L = M && M.day2 ? M.day2 : M;
  function brandInsights(x) {
    const it = x.items, t = [];
    const avgDisc = it.reduce((s, i) => s + i[4], 0) / it.length;
    const excl = it.filter(i => i[8]).length / it.length;
    const rev = it.reduce((s, i) => s + (i[7] || 0), 0);
    if (it.every(i => !i[4])) t.push(["good", "정가 판매력"]);
    if (excl >= 0.8) t.push(["opp", "W 단독 강점"]);
    if (Object.keys(x.cats).length >= 2) t.push(["opp", "카테고리 확장형"]);
    if (avgDisc >= 50) t.push(["warn", "고할인 의존"]);
    if (it.some(i => /리퍼브/.test(i[2]))) t.push(["ref", "리퍼브·재고 소진"]);
    if (rev < 60 && x.n >= 3) t.push(["warn", "리뷰 확보 필요"]);
    return { tags: t.slice(0, 3), avgDisc, excl, rev, rating: (() => { const r = it.filter(i => i[6]); return r.length ? r.reduce((s, i) => s + i[6], 0) / r.length : null; })(), best: Math.min(...it.map(i => i[1])) };
  }
  const EV_TYPES = ["더블유위크", "24시간 특가", "W LIVE", "단독", "인플루언서·셀럽 큐레이션", "테마·브랜드 기획전"];
  function evType(e) {
    const t = e.join(" ");
    if (e[0].startsWith("바라던 24시간")) return "24시간 특가";
    if (e[0].startsWith("W라이브")) return "W LIVE";
    if (t.includes("더블유위크")) return "더블유위크";
    if (t.includes("단독") || t.includes("오직 이곳에만")) return "단독";
    if (/(선택한|고른|입는|소개하는|처럼|픽|인플루언서)/.test(t)) return "인플루언서·셀럽 큐레이션";
    return "테마·브랜드 기획전";
  }
  const evParse = b => { const m = (b || "").match(/~\s*(\d+)%/), c = (b || "").match(/(?:\+\s*|^|\s)(\d+)%\s*(?:쿠폰)?$/) || (b || "").match(/(\d+)%\s*쿠폰/); return { max: m ? +m[1] : null, coupon: c ? +c[1] : null }; };
  let evFilter = "전체";
  function vEvents() {
    const E = (M.events || []).filter(e => e.some(Boolean)).map(e => ({ e, type: evType(e), ...evParse(e[3]) }));
    if (!E.length) return "";
    const cnt = Object.fromEntries(EV_TYPES.map(t => [t, E.filter(x => x.type === t).length]));
    const c30 = E.filter(x => x.coupon === 30).length;
    const disc = E.filter(x => x.max != null); const avgMax = disc.reduce((a, x) => a + x.max, 0) / (disc.length || 1);
    const list = E.filter(x => evFilter === "전체" || x.type === evFilter);
    const TC = { "더블유위크": "crit", "24시간 특가": "warn", "W LIVE": "opp", "단독": "good", "인플루언서·셀럽 큐레이션": "opp", "테마·브랜드 기획전": "ref" };
    return `<div class="sec">지금 진행 중인 W컨셉 기획전 <span class="tag good">실제</span> <span class="hint">${esc(M.eventsMeta.source)} · ${esc(M.eventsMeta.at)} 기준 ${E.length}개</span></div>
    <div class="grid g32">
      <div class="card"><h3>메인 기획전 ${E.length}개 중 ${c30}개가 '30% 쿠폰'을 걸고 있어요</h3><p class="cap">배너 문구를 규칙으로 분류 (24시간 · W라이브 · 더블유위크 · 단독 · 인플루언서 이름 포함 여부)</p>
        <div class="seg" id="evf" style="margin-bottom:10px;flex-wrap:wrap">${["전체", ...EV_TYPES].map(t => `<button class="${evFilter === t ? "on" : ""}" data-t="${t}">${t}${t === "전체" ? "" : " " + cnt[t]}</button>`).join("")}</div>
        <div style="max-height:360px;overflow:auto">${tableHTML(["유형", "기획전 문구", "브랜드 · 대상", "혜택"], list.map(x => `<tr><td><span class="tag ${TC[x.type]}">${x.type}</span></td><td>${esc([x.e[0], x.e[1]].filter(Boolean).join(" "))}</td><td>${esc(x.e[2])}</td><td class="num">${esc(x.e[3] || "—")}</td></tr>`))}</div>
      </div>
      <div class="card"><h3>W컨셉 기획전의 공식</h3><p class="cap">실제 배너에서 읽은 운영 패턴 → 내 대시보드에 반영한 것</p>
        ${EV_TYPES.map(t => `<div style="display:grid;grid-template-columns:150px 1fr 30px;gap:8px;align-items:center;font-size:12.5px;margin:6px 0"><span>${t}</span><div class="bar-in"><i style="width:${cnt[t] / Math.max(...Object.values(cnt)) * 100}%"></i></div><span class="num">${cnt[t]}</span></div>`).join("")}
        <div class="todo"><span class="tag crit">행사</span><div><b>더블유위크가 메인을 덮고 있음</b><div class="why">→ 기획전 메뉴 1순위를 '더블유위크'로, 목표 페이스를 매일 확인</div></div><span></span></div>
        <div class="todo"><span class="tag warn">혜택</span><div><b>쿠폰 30% + 브랜드 할인 '~N%'가 기본 공식 (평균 최대 할인 ${avgMax.toFixed(0)}%)</b><div class="why">→ 할인(브랜드 부담)·쿠폰(플랫폼 부담) 시뮬레이터로 순수익 확인</div></div><span></span></div>
        <div class="todo"><span class="tag opp">큐레이션</span><div><b>'○○가 고른·입는' 인플루언서·셀럽 큐레이션 ${cnt["인플루언서·셀럽 큐레이션"]}개</b><div class="why">→ 인플루언서 PICK 성과 표로 재협업 우선순위 결정</div></div><span></span></div>
        <div class="todo"><span class="tag good">단독</span><div><b>'단독·오직 이곳에만' 기획 + 베스트 의류 ${L.cats["의류"].excl}%가 단독</b><div class="why">→ 브랜드 관리에 단독 매출 비중, 리오더 규칙에서 단독 우선</div></div><span></span></div>
      </div>
    </div>`;
  }
  function vCompare() {
    if (!M.day2) return "";
    const d1 = M.brands, d2 = M.day2.scores;
    const names = [...new Set([...d1.map(x => x.b), ...M.day2.brands.map(x => x.b)])];
    const mv = names.map(b => { const a = d1.find(x => x.b === b), r1 = d1.findIndex(x => x.b === b), r2 = d2.findIndex(x => x[0] === b); const s2 = r2 >= 0 ? d2[r2][1] : 0; return { b, s1: a ? a.score : null, s2, r1, r2, diff: s2 - (a ? a.score : 0) }; }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    const up = mv.filter(x => x.diff > 0).slice(0, 5), down = mv.filter(x => x.diff < 0).slice(0, 5), newIn = M.day2.brands.filter(x => !d1.some(y => y.b === x.b)).map(x => x.b);
    const C = M.day2.cats, C1 = M.cats, cats = Object.keys(C);
    const top = up[0], tb = M.day2.brands.find(x => x.b === top.b);
    const row = x => `<tr><td><b>${esc(x.b)}</b></td><td class="num">${x.r1 >= 0 ? x.r1 + 1 + "위" : "20위 밖"}</td><td class="num">${x.r2 >= 0 ? x.r2 + 1 + "위" : "60위 밖"}</td><td class="num">${x.s1 ?? "—"} → ${x.r2 >= 0 ? x.s2 : "—"}</td><td class="num ${x.diff >= 0 ? "up" : "down"}">${x.r2 < 0 ? "순위권 이탈" : (x.diff >= 0 ? "+" : "") + x.diff}</td></tr>`;
    return `<div class="sec">어제 vs 오늘 <span class="tag good">실제</span> <span class="hint">${esc(M.meta.at)} → ${esc(M.day2.at)} · 같은 화면 · 같은 계산</span></div>
    <div class="card" style="background:var(--blue);color:#fff;border:none;margin-bottom:16px"><div style="font-size:11px;letter-spacing:.1em;color:#c9d8f7;font-weight:700">오늘의 발견</div>
      <h3 style="color:#fff;font-size:18px;margin:6px 0">${esc(top.b)} 점수 ${top.s1 ?? 0} → ${top.s2} · 베스트 진입 ${tb ? tb.n : "?"}개 ${tb && tb.note ? "— " + esc(tb.note) : ""}</h3>
      <p style="margin:0;color:#dbe6fb;font-size:13px">메인 노출 + 24시간 특가 하루 만에 가방 베스트를 거의 채웠어요. → 메인 노출과 24H 특가가 순위를 움직이는 가장 강한 레버. 담당 브랜드의 24H 슬롯 신청 · 재고 확보를 기획전 준비 체크리스트에 넣어야 해요.</p></div>
    <div class="grid g3">
      <div class="card"><h3>많이 오른 브랜드</h3><p class="cap">베스트 점수 변화</p>${tableHTML(["브랜드", "#어제", "#오늘", "#점수", "#변화"], up.map(row))}</div>
      <div class="card"><h3>많이 내린 브랜드</h3><p class="cap">특가 종료 · 노출 축소 신호</p>${tableHTML(["브랜드", "#어제", "#오늘", "#점수", "#변화"], down.map(row))}</div>
      <div class="card"><h3>카테고리 변화</h3><p class="cap">TOP100 기준 · 오늘 (어제 대비)</p>
        ${tableHTML(["카테고리", "#평균 할인", "#단독", "#더블유위크", "#리오더", "#PICK"], cats.map(c => { const d = (k, f = 0) => { const v = C[c][k] - C1[c][k]; return `${f ? C[c][k].toFixed(1) : C[c][k]} <span class="sub">(${v >= 0 ? "+" : ""}${f ? v.toFixed(1) : v})</span>`; }; return `<tr><td>${c}</td><td class="num">${d("avgDisc", 1)}</td><td class="num">${d("excl")}</td><td class="num">${d("wweek")}</td><td class="num">${d("reorder")}</td><td class="num">${d("pick")}</td></tr>`; }))}
        <p class="cap" style="margin-top:8px">TOP20 새로 진입: ${newIn.map(esc).join(", ") || "없음"}</p></div>
    </div>`;
  }
  function vNewEx() {
    const X = M.exclusive, NA = M.newArrivals;
    if (!X || !NA) return "";
    const todayTop = (L.brands || []).map(x => x.b);
    const hotCnt = {}; NA.hot.forEach(h => hotCnt[h[1]] = (hotCnt[h[1]] || 0) + 1);
    const hotRank = Object.entries(hotCnt).sort((a, b) => b[1] - a[1]);
    const chip = (b, on) => `<span class="tag ${on ? "good" : "ref"}" style="margin:2px">${esc(b)}${on ? " · 베스트 TOP20" : ""}</span>`;
    return `<div class="sec">단독 · 신상 <span class="tag good">실제</span> <span class="hint">W컨셉 단독 · 신상 페이지 · 2026-11-12 12:20 기준</span></div>
    <div class="grid g2">
      <div class="card"><h3>단독 브랜드 10개 중 ${X.brands.filter(b => todayTop.includes(b)).length}개가 오늘 베스트 TOP20</h3><p class="cap">단독 페이지 '특별한 W컨셉 단독 브랜드' · 초록 = 베스트 상위 20 동시 진입</p>
        <div>${X.brands.map(b => chip(b, todayTop.includes(b))).join("")}</div>
        <h3 style="font-size:14px;margin-top:14px">단독 프로모션 (상단 배너)</h3>
        ${tableHTML(["브랜드", "내용"], X.promos.map(p => `<tr><td><b>${esc(p[0])}</b></td><td>${esc(p[1])}</td></tr>`))}
        <p class="note">단독 = 쿠폰 + 시즌 선발매 + 인플루언서 이름. 대시보드 'W.only 단독전' 준비 체크리스트에 그대로 반영했어요.</p></div>
      <div class="card"><h3>인기 신상 ${NA.hot.length}개 중 ${hotRank[0][1]}개가 ${esc(hotRank[0][0])}</h3><p class="cap">'지금 인기있는 신상품' 브랜드별 개수 · 단독 ${NA.hot.filter(h => h[5]).length}개</p>
        ${hotRank.slice(0, 6).map(([b, n]) => `<div style="display:grid;grid-template-columns:110px 1fr 24px;gap:8px;align-items:center;font-size:12.5px;margin:5px 0"><span>${esc(b)}</span><div class="bar-in"><i style="width:${n / hotRank[0][1] * 100}%"></i></div><span class="num">${n}</span></div>`).join("")}
        <h3 style="font-size:14px;margin-top:14px">새로 입점한 브랜드</h3><div>${NA.newBrands.map(b => `<span class="tag opp" style="margin:2px">${esc(b)}</span>`).join("")}</div>
        <h3 style="font-size:14px;margin-top:12px">윈터 컬렉션을 연 브랜드</h3><div>${NA.collections.map(b => `<span class="tag ref" style="margin:2px">${esc(b)}</span>`).join("")}</div>
        <p class="note">마그넷 아카이브: 메인 기획전 배너 → 신상 인기 상위 → 하루 만에 베스트 TOP20 진입(6위). 신규·신상 브랜드는 '메인 노출 → 신상 랭킹 → 베스트' 경로로 크는지 매일 추적할 가치가 있어요.</p></div>
    </div>`;
  }
  function vMarket() {
    if (!M) return '<p class="cap">시장 데이터 파일(assets/market.js)이 없어요.</p>';
    const C = L.cats, C1 = M.cats, cats = Object.keys(C);
    const maxBand = Math.max(...cats.flatMap(c => C[c].bands));
    const rows = L.brands.map((x, i) => ({ x, i, s: brandInsights(x), prev: M.brands.findIndex(y => y.b === x.b) }));
    const ins = [
      ["opp", `의류 베스트 100개 중 ${C["의류"].excl}개가 '단독', ${C["의류"].wweek}개가 더블유위크 행사 상품`, "행사·단독 기획이 베스트 진입의 핵심 → 담당 브랜드와 단독 컬러·리오더 물량을 먼저 협의"],
      ["good", `가방은 평균 할인 ${C["가방"].avgDisc}%로 가장 낮고, 할인 없이 진입한 상품 ${C["가방"].noDisc}개`, `10~20만 원대가 ${C["가방"].bands[2]}% → 할인보다 신상·컬러 확장으로 노출 확보`],
      ["opp", `신발 중위 판매가 ${won(C["신발"].median)}, 5~10만 원대 ${C["신발"].bands[1]}%`, "부츠·로퍼·플랫이 상위 키워드 → 시즌 전환(부츠) 기획전 상품 구성 근거"],
      ["warn", `액세서리는 5만 원 미만 ${C["액세서리"].bands[0]}%, 브랜드 ${C["액세서리"].brands}개로 분산`, "객단가가 낮음 → 머플러·귀걸이 선물 묶음, 아우터 기획전 연계 추천으로 객단가 보완"],
      ["opp", `의류 상품명 키워드 상위: ${C1["의류"].kw.slice(0, 4).map(k => k[0]).join(" · ")}`, "'윈터 아우터 기획전' 방향(코트·캐시미어·핸드메이드)과 일치 → 기획전 메인 상품군 확인"]
    ];
    return `
    <div class="ph"><h1>W컨셉 베스트 · 기획전</h1><button class="sq">${I.sales}</button><div class="right"><span class="tag good">실제 공개 데이터</span><span class="cap" style="margin:0;color:var(--muted)">베스트 ${esc(L.at || M.meta.at)} 기준 (비교: ${esc(M.meta.at)}) · ${esc(M.meta.scope)}</span></div></div>
    <p class="desc">W컨셉 베스트 화면을 한 번 읽어 와서, 카테고리별 가격대·할인·단독 비중과 상위 20개 브랜드를 정리했습니다. 내부 지표(재고·반품·등급)는 이 데이터와 섞지 않았어요.</p>
    <div class="grid g4">${cats.map(c => `<div class="kpi"><div class="k">${c} TOP100</div><div class="v">${C[c].brands}<small style="font-size:13px"> 브랜드</small></div>
      <div class="s">평균 할인 ${C[c].avgDisc}% (${C[c].avgDisc - C1[c].avgDisc >= 0 ? "+" : ""}${(C[c].avgDisc - C1[c].avgDisc).toFixed(1)}%p) · 단독 ${C[c].excl}% (${C[c].excl - C1[c].excl >= 0 ? "+" : ""}${C[c].excl - C1[c].excl}) · 중위가 ${won(C[c].median)}</div></div>`).join("")}</div>
    ${vCompare()}

    <div class="grid g32" style="margin-top:16px">
      <div class="card"><h3>카테고리마다 팔리는 가격대가 다르다</h3><p class="cap">베스트 100개 상품의 판매가 구간별 개수 · 진할수록 많음</p>
        ${tableHTML(["카테고리", ...M.bandLabels.map(b => "#" + b), "#할인 없음", "#오늘출발"], cats.map(c => `<tr><td><b>${c}</b></td>${C[c].bands.map(v => { const t = v / maxBand; const bg = ["#ffffff", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf"][Math.min(5, Math.ceil(t * 5))]; return `<td class="num" style="background:${v ? bg : "#fff"};color:${t > 0.6 ? "#fff" : "inherit"};font-weight:600">${v}</td>`; }).join("")}<td class="num">${C[c].noDisc}</td><td class="num">${C[c].today}</td></tr>`), "heat")}
        <div class="sec" style="margin:18px 0 8px">상품명 키워드 <span class="hint">TOP100 상품명에 포함된 건수 (한글 기준 · ${esc(M.meta.at)})</span></div>
        ${cats.map(c => `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0;font-size:12.5px"><b style="width:64px">${c}</b>${C1[c].kw.map(k => `<span class="tag ref">${k[0]} ${k[1]}</span>`).join("")}</div>`).join("")}
      </div>
      <div class="card"><h3>MD 인사이트</h3><p class="cap">수치에서 바로 읽히는 것 → 할 일</p>
        ${ins.map(x => `<div class="todo"><span class="tag ${x[0]}">${x[0] === "warn" ? "주의" : x[0] === "good" ? "강점" : "기회"}</span><div><b>${esc(x[1])}</b><div class="why">${esc(x[2])}</div></div><span></span></div>`).join("")}
      </div>
    </div>

    ${vEvents()}
    ${vNewEx()}
    <div class="sec">TOP 20 BRANDS <span class="hint">점수 = 카테고리별 TOP100 안에서 Σ(101 − 순위) · 행을 누르면 진입 상품</span></div>
    ${tableHTML(["#", "#어제", "브랜드", "카테고리", "#베스트 진입", "#점수", "#최고 순위", "#평균 할인", "#평균 평점", "#리뷰 합", "#단독 비중", "특징"], rows.map(({ x, i, s }) => `
      <tr class="click" data-m="${i}"><td class="num">${i + 1}</td><td class="num">${rows[i].prev >= 0 ? (rows[i].prev === i ? "–" : (rows[i].prev > i ? `<span class="up">▲${rows[i].prev - i}</span>` : `<span class="down">▼${i - rows[i].prev}</span>`)) : '<span class="tag opp">NEW</span>'}</td><td><div class="nm"><span class="ico" style="background:${["#2b5fc4", "#e07a36", "#1f9d74", "#c99a00", "#d4628d"][i % 5]}">${esc(x.b[0])}</span>${esc(x.b)}</div></td>
      <td>${Object.entries(x.cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(" · ")}</td><td class="num">${x.n}개</td>
      <td class="num"><div style="display:flex;gap:8px;align-items:center;justify-content:flex-end"><div class="bar-in" style="width:70px"><i style="width:${x.score / L.brands[0].score * 100}%"></i></div>${x.score}</div></td>
      <td class="num">${s.best}위</td><td class="num">${s.avgDisc.toFixed(0)}%</td><td class="num">${s.rating ? "★ " + s.rating.toFixed(1) : "—"}</td><td class="num">${fmt(s.rev)}</td><td class="num">${pct(s.excl, 0)}</td>
      <td>${s.tags.map(t => `<span class="tag ${t[0]}">${t[1]}</span>`).join(" ")}</td></tr>`))}
    <p class="note">출처: <a href="${M.meta.url}">${esc(M.meta.source)}</a> · ${esc(M.meta.at)} 화면 기준 1회 수집. W컨셉 robots.txt는 일반 크롤러를 허용하지 않아 자동 반복 수집은 넣지 않았어요. 업데이트는 같은 화면을 다시 열어 읽거나, 사내 데이터(API)로 바꿔 씁니다. 상품 이미지는 저장하지 않았습니다.</p>`;
  }
  function afterMarket() {
    $$("#evf button").forEach(b => b.onclick = () => { evFilter = b.dataset.t; render(); });
    $$("tr[data-m]").forEach(tr => tr.onclick = () => {
      const x = L.brands[+tr.dataset.m], s = brandInsights(x);
      drawer(`<h2>${esc(x.b)}</h2><p class="cap">W컨셉 베스트 진입 ${x.n}개 · 점수 ${x.score} · 최고 ${s.best}위 · ${esc(L.at || M.meta.at)} 기준${x.note ? " · " + esc(x.note) : ""}</p>
        <div style="margin:8px 0 14px">${s.tags.map(t => `<span class="tag ${t[0]}">${t[1]}</span>`).join(" ")}</div>
        ${tableHTML(["순위", "상품", "#판매가", "#할인", "#평점(리뷰)"], x.items.map(i => `<tr><td>${i[0]} ${i[1]}위</td><td>${esc(i[2])}${i[8] ? ' <span class="tag opp">단독</span>' : ""}</td><td class="num">${won(i[5])}</td><td class="num">${i[4] ? i[4] + "%" : "—"}</td><td class="num">${i[6] ? "★ " + i[6] + " (" + fmt(i[7]) + ")" : "—"}</td></tr>`))}
        <h3 style="font-size:14px;margin-top:16px">MD가 볼 포인트</h3>
        <ul style="font-size:13px;color:var(--ink-2);padding-left:18px">
          ${s.excl >= 0.8 ? "<li>진입 상품 대부분이 단독 → 단독 컬러·리오더 일정이 매출을 좌우</li>" : ""}
          ${x.items.every(i => !i[4]) ? "<li>할인 없이 베스트 진입 → 할인 대신 신상·노출 위치로 협업</li>" : `<li>평균 할인 ${s.avgDisc.toFixed(0)}% → 다음 기획전 할인 분담 협의 기준</li>`}
          ${s.rev < 60 ? "<li>리뷰가 적음 → 첫 구매 리뷰 이벤트로 신뢰 확보</li>" : `<li>리뷰 ${fmt(s.rev)}개 누적 → 리뷰 많은 상품을 기획전 메인에</li>`}
          ${Object.keys(x.cats).length >= 2 ? "<li>여러 카테고리 진입 → 교차 추천·브랜드관 기획 후보</li>" : `<li>${Object.keys(x.cats)[0]} 단일 카테고리 → 같은 카테고리 기획전에 우선 배치</li>`}
        </ul>`);
    });
  }

  /* ---------------- 드로어 ---------------- */
  function drawer(html) {
    closeDrawer();
    const bg = document.createElement("div"); bg.className = "drawer-bg"; bg.onclick = closeDrawer;
    const d = document.createElement("aside"); d.className = "drawer"; d.innerHTML = `<button class="x" aria-label="닫기">✕</button>` + html;
    $(".x", d).onclick = closeDrawer;
    document.body.append(bg, d);
  }
  function closeDrawer() { $$(".drawer,.drawer-bg").forEach(e => e.remove()); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

  /* ---------------- 아이콘 ---------------- */
  const sv = p => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const I = {
    home: sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    brand: sv('<path d="M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/>'),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    upload: sv('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
    promo: sv('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
    promoS: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/></svg>',
    sales: sv('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>'),
    voc: sv('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
    info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    help: sv('<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    refresh: sv('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>'
  };

  /* ---------------- 셸 · 라우터 ---------------- */
  const VIEWS = {
    home: ["오늘의 브리핑", I.home, vHome, afterHome],
    brands: ["입점 브랜드 관리", I.brand, vBrands, afterBrands],
    market: ["W컨셉 베스트 · 기획전", I.sales, vMarket, afterMarket],
    sourcing: ["소싱", I.search, vSourcing, afterSourcing],
    register: ["상품 등록 검수", I.upload, vRegister, afterRegister],
    promo: ["기획전 · 프로모션", I.promo, vPromo, afterPromo],
    sales: ["매출 분석", I.sales, vSales, afterSales],
    voc: ["고객 VOC", I.voc, vVoc, () => afterVoc()],
    about: ["프로젝트 소개", I.info, vAbout, () => { }]
  };
  const GROUPS = [["MAIN", ["home"]], ["주요업무", ["brands", "sourcing", "register", "promo", "sales"]], ["시장", ["market"]], ["고객 · 기타", ["voc", "about"]]];

  function shell() {
    const g = gmvDaily();
    const month = D.dates.map((s, i) => s.startsWith("2026-11") ? g[i] : 0).reduce((a, b) => a + b, 0);
    const mTarget = 980000000, dayOfMonth = 12;
    const live = PROMO_STAT().filter(s => s.p.status === "진행 중");
    const urgent = TODOS.filter(t => t.g === "긴급").length;
    document.getElementById("app").innerHTML = `
    <aside class="side">
      <div class="logo"><svg width="30" height="30" viewBox="0 0 32 32"><path d="M4 26 11 6h4l-7 20z" fill="#2b5fc4"/><path d="M12 26 19 6h4l-7 20z" fill="#5f8de0"/><path d="M20 26l5-14h3l-5 14z" fill="#9db9ee"/></svg><div>Fashion MD<small>온라인MD 워크스페이스</small></div></div>
      <div class="side-panel">
        <button class="side-cta" onclick="location.hash='register'">+ 상품 등록 검수</button>
        <nav class="nav">${GROUPS.map(([gname, ids]) => `<div class="sep">${gname}</div>` + ids.map(id => `<a href="#${id}" data-v="${id}">${VIEWS[id][1]}<span>${VIEWS[id][0]}</span>${id === "home" && urgent ? `<span class="cnt">${urgent}</span>` : id === "register" ? `<span class="cnt">${Object.values(REG_RESULT).filter(r => r.verdict === "REVISE" || r.verdict === "BLOCK").length}</span>` : ""}</a>`).join("")).join("")}</nav>
        <div class="goals"><h4>GOAL DETAILS</h4>
          <div class="goal"><div class="t"><span>11월 거래액 목표</span><b>${pct(month / mTarget, 0)}</b></div><div class="bar"><i style="width:${Math.min(100, month / mTarget * 100)}%"></i></div><div class="s">${won(month)} / ${won(mTarget)} · 월 경과 ${pct(dayOfMonth / 30, 0)}</div></div>
          ${live.slice(0, 1).map(s => `<div class="goal"><div class="t"><span>${esc(s.p.name)}</span><b>${pct(s.achv, 0)}</b></div><div class="bar"><i style="width:${Math.min(100, s.achv * 100)}%"></i></div><div class="s">${won(s.actual)} / ${won(s.p.target)}</div></div>`).join("")}
        </div>
        <div class="side-foot">예시 데이터 · 포트폴리오용 프로토타입</div>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <div class="search">${I.search}<input id="q" placeholder="브랜드 · 상품 · SKU 검색" autocomplete="off"><div class="search-results" id="qr" hidden></div></div>
        <div class="icons">
          <button class="ibtn" title="긴급 알림" onclick="location.hash='home'">${I.bell}${urgent ? `<span class="dot">${urgent}</span>` : ""}</button>
          <button class="ibtn" title="프로젝트 소개" onclick="location.hash='about'">${I.help}</button>
          <button class="ibtn" title="규칙 보기" onclick="location.hash='register'">${I.gear}</button>
          <div class="user"><div>강현서<small>패션 온라인MD</small></div><span class="avatar">강</span></div>
        </div>
      </header>
      <section class="content" id="view"></section>
    </div>`;
    const q = $("#q"), qr = $("#qr");
    q.addEventListener("input", () => {
      const s = q.value.trim();
      if (!s) { qr.hidden = true; return; }
      const bs = D.BRANDS.filter(b => b.name.includes(s)).slice(0, 4).map(b => `<button data-b="${b.id}"><span class="k">브랜드</span>${esc(b.name)}</button>`);
      const ps = D.PRODUCTS.filter(p => p.name.includes(s) || p.id.includes(s.toUpperCase()) || p.cat === s).slice(0, 6).map(p => `<button data-b="${p.brand}"><span class="k">상품</span>${esc(p.name)} <span class="sub">${esc(brandOf(p.brand).name)} · ${p.id}</span></button>`);
      qr.innerHTML = [...bs, ...ps].join("") || '<div class="cap" style="padding:8px">결과 없음</div>'; qr.hidden = false;
      $$("button", qr).forEach(b => b.onclick = () => { qr.hidden = true; q.value = ""; location.hash = "brands"; setTimeout(() => openBrand(b.dataset.b), 60); });
    });
    document.addEventListener("click", e => { if (!e.target.closest(".search")) qr.hidden = true; });
  }
  function current() { const h = (location.hash || "").slice(1); return VIEWS[h] ? h : "home"; }
  function render() {
    const id = current();
    $$(".nav a").forEach(a => a.classList.toggle("on", a.dataset.v === id));
    const v = $("#view"); v.innerHTML = VIEWS[id][2](); VIEWS[id][3]();
    document.title = VIEWS[id][0] + " · Fashion MD Workspace";
  }
  window.addEventListener("hashchange", () => { closeDrawer(); render(); $("#view").scrollTop = 0; window.scrollTo(0, 0); });
  shell(); render();
})();
