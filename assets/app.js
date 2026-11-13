/* =========================================================================
   Fashion MD Workspace — 패션 온라인MD 하루 업무 순서대로
   09:00 아침 체크 → 기획전 운영 → 브랜드 모니터링 → 상품·VOC → 소싱·육성 → 등록 검수 → 주간 리포트
   데이터 원칙: 실제 수집(W컨셉 공개 화면) · 무료 API(Open-Meteo, Nager.Date) · 계산기(입력값)만 사용.
   판매·재고·반품 같은 내부 데이터는 만들어 넣지 않고 '입사 후 연결' 자리로 둡니다.
   ========================================================================= */
(function () {
  "use strict";
  const M = window.WC_MARKET, S = window.FMD_SNAP;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => Math.round(n).toLocaleString("ko-KR");
  const won = n => { const a = Math.abs(n); if (a >= 1e8) return (n / 1e8).toFixed(2) + "억"; if (a >= 1e4) return fmt(n / 1e4) + "만"; return fmt(n) + "원"; };
  const pct = (n, d = 0) => (n * 100).toFixed(d) + "%";
  const md = s => { const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const wd = s => "일월화수목금토"[new Date(s).getDay()];
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const NOW = new Date(); const TODAY = ymd(NOW);
  const dd = (a, b) => Math.round((new Date(a) - new Date(b)) / 864e5);
  const addD = (s, n) => { const d = new Date(s); d.setDate(d.getDate() + n); return ymd(d); };
  const toast = m => { const t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); };
  const copy = async (txt, m) => { try { await navigator.clipboard.writeText(txt); toast(m || "복사했어요"); } catch (e) { toast("복사 권한이 없어요. 내용을 직접 선택해 복사해 주세요"); } };
  const SRC = { real: ["real", "W컨셉 실제"], api: ["api", "무료 API"], calc: ["calc", "계산 · 입력값"], live: ["live", "실시간"] };
  const src = (k, extra) => `<span class="src ${SRC[k][0]}">${SRC[k][1]}${extra ? " · " + esc(extra) : ""}</span>`;
  const table = (head, rows, cls = "") => `<div class="wrap"><table class="tbl ${cls}"><tr>${head.map(h => `<th class="${h.startsWith("#") ? "num" : ""}">${h.replace(/^#/, "")}</th>`).join("")}</tr>${rows.join("")}</table></div>`;
  let store = {}; try { store = JSON.parse(localStorage.getItem("fmd2") || "{}"); } catch (e) { }
  const save = () => { try { localStorage.setItem("fmd2", JSON.stringify(store)); } catch (e) { } };

  /* ---------------- 스냅샷 정리 ---------------- */
  M.brands.forEach(x => x.items = x.items.map(i => i.length === 10 ? [...i.slice(0, 8), i[9]] : i));
  const SNAP = [
    { key: "d1", at: M.meta.at, cats: M.cats, top: M.brands, scores: M.brands.map(x => [x.b, x.score, x.n]) },
    { key: "d2", at: M.day2.at, cats: M.day2.cats, top: M.day2.brands, scores: M.day2.scores },
    { key: "d3", at: M.day3.at, cats: M.day3.cats, top: M.day3.brands, scores: M.day3.scores }
  ];
  const L = SNAP[2], P = SNAP[1];
  const CATS = ["의류", "가방", "신발", "액세서리"];
  const scoreOf = (snap, b) => { const r = snap.scores.findIndex(x => x[0] === b); return r < 0 ? null : { rank: r + 1, score: snap.scores[r][1], n: snap.scores[r][2] }; };
  const EVENTS = (M.events || []).filter(e => e.some(Boolean));
  const inBanner = b => EVENTS.some(e => (e[2] || "").includes(b));
  const exclBrands = (M.exclusive && M.exclusive.brands) || [];
  const hotNew = {}; ((M.newArrivals && M.newArrivals.hot) || []).forEach(h => hotNew[h[1]] = (hotNew[h[1]] || 0) + 1);
  const PRODUCTS = M.products || [];

  /* ---------------- 무료 API (실시간 → 실패 시 스냅샷) ---------------- */
  const API = { weather: S.weather, holidays: S.holidays, live: { weather: false, holidays: false }, at: S.fetchedAt };
  async function loadLive() {
    try {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Asia%2FSeoul&forecast_days=14");
      if (r.ok) { const j = await r.json(); if (j.daily) { API.weather = { daily: j.daily }; API.live.weather = true; } }
    } catch (e) { }
    try {
      const y = NOW.getFullYear(), out = [];
      for (const yr of [y, y + 1]) { const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${yr}/KR`); if (r.ok) (await r.json()).forEach(h => out.push({ date: h.date, name: h.localName })); }
      if (out.length) { API.holidays = out; API.live.holidays = true; }
    } catch (e) { }
    if (API.live.weather || API.live.holidays) { TODOS = buildTodos(); render(); }
  }
  const wxSrc = () => API.live.weather ? src("live", "Open-Meteo") : src("api", "Open-Meteo · " + API.at + " 스냅샷");
  const hoSrc = () => API.live.holidays ? src("live", "Nager.Date") : src("api", "Nager.Date · 스냅샷");
  function wxDays() { const d = API.weather.daily; return d.time.map((t, i) => ({ date: t, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_probability_max[i], code: d.weather_code[i] })).filter(x => x.date >= TODAY); }
  const WX_ICON = c => c === 0 ? "☀︎" : c <= 3 ? "☁︎" : c <= 67 || (c >= 80 && c <= 82) ? "☂︎" : c <= 86 ? "❄︎" : "☁︎";

  /* ---------------- VOC 판단 ---------------- */
  function vocAction(p) {
    const a = [];
    if (p.size && p.size["큼"] >= 30) a.push(["urg", p.cat === "가방" ? `크기가 '크다' ${p.size["큼"]}% → 실측·착용컷 추가 요청` : `'크게 나옴' ${p.size["큼"]}% → 상세페이지에 '한 치수 작게' 안내 요청`]);
    if (p.size && p.size["작음"] >= 15) a.push(["urg", p.cat === "가방" ? `크기가 '작다' ${p.size["작음"]}% → 수납 예시컷 추가 요청` : `'작게 나옴' ${p.size["작음"]}% → '반 치수 크게' 안내 요청`]);
    if (p.color && p.color["다름"] >= 5) a.push(["opp", `색상 '다름' ${p.color["다름"]}% → 자연광 실물컷 추가 요청`]);
    if (/상세페이지 참조/.test(p.material + p.origin)) a.push(["opp", "상품정보고시가 '상세페이지 참조' → 소재·제조국 직접 기재 요청"]);
    return a;
  }
  const revDelta = p => { const r = p.reviews; const f = r.find(v => v != null), l = r[r.length - 1]; return f != null && l != null ? { d: l - f, rate: f ? (l - f) / f : 0 } : null; };

  /* ---------------- 오늘 할 일 (규칙 → 근거) ---------------- */
  const RULE_TXT = {
    W1: "14일 예보 중 최저기온 0℃ 이하 첫날 → 7일 이내면 긴급, 그 외 기회",
    W2: "7일 안에 하루 최고기온이 6℃ 이상 떨어지는 날 → 기회",
    W3: "7일 안에 강수확률 80% 이상인 날 → 참고",
    B1: "베스트 점수가 하루 새 +300 이상 오르거나 TOP20 새로 진입 → 기회(원인 확인 · 재고 확인)",
    B2: "어제 TOP20 브랜드 점수가 40% 이상 하락 · 순위권 이탈 → 참고",
    V1: "구매 리뷰 사이즈 '큼' 30% 이상 또는 '작음' 15% 이상 → 긴급(상세 안내 요청)",
    V2: "상품정보고시 소재·제조국이 '상세페이지 참조' → 참고(직접 기재 요청)",
    R1: "3일 사이 리뷰 수 증가율 5% 이상 → 기회(판매 신호 · 재고 확인)",
    H1: "공휴일·시즌 D-35 이내 → 기획전 준비 착수(준비 시작 = D-28)",
    E1: "메인 기획전 중 24시간 특가 배너가 10개 이상 → 기회(24H 슬롯 신청 검토)"
  };
  function buildTodos() {
    const T = [], days = wxDays(), d7 = days.slice(0, 7);
    const cold = days.find(x => x.min <= 0);
    if (cold) { const n = dd(cold.date, TODAY), coldest = days.reduce((a, b) => b.min < a.min ? b : a); T.push({ g: n <= 7 ? "긴급" : "기회", r: "W1", s: "api", title: `영하 시작 전 아우터 · 부츠 · 머플러 메인 구좌와 재고 확인`, why: `${md(cold.date)}(${wd(cold.date)}) 최저 ${cold.min}℃ 첫 영하 · ${md(coldest.date)} ${coldest.min}℃까지 · D-${n}`, go: "#brands", w: 100 - n }); }
    let drop = null; for (let i = 1; i < d7.length; i++) { const v = d7[i - 1].max - d7[i].max; if (v >= 6 && (!drop || v > drop.v)) drop = { v, a: d7[i - 1], b: d7[i] }; }
    if (drop) T.push({ g: "기회", r: "W2", s: "api", title: `기온 급락일 전 '보온 아이템' 기획전 배너 교체`, why: `${md(drop.a.date)} 최고 ${drop.a.max}℃ → ${md(drop.b.date)} ${drop.b.max}℃ (${drop.v.toFixed(1)}℃ 하락)`, go: "#promo", w: 70 });
    const rainy = d7.filter(x => x.rain >= 80);
    if (rainy.length) T.push({ g: "참고", r: "W3", s: "api", title: `우천일 배송 지연 공지 · 실내 코디 콘텐츠 점검`, why: `강수확률 80% 이상: ${rainy.map(x => `${md(x.date)}(${x.rain}%)`).join(", ")}`, go: "#promo", w: 20 });
    // 베스트 변동 (어제 → 오늘)
    L.top.forEach(x => { const p = scoreOf(P, x.b); const diff = x.score - (p ? p.score : 0); if (diff >= 300 || !P.top.some(y => y.b === x.b)) T.push({ g: "기회", r: "B1", s: "real", title: `${x.b} 급상승 원인 확인 · 재고 소진 대비 리오더 체크`, why: `베스트 점수 ${p ? p.score : "60위 밖"} → ${x.score} · 진입 ${x.n}개${inBanner(x.b) ? " · 메인 기획전 배너 노출 중" : ""}`, go: "#brands", w: 60 + diff / 50 }); });
    P.top.forEach(x => { const c = scoreOf(L, x.b); if (!c || c.score <= x.score * 0.6) T.push({ g: "참고", r: "B2", s: "real", title: `${x.b} 노출 종료 · 품절 여부 확인`, why: `베스트 점수 ${x.score} → ${c ? c.score : "60위 밖"}`, go: "#brands", w: 30 + x.score / 100 }); });
    PRODUCTS.forEach(p => { const a = vocAction(p).filter(x => x[0] === "urg"); if (a.length) T.push({ g: "긴급", r: "V1", s: "real", title: `${p.brand} '${p.name}' 사이즈 안내 보완 요청`, why: `구매 리뷰 ${fmt(p.cnt)}개 · ${a.map(x => x[1].split(" → ")[0]).join(" · ")}`, go: "#voc", w: 80 + (p.size ? Math.max(p.size["큼"], p.size["작음"]) : 0) }); });
    const ref = PRODUCTS.filter(p => /상세페이지 참조/.test(p.material + p.origin));
    if (ref.length) T.push({ g: "참고", r: "V2", s: "real", title: `상품정보고시 직접 기재 요청 (${[...new Set(ref.map(p => p.brand))].join(", ")})`, why: `${ref.map(p => p.name).join(", ")} — 소재·제조국 '상세페이지 참조'`, go: "#register", w: 25 });
    PRODUCTS.map(p => ({ p, r: revDelta(p) })).filter(x => x.r && x.r.rate >= 0.05).sort((a, b) => b.r.rate - a.r.rate).slice(0, 2).forEach(x => T.push({ g: "기회", r: "R1", s: "real", title: `${x.p.brand} '${x.p.name}' 판매 신호 → 재고 · 리오더 확인`, why: `리뷰 수 ${fmt(x.p.reviews.find(v => v != null))} → ${fmt(x.p.reviews[2])} (+${pct(x.r.rate, 1)}, 11/11→11/13)`, go: "#voc", w: 55 + x.r.rate * 100 }));
    const nextH = (API.holidays || []).filter(h => h.date > TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0];
    if (nextH && dd(nextH.date, TODAY) <= 60) { const n = dd(nextH.date, TODAY); T.push({ g: n <= 35 ? "기회" : "참고", r: "H1", s: "api", title: `${nextH.name} 시즌 기획전 준비 일정 잡기`, why: `${md(nextH.date)}(${wd(nextH.date)}) D-${n} · 준비 시작 ${md(addD(nextH.date, -28))}`, go: "#promo", w: 45 }); }
    const h24 = EVENTS.filter(e => e[0].startsWith("바라던 24시간")).length;
    if (h24 >= 10) T.push({ g: "기회", r: "E1", s: "real", title: `담당 브랜드 24시간 특가 슬롯 신청 검토`, why: `메인 기획전 ${EVENTS.length}개 중 24H 특가 ${h24}개 · 24H 노출 브랜드(아뜰리에 드 루멘) 하루 새 베스트 진입 27개`, go: "#promo", w: 50 });
    const order = { "긴급": 0, "기회": 1, "참고": 2 }, cap = { B1: 3, B2: 2, V1: 3 }, used = {};
    return T.sort((a, b) => order[a.g] - order[b.g] || b.w - a.w).filter(t => { used[t.r] = (used[t.r] || 0) + 1; return used[t.r] <= (cap[t.r] || 2); });
  }
  let TODOS = buildTodos();
  const GT = { "긴급": "urg", "기회": "opp", "참고": "ref" };

  /* ---------------- 차트 ---------------- */
  const charts = {};
  function chart(id, cfg) { const el = document.getElementById(id); if (!el) return; if (!window.Chart) { el.parentElement.innerHTML = '<p class="cap">차트를 불러오지 못했어요.</p>'; return; } if (charts[id]) charts[id].destroy(); charts[id] = new Chart(el, cfg); }
  if (window.Chart) { Chart.defaults.font.family = '"Noto Sans KR",system-ui,sans-serif'; Chart.defaults.font.size = 11.5; Chart.defaults.color = "#4a4a4a"; }
  const TT = { backgroundColor: "#151515", padding: 10, cornerRadius: 10, boxPadding: 4 };

  /* =======================================================================
     ① 09:00 아침 체크
     ======================================================================= */
  function vMorning() {
    const days = wxDays(), t0 = days[0] || {}, cold = days.find(x => x.min <= 0);
    const top = L.top[0], ptop = scoreOf(P, top.b);
    const h24 = EVENTS.filter(e => e[0].startsWith("바라던 24시간")).length;
    const nextH = (API.holidays || []).filter(h => h.date > TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0];
    const urg = TODOS.filter(t => t.g === "긴급").length;
    const movers = L.top.map(x => { const p = scoreOf(P, x.b); return { b: x.b, s1: p ? p.score : null, r1: p ? p.rank : null, s2: x.score, r2: L.top.indexOf(x) + 1, d: x.score - (p ? p.score : 0) }; }).sort((a, b) => b.d - a.d);
    return `
    <div class="ph"><h2>아침 체크</h2><span class="t urg">09:00</span><div class="when">W컨셉 베스트 ${esc(L.at)} 수집 · 날씨 ${API.live.weather ? "실시간" : esc(API.at)}<br>${TODAY} (${wd(TODAY)})</div></div>
    <p class="lead">출근하자마자 보는 화면. 어제 대비 베스트 변동, 다가오는 날씨와 공휴일, 구매 리뷰를 규칙으로 점검해 오늘 할 일을 근거와 함께 뽑아요.</p>
    <div class="grid g4">
      <div class="kpi"><div class="k">베스트 1위 브랜드 ${src("real")}</div><div class="v">${esc(top.b)}</div><div class="s">점수 ${ptop ? ptop.score : "—"} → ${top.score} · 진입 ${top.n}개</div></div>
      <div class="kpi"><div class="k">오늘 서울 ${API.live.weather ? src("live") : src("api")}</div><div class="v">${t0.min ?? "—"}° / ${t0.max ?? "—"}°</div><div class="s">${cold ? `첫 영하 ${md(cold.date)}(${wd(cold.date)}) ${cold.min}℃ · D-${dd(cold.date, TODAY)}` : "14일 안에 영하 없음"}</div></div>
      <div class="kpi"><div class="k">메인 기획전 ${src("real")}</div><div class="v">${EVENTS.length}<small>개</small></div><div class="s">24시간 특가 ${h24} · ${esc(M.eventsMeta.at)} 기준</div></div>
      <div class="kpi"><div class="k">다음 공휴일 ${API.live.holidays ? src("live") : src("api")}</div><div class="v">${nextH ? "D-" + dd(nextH.date, TODAY) : "—"}</div><div class="s">${nextH ? `${esc(nextH.name)} ${md(nextH.date)}(${wd(nextH.date)}) · 준비 시작 ${md(addD(nextH.date, -28))}` : ""}</div></div>
    </div>
    <div class="grid g32" style="margin-top:14px">
      <div class="card"><h4>오늘 할 일 — 긴급 ${urg}건</h4><p class="cap">판단은 규칙이, 근거는 실제 데이터에서. 체크한 항목은 이 브라우저에 저장돼요.</p>
        ${TODOS.map(t => `<div class="todo ${store["d_" + t.title] ? "done" : ""}" data-k="${esc(t.title)}"><button class="chk" aria-label="완료">${store["d_" + t.title] ? "✓" : ""}</button><span class="t ${GT[t.g]}">${t.g}</span><div><b>${esc(t.title)}</b><div class="why">${esc(t.why)} <em title="${esc(RULE_TXT[t.r])}">· 규칙 ${t.r}</em> ${src(t.s)}</div></div><a class="go" href="${t.go}">열기</a></div>`).join("")}
        <details style="margin-top:10px;font-size:12px;color:var(--ink-2)"><summary style="cursor:pointer">규칙 ${Object.keys(RULE_TXT).length}개 보기</summary><ul style="margin:6px 0 0;padding-left:18px">${Object.entries(RULE_TXT).map(([k, v]) => `<li><b>${k}</b> ${esc(v)}</li>`).join("")}</ul></details>
      </div>
      <div class="card"><h4>어제 → 오늘 베스트 변동 ${src("real")}</h4><p class="cap">${esc(P.at)} → ${esc(L.at)} · 같은 화면 · 같은 계산</p>
        ${table(["브랜드", "#어제", "#오늘", "#점수 변화"], movers.slice(0, 8).map(x => `<tr><td><b>${esc(x.b)}</b>${inBanner(x.b) ? ' <span class="t ref">메인 배너</span>' : ""}</td><td class="num">${x.r1 ? x.r1 + "위" : "60위 밖"}</td><td class="num">${x.r2}위</td><td class="num ${x.d >= 0 ? "up" : "down"}">${x.d >= 0 ? "+" : ""}${fmt(x.d)}</td></tr>`))}
      </div>
    </div>
    <div class="sec"><h3>14일 날씨 — 시즌 노출 타이밍</h3>${wxSrc()}<span class="hint">서울 · 검게 칠한 날 = 최저기온 0℃ 이하</span></div>
    <div class="wx">${days.map(x => `<div class="${x.min <= 0 ? "cold" : ""}"><span>${md(x.date)} ${wd(x.date)}</span><b>${WX_ICON(x.code)} ${Math.round(x.max)}°</b><span>${Math.round(x.min)}° · ☂${x.rain}%</span></div>`).join("")}</div>
    <div class="card" style="margin-top:14px"><h4>최고 · 최저기온 추이</h4><div class="legend"><span><i style="background:#151515"></i>최고</span><span><i style="background:#b5b5b5"></i>최저</span></div><div class="chart sm"><canvas id="cWx"></canvas></div></div>`;
  }
  function afterMorning() {
    $$(".todo").forEach(el => $(".chk", el).onclick = () => { const k = "d_" + el.dataset.k; store[k] = !store[k]; save(); el.classList.toggle("done"); $(".chk", el).textContent = store[k] ? "✓" : ""; });
    const d = wxDays();
    chart("cWx", { type: "line", data: { labels: d.map(x => `${md(x.date)} ${wd(x.date)}`), datasets: [{ label: "최고", data: d.map(x => x.max), borderColor: "#151515", backgroundColor: "#151515", borderWidth: 2, pointRadius: 3, tension: .3 }, { label: "최저", data: d.map(x => x.min), borderColor: "#b5b5b5", backgroundColor: "#b5b5b5", borderWidth: 2, pointRadius: 3, tension: .3 }] }, options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...TT, callbacks: { label: c => `${c.dataset.label} ${c.parsed.y}℃` } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { grid: { color: (c) => c.tick.value === 0 ? "#151515" : "#ececec" }, border: { display: false }, ticks: { callback: v => v + "°" } } } } });
  }

  /* =======================================================================
     ② 기획전 운영
     ======================================================================= */
  const EV_TYPES = ["더블유위크", "24시간 특가", "W LIVE", "단독", "인플루언서·셀럽 큐레이션", "테마·브랜드 기획전"];
  function evType(e) { const t = e.join(" "); if (e[0].startsWith("바라던 24시간")) return "24시간 특가"; if (e[0].startsWith("W라이브")) return "W LIVE"; if (t.includes("더블유위크")) return "더블유위크"; if (t.includes("단독") || t.includes("오직 이곳에만")) return "단독"; if (/(선택한|고른|입는|소개하는|처럼|픽|인플루언서)/.test(t)) return "인플루언서·셀럽 큐레이션"; return "테마·브랜드 기획전"; }
  const evMax = b => { const m = (b || "").match(/~\s*(\d+)%/); return m ? +m[1] : null; };
  const evCoupon = b => { const m = (b || "").match(/(\d+)%\s*쿠폰/) || (b || "").match(/\+\s*(?:더블 쿠폰\s*)?(\d+)%/); return m ? +m[1] : null; };
  let evFilter = "전체";
  const STEPS = [[-28, "테마 · 목표 확정", "시즌(날씨 · 공휴일) · 지난 기획전 결과 · 베스트 트렌드로 테마와 목표 거래액 결정"], [-21, "참여 브랜드 섭외", "단독 컬러 · 선발매 · 인플루언서 PICK 가능 여부 협의"], [-14, "상품 선정 · 할인/쿠폰 분담 협의", "아래 시뮬레이터로 쿠폰율별 순수익 확인"], [-10, "재고 확인 · 리오더 요청", "베스트 상위 · 리뷰 증가 상품은 물량 먼저 확보"], [-7, "상품 등록 · 검수", "등록 검수 탭 규칙으로 고시정보 · 사이즈 안내 확인"], [-5, "배너 · 메인 구좌 · 푸시 요청", "24H 특가 · W LIVE 슬롯 포함"], [-2, "가격 · 쿠폰 세팅 최종 확인", "할인 적용가 · 쿠폰 중복 여부 점검"], [0, "오픈 · 오전 모니터링", "10시 · 14시 베스트 진입 확인, 품절 옵션 체크"], [3, "중간 점검", "목표 대비 페이스 · 품절 · VOC(사이즈 · 색상) 확인"], [99, "결과 리포트", "종료 +2일: 매출 · 베스트 진입 · 리뷰 증가 · 다음 개선점"]];
  function vPromo() {
    const E = EVENTS.map(e => ({ e, type: evType(e), max: evMax(e[3]), coupon: evCoupon(e[3]) }));
    const cnt = Object.fromEntries(EV_TYPES.map(t => [t, E.filter(x => x.type === t).length]));
    const c30 = E.filter(x => x.coupon === 30).length, disc = E.filter(x => x.max != null), avgMax = disc.reduce((a, x) => a + x.max, 0) / (disc.length || 1);
    const list = E.filter(x => evFilter === "전체" || x.type === evFilter);
    const nextH = (API.holidays || []).filter(h => h.date > TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0];
    const plan = store.plan || { name: nextH ? `${nextH.name} 선물 기획전` : "시즌 기획전", open: nextH ? addD(nextH.date, -18) : addD(TODAY, 30), end: nextH ? addD(nextH.date, -1) : addD(TODAY, 44) };
    store.plan = plan;
    const TC = { "더블유위크": "urg", "24시간 특가": "red", "W LIVE": "blue", "단독": "green", "인플루언서·셀럽 큐레이션": "amber", "테마·브랜드 기획전": "ref" };
    return `
    <div class="ph"><h2>기획전 운영</h2><span class="t urg">10:00</span><div class="when">메인 배너 ${esc(M.eventsMeta.at)} 수집</div></div>
    <p class="lead">지금 W컨셉 메인에 걸린 기획전을 유형별로 읽고, 내 기획전을 D-28부터 결과 리포트까지 일정으로 관리하고, 할인·쿠폰 분담에 따른 순수익을 계산해요.</p>
    <div class="sec"><h3>지금 W컨셉 메인 기획전</h3>${src("real", M.eventsMeta.at)}<span class="hint">${E.length}개 · 배너 문구를 규칙으로 분류</span></div>
    <div class="grid g32">
      <div class="card"><h4>${E.length}개 중 ${c30}개가 '30% 쿠폰'</h4><p class="cap">평균 최대 할인 ${avgMax.toFixed(0)}% + 쿠폰 · 유형을 눌러 거르기</p>
        <div class="seg" id="evf" style="margin-bottom:10px">${["전체", ...EV_TYPES].map(t => `<button class="${evFilter === t ? "on" : ""}" data-t="${t}">${t}${t === "전체" ? "" : " " + cnt[t]}</button>`).join("")}</div>
        <div style="max-height:340px;overflow:auto">${table(["유형", "기획전 문구", "브랜드 · 대상", "#혜택"], list.map(x => `<tr><td><span class="t ${TC[x.type]}">${x.type}</span></td><td>${esc([x.e[0], x.e[1]].filter(Boolean).join(" "))}</td><td>${esc(x.e[2])}</td><td class="num">${esc(x.e[3] || "—")}</td></tr>`))}</div></div>
      <div class="card ink"><h4>W컨셉 기획전 공식</h4><p class="cap">실제 배너에서 읽은 운영 패턴</p>
        ${EV_TYPES.map(t => `<div style="display:grid;grid-template-columns:140px 1fr 26px;gap:8px;align-items:center;font-size:12.5px;margin:7px 0"><span>${t}</span><div class="bar" style="background:#3a3a3a"><i style="width:${cnt[t] / Math.max(...Object.values(cnt)) * 100}%;background:#fff"></i></div><span style="text-align:right">${cnt[t]}</span></div>`).join("")}
        <p style="font-size:12.5px;color:#d6d6d6;margin:14px 0 0;line-height:1.7">· 혜택 = 브랜드 할인 '~N%' + 쿠폰 30%<br>· 24시간 특가가 하루 만에 순위를 움직임 (아뜰리에 드 루멘 베스트 진입 27개 → 39개)<br>· '○○가 고른 · 입는' 인플루언서 큐레이션 ${cnt["인플루언서·셀럽 큐레이션"]}개</p></div>
    </div>

    <div class="sec"><h3>내 기획전 준비 일정</h3>${src("calc")}<span class="hint">오픈일을 넣으면 단계별 날짜가 계산돼요 · 체크는 이 브라우저에 저장</span></div>
    <div class="card">
      <div class="grid g3"><div class="field"><label>기획전 이름</label><input class="inp" id="pName" value="${esc(plan.name)}"></div><div class="field"><label>오픈일</label><input class="inp" type="date" id="pOpen" value="${plan.open}"></div><div class="field"><label>종료일</label><input class="inp" type="date" id="pEnd" value="${plan.end}"></div></div>
      <div class="steps" style="margin-top:8px">${STEPS.map(([off, t, d], i) => { const date = off === 99 ? addD(plan.end, 2) : addD(plan.open, off); const k = `s_${plan.name}_${i}`; const left = dd(date, TODAY); return `<div class="step"><button class="chk" data-s="${esc(k)}">${store[k] ? "✓" : ""}</button><span class="d">${off === 99 ? "종료+2" : off === 0 ? "D-day" : off > 0 ? "D+" + off : "D" + off}</span><div><b>${t}</b> <span class="sub" style="color:var(--mute);font-size:12px">${md(date)}(${wd(date)}) · ${esc(d)}</span></div><span class="t ${store[k] ? "green" : left < 0 ? "red" : left <= 3 ? "urg" : "ref"}">${store[k] ? "완료" : left < 0 ? "지남" : left === 0 ? "오늘" : "D-" + left}</span></div>`; }).join("")}</div>
    </div>

    <div class="sec"><h3>할인 · 쿠폰 시뮬레이터</h3>${src("calc")}<span class="hint">모든 값은 입력값 · 과거 기획전 실적으로 바꿔 쓰세요</span></div>
    <div class="grid g2">
      <div class="card">
        <div class="field"><label>기준 거래액(원)</label><input class="inp" type="number" id="sBase" value="${store.sBase || 100000000}" step="1000000"></div>
        <div class="field"><label>평균 수수료율(%)</label><input class="inp" type="number" id="sFee" value="${store.sFee || 30}" step="1"></div>
        <div class="field"><label>브랜드 할인 <b id="dv"></b></label><input type="range" id="sd" min="0" max="60" value="${store.sd ?? 30}"></div>
        <div class="field"><label>플랫폼 쿠폰 <b id="cv"></b></label><input type="range" id="sc" min="0" max="30" value="${store.sc ?? 10}"></div>
        <div class="field"><label>할인 1%p당 판매량</label><input class="inp" type="number" id="sEd" value="${store.sEd || 2.2}" step="0.1"></div>
        <div class="field"><label>쿠폰 1%p당 판매량</label><input class="inp" type="number" id="sEc" value="${store.sEc || 3.0}" step="0.1"></div>
        <div class="grid g2" id="simOut" style="margin-top:12px"></div><p class="note" id="simMsg"></p>
      </div>
      <div class="card"><h4>쿠폰율별 플랫폼 순수익 (수수료 − 쿠폰 비용)</h4><p class="cap">기준점 = 할인 30% · 쿠폰 10%에서 기준 거래액</p><div class="chart"><canvas id="cSim"></canvas></div></div>
    </div>`;
  }
  function simCalc(v, d, c) { const vol = Math.max(0, 1 + v.ed / 100 * (d - 30) + v.ec / 100 * (c - 10)); const list = v.base / 0.7 * vol, gmv = list * (1 - d / 100), com = gmv * v.fee / 100, cost = gmv * c / 100; return { gmv, com, cost, profit: com - cost }; }
  function afterPromo() {
    $$("#evf button").forEach(b => b.onclick = () => { evFilter = b.dataset.t; render(); });
    ["pName", "pOpen", "pEnd"].forEach(id => $("#" + id).onchange = () => { store.plan = { name: $("#pName").value || "기획전", open: $("#pOpen").value, end: $("#pEnd").value }; save(); render(); });
    $$("[data-s]").forEach(b => b.onclick = () => { store[b.dataset.s] = !store[b.dataset.s]; save(); render(); });
    const upd = () => {
      const v = { base: +$("#sBase").value, fee: +$("#sFee").value, ed: +$("#sEd").value, ec: +$("#sEc").value }, d = +$("#sd").value, c = +$("#sc").value;
      Object.assign(store, { sBase: v.base, sFee: v.fee, sEd: v.ed, sEc: v.ec, sd: d, sc: c }); save();
      $("#dv").textContent = d + "%"; $("#cv").textContent = c + "%";
      const r = simCalc(v, d, c);
      $("#simOut").innerHTML = [["예상 거래액", r.gmv], ["수수료 수익", r.com], ["쿠폰 비용", r.cost], ["플랫폼 순수익", r.profit]].map(([k, x]) => `<div class="kpi"><div class="k">${k}</div><div class="v" style="font-size:22px">${won(x)}</div></div>`).join("");
      let best = 0, bp = -1e18; for (let x = 0; x <= 30; x++) { const p = simCalc(v, d, x).profit; if (p > bp) { bp = p; best = x; } }
      $("#simMsg").innerHTML = `이 입력값에서는 쿠폰 <b>${best}%</b>일 때 플랫폼 순수익이 가장 커요 (${won(bp)}). W컨셉 메인 배너는 30% 쿠폰이 기본이라, 쿠폰을 브랜드와 얼마나 나눠 낼지가 협상 포인트예요.`;
      chart("cSim", { type: "line", data: { labels: Array.from({ length: 31 }, (_, i) => i + "%"), datasets: [{ data: Array.from({ length: 31 }, (_, i) => simCalc(v, d, i).profit), borderColor: "#151515", borderWidth: 2, tension: .25, pointRadius: Array.from({ length: 31 }, (_, i) => i === c ? 6 : 0), pointBackgroundColor: "#151515", pointBorderColor: "#fff", pointBorderWidth: 2 }] }, options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { ...TT, callbacks: { title: x => "쿠폰 " + x[0].label, label: x => `순수익 ${won(x.parsed.y)} · 거래액 ${won(simCalc(v, d, x.dataIndex).gmv)}` } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } }, y: { grid: { color: c2 => c2.tick.value === 0 ? "#151515" : "#ececec" }, border: { display: false }, ticks: { callback: x => won(x) } } } } });
    };
    ["sBase", "sFee", "sEd", "sEc", "sd", "sc"].forEach(id => $("#" + id).oninput = upd); upd();
  }

  /* =======================================================================
     ③ 브랜드 모니터링
     ======================================================================= */
  let bCat = store.bCat || "전체";
  const spark = vals => { const v = vals.map(x => x ?? 0), mx = Math.max(...v, 1), w = 64, h = 22; return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="#151515" stroke-width="2" points="${v.map((x, i) => `${i * (w - 4) / (v.length - 1) + 2},${h - 3 - x / mx * (h - 6)}`).join(" ")}"/>${v.map((x, i) => `<circle cx="${i * (w - 4) / (v.length - 1) + 2}" cy="${h - 3 - x / mx * (h - 6)}" r="2.2" fill="${vals[i] == null ? "#fff" : "#151515"}" stroke="#151515"/>`).join("")}</svg>`; };
  function vBrands() {
    const rows = L.top.filter(x => bCat === "전체" || Object.entries(x.cats).sort((a, b) => b[1] - a[1])[0][0] === bCat).map(x => {
      const hist = SNAP.map(s => { const r = scoreOf(s, x.b); return r ? r.score : null; });
      const it = x.items, excl = it.filter(i => i[8]).length / it.length, disc = it.reduce((a, i) => a + i[4], 0) / it.length;
      return { x, hist, excl, disc, banner: inBanner(x.b), ex: exclBrands.includes(x.b), nw: hotNew[x.b] || 0, rv: PRODUCTS.filter(p => p.brand === x.b).length };
    });
    const C = L.cats, C1 = SNAP[0].cats;
    return `
    <div class="ph"><h2>브랜드 모니터링</h2><span class="t urg">11:00</span><div class="when">베스트 3회 수집: ${SNAP.map(s => esc(s.at)).join(" · ")}</div></div>
    <p class="lead">담당 카테고리의 베스트 상위 브랜드를 3일 흐름으로 봐요. 점수 = 카테고리별 TOP100 안에서 Σ(101 − 순위). 메인 배너 · 단독 · 신상 인기 여부를 같이 붙여서 '왜 올랐는지'를 바로 짐작할 수 있게 했어요.</p>
    <div class="grid g4">${CATS.map(c => `<div class="kpi"><div class="k">${c} TOP100 ${src("real")}</div><div class="v">${C[c].avgDisc}<small>% 평균 할인</small></div><div class="s">단독 ${C[c].excl} (${C[c].excl - C1[c].excl >= 0 ? "+" : ""}${C[c].excl - C1[c].excl}) · 더블유위크 ${C[c].wweek} · PICK ${C[c].pick} · 중위가 ${won(C[c].median)}</div></div>`).join("")}</div>
    <div class="sec"><h3>베스트 TOP20 브랜드</h3>${src("real", L.at)}<div class="right seg" id="bcat">${["전체", ...CATS].map(c => `<button class="${bCat === c ? "on" : ""}" data-c="${c}">${c}</button>`).join("")}</div></div>
    ${table(["#순위", "브랜드", "주력", "3일 흐름", "#11/11", "#11/12", "#11/13", "#진입", "#평균 할인", "#단독 비중", "신호"], rows.map(r => `<tr class="click" data-b="${esc(r.x.b)}"><td class="num">${L.top.indexOf(r.x) + 1}</td><td><b>${esc(r.x.b)}</b></td><td>${Object.entries(r.x.cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + " " + n).join(" · ")}</td><td>${spark(r.hist)}</td>${r.hist.map(v => `<td class="num">${v == null ? '<span class="sub">순위권 밖</span>' : fmt(v)}</td>`).join("")}<td class="num">${r.x.n}개</td><td class="num">${r.disc.toFixed(0)}%</td><td class="num">${pct(r.excl)}</td><td>${[r.banner ? '<span class="t red">메인 배너</span>' : "", r.ex ? '<span class="t green">단독관</span>' : "", r.nw ? `<span class="t blue">신상 인기 ${r.nw}</span>` : "", r.rv ? '<span class="t ref">리뷰 분석</span>' : ""].join(" ")}</td></tr>`))}
    <p class="note">11/11 수집은 상위 20개 브랜드만 저장해서 그 밖의 브랜드는 '순위권 밖'으로 보여요. 판매량 · 재고 · 반품 같은 내부 지표는 공개 데이터가 없어 넣지 않았고, 입사 후 사내 데이터를 같은 표에 붙이면 돼요.</p>`;
  }
  function afterBrands() {
    $$("#bcat button").forEach(b => b.onclick = () => { bCat = b.dataset.c; store.bCat = bCat; save(); render(); });
    $$("tr[data-b]").forEach(tr => tr.onclick = () => openBrand(tr.dataset.b));
  }
  function openBrand(b) {
    const x = L.top.find(y => y.b === b) || P.top.find(y => y.b === b) || SNAP[0].top.find(y => y.b === b);
    const hist = SNAP.map(s => { const r = scoreOf(s, b); return r ? `${md(s.at)} ${r.rank}위 (${fmt(r.score)})` : `${md(s.at)} 순위권 밖`; });
    const ps = PRODUCTS.filter(p => p.brand === b);
    const ev = EVENTS.filter(e => (e[2] || "").includes(b));
    const agenda = [`[${b} 미팅 아젠다] ${TODAY}`, `1. 베스트 흐름: ${hist.join(" → ")}`, x ? `2. 진입 상품 ${x.n}개 · 대표: ${x.items.slice(0, 3).map(i => `${i[2]}(${i[0]} ${i[1]}위, ${i[4] ? i[4] + "%↓" : "정가"})`).join(", ")}` : "2. 진입 상품: 확인 필요", ev.length ? `3. 메인 기획전 노출: ${ev.map(e => [e[0], e[1]].filter(Boolean).join(" ") + " / " + (e[3] || "")).join(", ")}` : "3. 메인 기획전 노출: 없음 → 다음 기획전 구좌 제안", ps.length ? `4. 구매 리뷰: ${ps.map(p => `${p.name} 사이즈 큼 ${p.size ? p.size["큼"] : "-"}%·작음 ${p.size ? p.size["작음"] : "-"}%`).join(", ")} → ${ps.flatMap(vocAction).map(a => a[1].split(" → ")[1]).filter(Boolean).join(", ") || "특이사항 없음"}` : "4. 구매 리뷰: 미수집", `5. 다음 기획전: 단독 컬러 · 리오더 물량 · 쿠폰 분담 협의`].join("\n");
    drawer(`<h2>${esc(b)}</h2><p class="cap" style="color:var(--mute);font-size:12px;margin:4px 0 14px">${hist.join(" → ")}</p>
      ${x ? table(["순위", "상품", "#판매가", "#할인", "#리뷰"], x.items.map(i => `<tr><td>${i[0]} ${i[1]}위</td><td>${esc(i[2])}${i[8] ? ' <span class="t green">단독</span>' : ""}</td><td class="num">${won(i[5])}</td><td class="num">${i[4] ? i[4] + "%" : "—"}</td><td class="num">${i[7] != null ? fmt(i[7]) : "—"}</td></tr>`)) : ""}
      <h4 style="margin:18px 0 6px">미팅 아젠다 (실제 데이터로 자동 정리)</h4><pre class="copy">${esc(agenda)}</pre><button class="btn" style="margin-top:10px" id="cpA">아젠다 복사</button>`);
    $("#cpA").onclick = () => copy(agenda, "미팅 아젠다를 복사했어요");
  }

  /* =======================================================================
     ④ 상품 · VOC
     ======================================================================= */
  let vCat = "전체";
  const stack = (o, cols) => o ? `<div class="stack">${cols.map(([k, c]) => `<span style="width:${o[k] || 0}%;background:${c}" title="${k} ${o[k]}%"></span>`).join("")}</div>` : '<span class="sub">평가 없음</span>';
  function vVoc() {
    const list = PRODUCTS.filter(p => vCat === "전체" || p.cat === vCat);
    const big = PRODUCTS.filter(p => p.size && p.size["큼"] >= 30), small = PRODUCTS.filter(p => p.size && p.size["작음"] >= 15);
    const colorRisk = PRODUCTS.filter(p => p.color && p.color["다름"] >= 5);
    const grow = PRODUCTS.map(p => ({ p, r: revDelta(p) })).filter(x => x.r).sort((a, b) => b.r.rate - a.r.rate);
    return `
    <div class="ph"><h2>상품 · VOC</h2><span class="t urg">13:00</span><div class="when">상품 페이지 2026-11-13 10:30 열람 · ${PRODUCTS.length}개</div></div>
    <p class="lead">베스트 상위 상품의 실제 구매 리뷰 요약(사이즈 · 색상 · 소재 평가)과 상품정보고시를 모았어요. 반품의 가장 큰 원인인 '사이즈 · 색상 상이'를 브랜드 요청 사항으로 바꿔요.</p>
    <div class="grid g4">
      <div class="kpi"><div class="k">'크게 나옴' 30%↑ ${src("real")}</div><div class="v">${big.length}<small>개</small></div><div class="s">${big.map(p => p.brand).join(", ")}</div></div>
      <div class="kpi"><div class="k">'작게 나옴' 15%↑ ${src("real")}</div><div class="v">${small.length}<small>개</small></div><div class="s">${small.map(p => p.brand).join(", ")}</div></div>
      <div class="kpi"><div class="k">색상 '다름' 5%↑ ${src("real")}</div><div class="v">${colorRisk.length}<small>개</small></div><div class="s">색상 상이 리스크는 대체로 낮음</div></div>
      <div class="kpi"><div class="k">리뷰 증가율 1위 ${src("real")}</div><div class="v">+${pct(grow[0].r.rate, 1)}</div><div class="s">${esc(grow[0].p.brand)} ${esc(grow[0].p.name)} · 11/11→11/13</div></div>
    </div>
    <div class="sec"><h3>구매 리뷰 평가</h3>${src("real")}<div class="right seg" id="vcat">${["전체", ...CATS].map(c => `<button class="${vCat === c ? "on" : ""}" data-c="${c}">${c}</button>`).join("")}</div></div>
    <div class="legend"><span><i style="background:#c8372d"></i>작음</span><span><i style="background:#151515"></i>적당함</span><span><i style="background:#2d5bd0"></i>큼</span><span style="margin-left:14px"><i style="background:#151515"></i>색상 같음</span><span><i style="background:#bdbdbd"></i>비슷함</span><span><i style="background:#c8372d"></i>다름</span></div>
    ${table(["상품", "#리뷰", "#3일 증가", "사이즈 (작음 · 적당 · 큼)", "색상", "소재 · 제조국 (고시)", "브랜드에 요청할 것"], list.map(p => { const r = revDelta(p); const a = vocAction(p); return `<tr><td><b>${esc(p.brand)}</b>${p.excl ? ' <span class="t green">단독</span>' : ""}<span class="sub">${esc(p.cat)} · ${esc(p.name)}</span></td><td class="num">★${p.rating} · ${fmt(p.cnt)}</td><td class="num">${r ? (r.d > 0 ? `<span class="up">+${r.d}</span>` : "0") : "—"}</td><td>${stack(p.size, [["작음", "#c8372d"], ["적당함", "#151515"], ["큼", "#2d5bd0"]])}${p.size ? `<span class="sub">${p.size["작음"]} · ${p.size["적당함"]} · ${p.size["큼"]}%</span>` : ""}</td><td>${stack(p.color, [["같음", "#151515"], ["비슷함", "#bdbdbd"], ["다름", "#c8372d"]])}</td><td style="max-width:220px"><span style="font-size:12px">${esc(p.material)}</span><span class="sub">${esc(p.origin)}</span></td><td>${a.length ? a.map(x => `<div style="margin:2px 0"><span class="t ${x[0]}">${x[0] === "urg" ? "요청" : "확인"}</span> <span style="font-size:12px">${esc(x[1].split(" → ")[1] || x[1])}</span></div>`).join("") : '<span class="t ref">유지</span>'}</td></tr>`; }))}
    <div class="grid g3" style="margin-top:14px">
      <div class="card ink"><h4>패딩 · 다운은 '크게 나온다'</h4><p class="cap">실제 리뷰</p><p style="margin:0;font-size:13px;color:#e5e5e5">${big.filter(p => p.cat === "의류").map(p => `${esc(p.brand)} ${esc(p.name)} 큼 ${p.size["큼"]}%`).join("<br>")}<br><br>→ 영하 시작 전 아우터 노출을 늘리기 전에 '한 치수 작게' 안내부터 요청해야 반품을 줄여요.</p></div>
      <div class="card"><h4>가방은 '크기 체감'이 갈린다</h4><p class="cap">실제 리뷰 · 가방의 사이즈 = 크기 체감</p><p style="margin:0;font-size:13px">${PRODUCTS.filter(p => p.cat === "가방" && p.size).map(p => `${esc(p.brand)} ${esc(p.name)}: 작음 ${p.size["작음"]}% · 큼 ${p.size["큼"]}%`).join("<br>")}<br><br>→ 수납 예시컷(휴대폰 · 지갑 · 파우치)과 착용 실측컷 요청.</p></div>
      <div class="card"><h4>리뷰 수 증가 = 판매 신호</h4><p class="cap">베스트 화면 리뷰 수 · 11/11 → 11/13</p>${grow.slice(0, 5).map(x => `<div style="display:grid;grid-template-columns:1fr 56px;gap:8px;font-size:12.5px;margin:5px 0"><span>${esc(x.p.brand)} · ${esc(x.p.name)}</span><span class="up" style="text-align:right">+${pct(x.r.rate, 1)}</span></div>`).join("")}<p class="note" style="margin-top:8px">판매량은 공개되지 않지만, 리뷰 증가 속도는 판매의 뒤를 따르는 신호라 재고 · 리오더 우선순위에 써요.</p></div>
    </div>`;
  }
  function afterVoc() { $$("#vcat button").forEach(b => b.onclick = () => { vCat = b.dataset.c; render(); }); }

  /* =======================================================================
     ⑤ 소싱 · 육성
     ======================================================================= */
  function vSourcing() {
    const NA = M.newArrivals || { newBrands: [], hot: [], collections: [] };
    const names = [...new Set([...L.top.map(x => x.b), ...Object.keys(hotNew), ...exclBrands, ...NA.collections])];
    const cand = names.map(b => {
      const s1 = scoreOf(P, b), s2 = scoreOf(L, b), d = (s2 ? s2.score : 0) - (s1 ? s1.score : 0);
      const why = [], sc = { rise: Math.max(0, Math.min(40, d / 25)), hot: Math.min(30, (hotNew[b] || 0) * 10), banner: inBanner(b) ? 15 : 0, excl: exclBrands.includes(b) ? 10 : 0, col: NA.collections.includes(b) ? 5 : 0 };
      if (d > 0) why.push(`베스트 점수 +${fmt(d)}`); if (hotNew[b]) why.push(`인기 신상 ${hotNew[b]}개`); if (sc.banner) why.push("메인 배너"); if (sc.excl) why.push("단독관"); if (sc.col) why.push("윈터 컬렉션");
      return { b, d, s2, why, score: Math.round(Object.values(sc).reduce((a, v) => a + v, 0)) };
    }).filter(x => x.score >= 15).sort((a, b) => b.score - a.score).slice(0, 12);
    return `
    <div class="ph"><h2>소싱 · 육성</h2><span class="t urg">15:00</span><div class="when">신상 · 단독 페이지 ${esc("2026-11-12 12:20")} 수집</div></div>
    <p class="lead">W컨셉은 신진 디자이너 발굴(매주 '뉴컨셉', 육성 프로그램 'W 스테이지')과 단독이 핵심이에요. 새로 들어온 브랜드와 막 뜨는 브랜드를 실제 신호로 골라, 다음 기획전에 키울 후보를 정해요.</p>
    <div class="sec"><h3>키울 브랜드 후보</h3>${src("real")}<span class="hint">점수 = 베스트 상승(최대 40) + 인기 신상 수 × 10(최대 30) + 메인 배너 15 + 단독관 10 + 윈터 컬렉션 5</span></div>
    ${table(["브랜드", "#후보 점수", "근거", "#오늘 베스트", "다음 액션"], cand.map(c => `<tr><td><b>${esc(c.b)}</b></td><td class="num"><div style="display:flex;gap:8px;align-items:center;justify-content:flex-end"><div class="bar" style="width:70px"><i style="width:${c.score}%"></i></div>${c.score}</div></td><td>${c.why.map(w => `<span class="t ref" style="margin:1px">${esc(w)}</span>`).join(" ")}</td><td class="num">${c.s2 ? c.s2.rank + "위" : "—"}</td><td>${c.d > 300 ? '<span class="t urg">물량 · 단독 컬러 협의</span>' : hotNew[c.b] ? '<span class="t opp">신상 기획전 메인 제안</span>' : '<span class="t ref">다음 기획전 초대</span>'}</td></tr>`))}
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h4>새로 입점한 브랜드 ${NA.newBrands.length}개 ${src("real")}</h4><p class="cap">아직 베스트 · 신상 인기에 없는 브랜드 = 첫 노출을 만들어 줄 대상</p>
        <div class="chips">${NA.newBrands.map(b => `<span class="t ${scoreOf(L, b) || hotNew[b] ? "green" : "opp"}">${esc(b)}${scoreOf(L, b) ? " · 베스트" : ""}</span>`).join("")}</div>
        <div class="field" style="margin-top:12px"><label>제안할 브랜드</label><select id="nbSel">${NA.newBrands.map(b => `<option>${esc(b)}</option>`).join("")}</select></div>
        <button class="btn" id="nbMail" style="margin-top:8px">첫 기획전 참여 제안문 만들기</button></div>
      <div class="card"><h4>단독관 브랜드 ${exclBrands.length}개 ${src("real")}</h4><p class="cap">오늘 베스트 TOP20에 동시 진입한 브랜드는 진하게</p>
        <div class="chips">${exclBrands.map(b => `<span class="t ${L.top.some(x => x.b === b) ? "urg" : "ref"}">${esc(b)}</span>`).join("")}</div>
        <h4 style="margin-top:14px">단독 프로모션</h4>${table(["브랜드", "내용"], (M.exclusive.promos || []).map(p => `<tr><td><b>${esc(p[0])}</b></td><td>${esc(p[1])}</td></tr>`))}</div>
    </div>`;
  }
  function afterSourcing() {
    $("#nbMail").onclick = () => {
      const b = $("#nbSel").value, cold = wxDays().find(x => x.min <= 0), nextH = (API.holidays || []).filter(h => h.date > TODAY).sort((a, c) => a.date < c.date ? -1 : 1)[0];
      const txt = `제목: [W컨셉] ${b} 첫 기획전 참여 제안드립니다\n\n안녕하세요, ${b} 담당자님.\n온라인MD 강현서입니다. W컨셉 입점을 환영합니다.\n\n입점 초기에는 첫 노출이 중요해서, 데이터로 본 시점을 기준으로 참여를 제안드립니다.\n- 지금 W컨셉 메인 기획전 ${EVENTS.length}개 중 ${EVENTS.filter(e => /30%\s*쿠폰|\+\s*30%/.test(e[3] || "")).length}개가 '30% 쿠폰' 혜택을 쓰고 있습니다.\n- ${cold ? `서울은 ${md(cold.date)}부터 영하로 떨어질 예정이라 겨울 아이템 노출이 본격화됩니다.` : "겨울 시즌 노출이 본격화되는 시점입니다."}\n- ${nextH ? `${nextH.name}(${md(nextH.date)})을 앞두고 선물 기획전이 열립니다.` : ""}\n\n제안 내용\n1. 신상 기획전 또는 시즌 기획전 참여 (상품 3~5개)\n2. 할인 · 쿠폰 분담 협의\n3. 상품 등록 시 상품정보고시(소재 · 제조국)와 실측 사이즈표를 꼭 넣어 주세요. 사이즈 안내가 반품을 가장 크게 줄입니다.\n\n편하신 일정에 20분 정도 미팅 가능하실까요?\n감사합니다.`;
      drawer(`<h2>제안문 초안</h2><p style="font-size:12px;color:var(--mute)">실제 데이터 근거가 자동으로 들어가요. 보내기 전에 직접 확인 · 수정하세요.</p><pre class="copy">${esc(txt)}</pre><button class="btn" id="cpM" style="margin-top:10px">복사</button>`);
      $("#cpM").onclick = () => copy(txt, "제안문을 복사했어요");
    };
  }

  /* =======================================================================
     ⑥ 등록 검수 (입력 도구)
     ======================================================================= */
  const RULES = [
    ["F01", "소재(혼용률) 표기", "수정 요청", "상품정보고시 필수 · 비었거나 '상세페이지 참조'면 직접 기재 요청"],
    ["F02", "제조국 표기", "수정 요청", "상품정보고시 필수"],
    ["F03", "실측 사이즈표", "수정 요청", "실제 리뷰에서 사이즈 '큼 · 작음'이 반품 1순위 → 없으면 반려"],
    ["F04", "근거 없는 최상급 표현", "수정 요청", "'최저가 · 최고 · 1위 · 역대급'은 근거 없으면 표시광고 위반 소지"],
    ["F05", "타 브랜드 연상 표현", "등록 불가", "'명품st · ○○스타일'은 상표권 분쟁 소지"],
    ["F06", "상품명 소재 과장", "수정 요청", "'캐시미어' 등 고가 소재를 앞세웠는데 함량 30% 미만이면 오인 소지"],
    ["F07", "썸네일 해상도 · 비율", "확인 필요", "1000px 이상, 1:1 · 3:4 · 4:5 권장"],
    ["F08", "썸네일 상품 비중", "확인 필요", "화면 대비 상품 40% 미만이면 목록에서 눈에 안 띔"],
    ["F09", "컬러 옵션 ↔ 사진 대표색", "확인 필요", "MediaPipe 사진 분석 결과와 비교 · 색상 상이 반품 예방"],
    ["F10", "카테고리 ↔ 사진 분류", "확인 필요", "MediaPipe 분류 결과와 비교 · 검색 · 기획전 노출 누락 예방"]
  ];
  const LV = { "통과": 0, "확인 필요": 1, "수정 요청": 2, "등록 불가": 3 }, LVT = { "통과": "green", "확인 필요": "blue", "수정 요청": "amber", "등록 불가": "red" };
  const SIM = { "블랙": ["차콜"], "차콜": ["블랙", "그레이"], "그레이": ["차콜"], "아이보리": ["화이트", "베이지"], "화이트": ["아이보리"], "베이지": ["아이보리", "카멜"], "카멜": ["베이지", "브라운", "오렌지"], "브라운": ["카멜", "버건디"], "네이비": ["블루", "블랙"], "버건디": ["브라운", "레드"] };
  function review(f, v) {
    const H = [], add = (c, m) => { const r = RULES.find(x => x[0] === c); H.push({ c, name: r[1], lv: r[2], why: r[3], m }); };
    if (!f.material || /상세페이지 참조/.test(f.material)) add("F01", f.material ? "'상세페이지 참조'로 되어 있어요." : "비어 있어요.");
    if (!f.origin || /상세페이지 참조/.test(f.origin)) add("F02", f.origin ? "'상세페이지 참조'로 되어 있어요." : "비어 있어요.");
    if (!f.sizeChart) add("F03", "실측 사이즈표 없음.");
    const sup = ["최저가", "최고", "1위", "역대급", "완판"].filter(w => f.name.includes(w)); if (sup.length) add("F04", `'${sup.join("', '")}'`);
    if (/명품|[가-힣A-Za-z]st(\s|$)|스타일$/.test(f.name)) add("F05", "타 브랜드 연상 표현이 있어요.");
    const m = (f.material || "").match(/캐시미어\s*(\d+)\s*%/i) || (f.material || "").match(/cashmere\s*(\d+)\s*%/i);
    if (/캐시미어|cashmere/i.test(f.name) && !/블렌드|blend/i.test(f.name) && (!m || +m[1] < 30)) add("F06", `상품명은 캐시미어인데 함량 ${m ? m[1] + "%" : "표기 없음"}.`);
    if (v) { const ok = ["1:1", "3:4", "4:5"].includes(v.ratio); if (Math.min(v.w, v.h) < 1000 || !ok) add("F07", `${v.w}×${v.h}px · ${v.ratio}`); if (v.fill < 0.4) add("F08", `상품 비중 ${pct(v.fill)}`); if (v.color && f.color && v.color !== f.color && !(SIM[f.color] || []).includes(v.color)) add("F09", `옵션 '${f.color}' · 사진 '${v.color}'`); if (v.category && f.cat && v.category !== f.cat) add("F10", `등록 '${f.cat}' · 사진 '${v.category}'`); }
    return { verdict: H.reduce((a, h) => LV[h.lv] > LV[a] ? h.lv : a, "통과"), H };
  }
  const PRESETS = [
    ...PRODUCTS.filter(p => p.cat !== "액세서리").slice(0, 6).map(p => ({ label: `실제 · ${p.brand} ${p.name}`, f: { name: p.name, cat: p.cat === "의류" ? "아우터" : p.cat, color: "", material: p.material, origin: p.origin, sizeChart: true } })),
    ...PRODUCTS.filter(p => /상세페이지 참조/.test(p.material + p.origin)).map(p => ({ label: `실제 · ${p.brand} ${p.name} (고시 확인)`, f: { name: p.name, cat: p.cat === "신발" ? "신발" : "스커트", color: "", material: p.material, origin: p.origin, sizeChart: true } })),
    { label: "연습용(가상) · 금지 표현 예시", f: { name: "[최저가] 명품st 캐시미어 코트", cat: "아우터", color: "카멜", material: "울 80%, 캐시미어 10%, 나일론 10%", origin: "", sizeChart: false } }
  ];
  let regF = store.regF || PRESETS[PRESETS.length - 1].f, VIS = null;
  function vRegister() {
    const r = review(regF, VIS);
    return `
    <div class="ph"><h2>등록 검수</h2><span class="t urg">16:00</span><div class="when">입력 도구 · 규칙 ${RULES.length}개 + MediaPipe</div></div>
    <p class="lead">브랜드가 보낸 상품 정보를 붙여 넣거나 상품 사진을 올리면 규칙으로 검수하고 수정 요청문을 만들어요. 예시는 W컨셉에서 읽은 실제 상품정보고시와 연습용 가상 예시를 구분해 두었어요.</p>
    <div class="grid g2">
      <div class="card"><div class="field"><label>예시 불러오기</label><select id="pre"><option value="">— 직접 입력 —</option>${PRESETS.map((p, i) => `<option value="${i}">${esc(p.label)}</option>`).join("")}</select></div>
        ${[["name", "상품명"], ["cat", "카테고리"], ["color", "컬러 옵션"], ["material", "소재(고시)"], ["origin", "제조사/제조국"]].map(([k, l]) => `<div class="field"><label>${l}</label><input class="inp" data-f="${k}" value="${esc(regF[k] || "")}"></div>`).join("")}
        <div class="field"><label>실측 사이즈표</label><label style="color:var(--ink)"><input type="checkbox" data-f="sizeChart" ${regF.sizeChart ? "checked" : ""}> 있음</label></div>
        <label class="drop" id="drop" style="margin-top:12px"><input type="file" accept="image/*" id="rf" hidden><b>상품 사진 올려서 AI 검수</b><br><span style="font-size:12px;color:var(--mute)">MediaPipe가 카테고리 · 대표 컬러 · 상품 비중을 확인 (사진은 저장 · 전송 안 됨)</span></label><div id="vs" style="font-size:12px;color:var(--mute);margin-top:6px"></div>
        ${VIS ? `<div class="thumb"><img src="${VIS.url}" alt="업로드한 상품 사진"><div style="font-size:12.5px;line-height:1.8">카테고리 <b>${VIS.category || "판단 어려움"}</b>${VIS.catLabel ? ` <span style="color:var(--mute)">(${esc(VIS.catLabel)})</span>` : ""}<br>대표 컬러 ${VIS.palette.slice(0, 3).map(p => `${p.name} ${pct(p.share)}`).join(" · ")}<br>${VIS.w}×${VIS.h} · ${VIS.ratio} · 상품 비중 ${pct(VIS.fill)}${VIS.method === "fallback" ? '<br><span class="t amber">AI 모델 미사용</span>' : ""}</div></div>` : ""}
      </div>
      <div class="card"><div style="display:flex;gap:10px;align-items:center"><h4 style="margin:0">판정</h4><span class="t ${LVT[r.verdict]}" style="font-size:14px">${r.verdict}</span></div><p class="cap">통과 → 확인 필요 → 수정 요청 → 등록 불가 · 통과도 최종 승인은 MD가 직접</p>
        ${r.H.length ? r.H.map(h => `<div class="rule"><code>${h.c}</code><div><b>${esc(h.name)}</b> — ${esc(h.m)}<div style="color:var(--mute);font-size:11.5px">${esc(h.why)}</div></div><span class="t ${LVT[h.lv]}">${h.lv}</span></div>`).join("") : '<p class="cap">걸린 규칙이 없어요.</p>'}
        <button class="btn" id="req" style="margin-top:12px" ${r.H.length ? "" : "disabled"}>수정 요청문 복사</button></div>
    </div>
    <div class="sec"><h3>검수 규칙</h3><span class="hint">Reboot 컴플라이언스 판정 체계(PASS · REVIEW · REVISE · BLOCK)를 상품 등록에 맞게 바꿈</span></div>
    ${table(["코드", "규칙", "판정", "이유"], RULES.map(x => `<tr><td><code>${x[0]}</code></td><td><b>${x[1]}</b></td><td><span class="t ${LVT[x[2]]}">${x[2]}</span></td><td style="color:var(--ink-2);font-size:12.5px">${x[3]}</td></tr>`))}`;
  }
  function afterRegister() {
    $("#pre").onchange = e => { if (e.target.value === "") return; regF = { ...PRESETS[+e.target.value].f }; store.regF = regF; save(); VIS = null; render(); };
    $$("[data-f]").forEach(i => i.onchange = () => { regF[i.dataset.f] = i.type === "checkbox" ? i.checked : i.value; store.regF = regF; save(); render(); });
    const run = async file => { if (!file || !window.FMDVision) return; $("#vs").textContent = "사진 분석 중…"; try { VIS = await window.FMDVision.analyze(file, m => { const s = $("#vs"); if (s) s.textContent = m; }); render(); } catch (e) { $("#vs").textContent = "사진을 읽지 못했어요."; } };
    $("#rf").onchange = e => run(e.target.files[0]);
    const dz = $("#drop"); ["dragover", "dragenter"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("on"); })); ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("on"); })); dz.addEventListener("drop", e => run(e.dataTransfer.files[0]));
    const r = review(regF, VIS); const b = $("#req");
    if (b && r.H.length) b.onclick = () => copy(`[상품 등록 보완 요청] ${regF.name}\n\n아래 항목 수정 후 다시 등록 부탁드립니다.\n${r.H.map((h, i) => `${i + 1}. (${h.lv}) ${h.name}: ${h.m}`).join("\n")}\n\n기획전 노출 일정이 있어 ${md(addD(TODAY, 2))}까지 회신 주시면 바로 확인하겠습니다.`, "수정 요청문을 복사했어요");
  }

  /* =======================================================================
     ⑦ 주간 리포트
     ======================================================================= */
  function reportText() {
    const C = L.cats, C1 = SNAP[0].cats, days = wxDays(), cold = days.find(x => x.min <= 0);
    const movers = L.top.map(x => { const p = scoreOf(P, x.b); return { b: x.b, d: x.score - (p ? p.score : 0) }; }).sort((a, b) => b.d - a.d);
    const big = PRODUCTS.filter(p => p.size && p.size["큼"] >= 30), small = PRODUCTS.filter(p => p.size && p.size["작음"] >= 15);
    const grow = PRODUCTS.map(p => ({ p, r: revDelta(p) })).filter(x => x.r).sort((a, b) => b.r.rate - a.r.rate).slice(0, 3);
    const nextH = (API.holidays || []).filter(h => h.date > TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0];
    return [
      `[패션 온라인MD 주간 리포트] ${TODAY} 작성 · 강현서`,
      ``, `1. 시장 (W컨셉 베스트 ${SNAP[0].at} → ${L.at})`,
      ...CATS.map(c => `- ${c}: 평균 할인 ${C1[c].avgDisc}% → ${C[c].avgDisc}% · 단독 ${C1[c].excl} → ${C[c].excl}개 · 더블유위크 ${C[c].wweek}개`),
      `- 급상승: ${movers.slice(0, 3).map(m => `${m.b}(+${fmt(m.d)})`).join(", ")}`,
      `- 메인 기획전 ${EVENTS.length}개 중 24시간 특가 ${EVENTS.filter(e => e[0].startsWith("바라던 24시간")).length}개. 24H 노출 브랜드가 하루 만에 가방 베스트를 채움 → 24H 슬롯이 가장 강한 레버.`,
      ``, `2. 고객 VOC (베스트 상위 ${PRODUCTS.length}개 상품 구매 리뷰)`,
      `- 크게 나옴 30%↑: ${big.map(p => `${p.brand} ${p.name}(${p.size["큼"]}%)`).join(", ") || "없음"}`,
      `- 작게 나옴 15%↑: ${small.map(p => `${p.brand} ${p.name}(${p.size["작음"]}%)`).join(", ") || "없음"}`,
      `- 리뷰 증가(판매 신호): ${grow.map(x => `${x.p.brand} ${x.p.name}(+${pct(x.r.rate, 1)})`).join(", ")}`,
      ``, `3. 다음 주 계획`,
      cold ? `- ${md(cold.date)}부터 서울 영하(${cold.min}℃) → 아우터 · 부츠 · 머플러 메인 구좌 요청, '한 치수 작게' 안내 먼저 반영` : `- 날씨 특이사항 없음`,
      nextH ? `- ${nextH.name}(${md(nextH.date)}) 기획전: 준비 시작 ${md(addD(nextH.date, -28))}, 참여 브랜드 섭외 ${md(addD(nextH.date, -21))}` : "",
      `- 사이즈 안내 보완 요청: ${[...new Set([...big, ...small].map(p => p.brand))].join(", ")}`,
      `- 상품정보고시 직접 기재 요청: ${[...new Set(PRODUCTS.filter(p => /상세페이지 참조/.test(p.material + p.origin)).map(p => p.brand))].join(", ") || "없음"}`,
      ``, `※ 데이터: W컨셉 공개 화면(베스트 · 기획전 · 단독 · 신상 · 상품 리뷰 요약) 1회 열람, Open-Meteo 날씨 · Nager.Date 공휴일(무료 API). 판매 · 재고는 내부 데이터 연결 후 추가.`
    ].filter(x => x !== "").join("\n");
  }
  function vReport() {
    return `<div class="ph"><h2>주간 리포트</h2><span class="t urg">금 17:00</span><div class="when">실제 데이터로 자동 작성</div></div>
    <p class="lead">한 주 동안 모은 시장 · VOC · 날씨 · 공휴일 데이터를 팀 보고용 문장으로 정리해요. 숫자는 전부 출처가 있는 값이에요.</p>
    <div class="card"><pre class="copy" id="rep">${esc(reportText())}</pre><button class="btn" id="cpR" style="margin-top:10px">리포트 복사</button></div>`;
  }
  function afterReport() { $("#cpR").onclick = () => copy(reportText(), "리포트를 복사했어요"); }

  /* =======================================================================
     ⑧ 데이터 출처 · 프로젝트
     ======================================================================= */
  function vSources() {
    const rows = [
      ["W컨셉 베스트 (4개 카테고리 TOP100)", SNAP.map(s => s.at).join(" · "), "real", "베스트 화면 1회 열람 × 3일", "브랜드 모니터링 · 아침 체크"],
      ["W컨셉 메인 기획전 배너 67개", M.eventsMeta.at, "real", "우먼 메인 1회 열람", "기획전 운영 · 아침 체크"],
      ["W컨셉 단독 · 신상 페이지", "2026-11-12 12:20", "real", "단독 · 신상 화면 1회 열람", "소싱 · 육성"],
      [`상품 ${PRODUCTS.length}개 구매 리뷰 요약 · 상품정보고시`, "2026-11-13 10:30", "real", "상품 페이지 1회 열람 (Q&A는 robots.txt 차단이라 열지 않음)", "상품 · VOC · 등록 검수"],
      ["서울 14일 날씨 (Open-Meteo)", API.live.weather ? "지금 (실시간)" : API.at, API.live.weather ? "live" : "api", "무료 · 키 없음 · 브라우저에서 직접 호출", "아침 체크 규칙 W1~W3"],
      ["한국 공휴일 (Nager.Date)", API.live.holidays ? "지금 (실시간)" : API.at, API.live.holidays ? "live" : "api", "무료 · 키 없음 · 브라우저에서 직접 호출", "아침 체크 H1 · 기획전 일정"],
      ["할인 · 쿠폰 시뮬레이터, 기획전 일정", "—", "calc", "사용자가 넣는 입력값으로 계산", "기획전 운영"]
    ];
    return `<div class="ph"><h2>데이터 출처</h2><div class="when">근거 없는 가상 데이터는 쓰지 않음</div></div>
    <p class="lead">모든 숫자 옆에 출처 표시를 붙였어요. <span class="src real">W컨셉 실제</span> 공개 화면에서 읽은 값 · <span class="src api">무료 API</span> 키 없이 받는 공개 API · <span class="src live">실시간</span> 지금 불러온 값 · <span class="src calc">계산 · 입력값</span> 사용자가 넣은 값으로 계산.</p>
    ${table(["데이터", "기준 시각", "구분", "방법", "쓰는 곳"], rows.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${src(r[2])}</td><td style="font-size:12.5px">${esc(r[3])}</td><td style="font-size:12.5px">${esc(r[4])}</td></tr>`))}
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h4>일부러 넣지 않은 것</h4><p class="cap">공개 데이터가 없어서 만들어 넣으면 근거 없는 숫자가 되는 것</p><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8"><li>담당 브랜드 판매량 · 거래액 · 재고 · 반품률</li><li>기획전 실제 실적 · 인플루언서 PICK 전환율</li><li>브랜드 수수료율 · 쿠폰 분담 계약 조건</li></ul><p class="note">입사 후 사내 데이터(API)를 연결하면 '브랜드 모니터링' 표와 '오늘 할 일' 규칙에 그대로 붙여요. 공개 데이터 중 판매와 가장 가까운 신호는 '리뷰 수 증가'라 대신 썼어요.</p></div>
      <div class="card"><h4>수집 원칙</h4><p class="cap">robots.txt · 이용약관 확인</p><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8"><li>W컨셉: 허용 목록 방식. 사용자 요청형(Claude-User)만 허용 → 요청할 때 화면을 한 번 읽는 방식으로만 수집, 자동 반복 크롤러 없음</li><li>'/Event/BlackFriday', 상품 Q&A(Ajax)는 robots.txt 차단 → 열지 않음</li><li>네이버 데이터랩 · 쇼핑: 전체 차단 → 수집하지 않음</li><li>상품 · 배너 이미지는 저장하지 않음</li></ul></div>
    </div>
    <div class="sec"><h3>이 프로젝트</h3></div>
    <div class="grid g3">
      <div class="card"><h4>문제</h4><p style="font-size:13px;margin:0">인턴 때 행사 가격 · 매출 · 할인율을 엑셀 여러 장으로 관리하면서, '오늘 무엇부터 해야 하는지'를 정하는 데 시간이 걸렸어요. 근거도 화면마다 흩어져 있었어요.</p></div>
      <div class="card"><h4>해결</h4><p style="font-size:13px;margin:0">MD의 하루 순서(아침 체크 → 기획전 → 브랜드 → VOC → 소싱 → 검수 → 리포트)대로 화면을 만들고, 실제 공개 데이터와 무료 API에 규칙 ${Object.keys(RULE_TXT).length}개를 붙여 할 일을 근거와 함께 자동으로 뽑았어요.</p></div>
      <div class="card"><h4>AI가 한 일 / 내가 한 일</h4><p style="font-size:13px;margin:0"><b>AI</b> MediaPipe 사진 분류 · 대표 컬러, Claude 코드 작성 보조<br><b>나</b> 업무 흐름 설계, 규칙 · 지표 정의(리뷰 증가 = 판매 신호, 사이즈 30% 기준, 24H 효과), 수집 원칙 결정</p></div>
    </div>`;
  }

  /* ---------------- 드로어 ---------------- */
  function drawer(html) { closeDrawer(); const bg = document.createElement("div"); bg.className = "drawer-bg"; bg.onclick = closeDrawer; const d = document.createElement("aside"); d.className = "drawer"; d.innerHTML = '<button class="x" aria-label="닫기">✕</button>' + html; $(".x", d).onclick = closeDrawer; document.body.append(bg, d); }
  function closeDrawer() { $$(".drawer,.drawer-bg").forEach(e => e.remove()); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

  /* ---------------- 셸 ---------------- */
  const VIEWS = { morning: ["아침 체크", vMorning, afterMorning], promo: ["기획전 운영", vPromo, afterPromo], brands: ["브랜드 모니터링", vBrands, afterBrands], voc: ["상품 · VOC", vVoc, afterVoc], sourcing: ["소싱 · 육성", vSourcing, afterSourcing], register: ["등록 검수", vRegister, afterRegister], report: ["주간 리포트", vReport, afterReport], sources: ["데이터 출처", vSources, () => { }] };
  const IC = { search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>', expand: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>', mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>', db: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>', print: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z"/></svg>', book: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-4-6 4z"/></svg>' };
  function shell() {
    document.getElementById("app").innerHTML = `
    <div class="frame">
      <div class="topbar"><div class="q">${IC.search}<input id="q" placeholder="브랜드 · 상품 검색" autocomplete="off"><div class="qres" id="qr" hidden></div></div><span class="div"></span>
        <span class="chip"><i>강</i>강현서</span><span class="chip hide-m"><i>W</i>온라인MD · 패션</span><span class="chip hide-m"><i>◷</i>${TODAY.replace(/-/g, ".")}</span></div>
      <div class="canvas">
        <button class="expand" title="새 창에서 크게 보기" onclick="document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(()=>{})">${IC.expand}</button>
        <div class="hero"><div class="lines"></div><h1>fashion md.<small>daily workflow</small></h1>
          <p class="sub">패션 온라인MD의 하루 업무 순서대로 만든 대시보드 · W컨셉 공개 데이터와 무료 API만 사용</p>
          <nav class="tags" id="nav">${Object.entries(VIEWS).map(([k, v]) => `<a class="tag-nav" href="#${k}" data-v="${k}">${v[0]}${k === "morning" ? ` <span class="n">${TODOS.filter(t => t.g === "긴급").length}</span>` : ""}</a>`).join("")}</nav></div>
        <section class="view" id="view"></section>
      </div>
      <div class="foot"><span>${IC.db} W컨셉 베스트 ${esc(L.at)} · 날씨 · 공휴일 무료 API</span><span>${IC.mail} 강현서 · 온라인MD 지원 포트폴리오</span><div class="r"><button title="인쇄 · PDF" onclick="window.print()">${IC.print}</button><button title="데이터 출처" onclick="location.hash='sources'">${IC.book}</button></div></div>
    </div>`;
    const q = $("#q"), qr = $("#qr");
    q.addEventListener("input", () => {
      const s = q.value.trim(); if (!s) { qr.hidden = true; return; }
      const bs = [...new Set(SNAP.flatMap(x => x.scores.map(y => y[0])))].filter(b => b.includes(s)).slice(0, 6).map(b => `<button data-b="${esc(b)}"><span class="k">브랜드</span>${esc(b)}</button>`);
      const ps = PRODUCTS.filter(p => (p.brand + p.name).includes(s)).slice(0, 5).map(p => `<button data-p="1"><span class="k">상품</span>${esc(p.brand)} · ${esc(p.name)}</button>`);
      qr.innerHTML = [...bs, ...ps].join("") || '<div style="padding:8px;font-size:12px;color:#888">결과 없음</div>'; qr.hidden = false;
      $$("button", qr).forEach(b => b.onclick = () => { qr.hidden = true; q.value = ""; if (b.dataset.b) { location.hash = "brands"; setTimeout(() => openBrand(b.dataset.b), 60); } else location.hash = "voc"; });
    });
    document.addEventListener("click", e => { if (!e.target.closest(".q")) qr.hidden = true; });
  }
  const cur = () => { const h = (location.hash || "").slice(1); return VIEWS[h] ? h : "morning"; };
  function render() { const id = cur(); $$("#nav a").forEach(a => a.classList.toggle("on", a.dataset.v === id)); $("#view").innerHTML = VIEWS[id][1](); VIEWS[id][2](); document.title = VIEWS[id][0] + " · fashion md."; }
  window.addEventListener("hashchange", () => { closeDrawer(); render(); });
  shell(); render(); loadLive();
})();
