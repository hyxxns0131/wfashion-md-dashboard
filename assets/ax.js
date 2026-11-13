/* =========================================================================
   AX 탭 — Reboot 대시보드의 콘텐츠 · 컴플라이언스 · 성과분석 · 인사이트 탭을
   W컨셉 패션 온라인MD 업무에 맞게 옮긴 것.
   - 판단은 규칙이 하고, AI(OpenAI)는 문장 · 제안만 씁니다 (Reboot 원칙 그대로).
   - OpenAI 키는 브라우저에 없습니다. 로컬 server.py 가 .env 에서 읽어 대신 호출합니다.
   - 서버 없이 열면 규칙 기능은 그대로 되고 AI 버튼만 꺼집니다.
   ========================================================================= */
(function () {
  "use strict";
  window.FMD_EXT = function (X) {
    const { $, $$, esc, fmt, pct, md, TODAY, addD, toast, copy, src, table, store, save, chart, M, SNAP, L, P, CATS, scoreOf, EVENTS, exclBrands, PRODUCTS, revDelta, API, wxDays, evType, LVT, rerender } = X;
    const LV = { "통과": 0, "참고": 0, "확인 필요": 1, "수정 요청": 2, "등록 불가": 3 };
    const worst = H => H.reduce((a, h) => LV[h.lv] > LV[a] ? h.lv : a, "통과");
    const seg = (id, items, on) => `<div class="seg" id="${id}">${items.map(([k, l]) => `<button class="${on === k ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>`;
    const bindSeg = (id, fn) => $$(`#${id} button`).forEach(b => b.onclick = () => fn(b.dataset.k));
    const sign = (n, d = 1) => (n > 0 ? "+" : "") + (n * 100).toFixed(d) + "%";
    const pp = n => (n > 0 ? "+" : "") + (n * 100).toFixed(1) + "%p";

    /* ---------------- AI 연결 (로컬 server.py) ---------------- */
    const AI = { checked: false, server: false, ai: false, model: "" };
    (async () => {
      if (/^https?:$/.test(location.protocol)) {
        try { const r = await fetch("api/health", { cache: "no-store" }); if (r.ok && /json/.test(r.headers.get("content-type") || "")) { const j = await r.json(); if (j && j.ok) { AI.server = true; AI.ai = !!j.ai; AI.model = j.model || ""; } } } catch (e) { }
      }
      AI.checked = true; rerender();
    })();
    const aiReady = () => AI.server && AI.ai;
    const aiBadge = () => !AI.checked ? '<span class="aist">AI 연결 확인 중…</span>'
      : aiReady() ? `<span class="aist on">AI 연결됨 · ${esc(AI.model)}</span>`
        : AI.server ? '<span class="aist off" title=".env 에 OPENAI_API_KEY 를 넣고 server.py 를 다시 켜세요">AI 꺼짐 · .env 에 키 필요</span>'
          : '<span class="aist off" title="대시보드 폴더에서 python server.py 실행 후 http://127.0.0.1:8770 으로 열면 켜져요">AI 꺼짐 · 로컬 서버(server.py)에서 사용</span>';
    async function aiCall(task, payload) {
      const r = await fetch("api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, ...payload }) });
      let j = {}; try { j = await r.json(); } catch (e) { }
      if (!r.ok) throw new Error(j.error || `AI 호출 실패 (${r.status})`);
      return j;
    }
    const aiMeta = m => m ? `<span class="cap">AI · ${esc(m.model)} · ${esc(m.prompt_version)}${m.tokens ? ` · ${fmt(m.tokens)} tokens` : ""}</span>` : "";
    const facts = p => { const r = revDelta(p); return { brand: p.brand, name: p.name, category: p.cat, exclusive: !!p.excl, rating: p.rating, review_count: p.cnt, review_growth_3d: r ? `+${r.d}건 (${pct(r.rate, 1)}, 11/11→11/13)` : null, size_feedback: p.size, color_feedback: p.color, material: p.material, origin: p.origin }; };
    const weatherFact = () => { const d = wxDays().slice(0, 7); if (!d.length) return null; const cold = d.find(x => x.min <= 0); return `서울 ${md(d[0].date)}~${md(d[d.length - 1].date)} 최저 ${Math.min(...d.map(x => x.min))}℃ · 최고 ${Math.max(...d.map(x => x.max))}℃${cold ? ` · ${md(cold.date)}부터 영하` : ""}`; };

    /* =======================================================================
       표현 검수 엔진 (Reboot 컴플라이언스 R1~R17 → 한국 패션 이커머스 R01~R12)
       ======================================================================= */
    const LAW = {
      ad: "표시·광고의 공정화에 관한 법률 (거짓·과장, 부당 비교)",
      price: "부당한 표시·광고행위의 유형 및 기준 지정고시 (가격 표시 · 종전가격)",
      fiber: "섬유제품 품질표시 기준 · 전자상거래 상품정보제공 고시",
      eco: "환경기술 및 환경산업 지원법 (환경성 표시·광고)",
      func: "표시·광고의 공정화에 관한 법률 (실증 책임)",
      tm: "상표법 · 부정경쟁방지법",
      rec: "추천·보증 등에 관한 표시·광고 심사지침 (경제적 이해관계 표시)",
      origin: "대외무역법 (원산지 표시)",
      excl: "표시·광고의 공정화에 관한 법률 · 단독 운영 기준(사내 확인)",
      ethic: "사내 콘텐츠 가이드(가정) · 외모 비하 · 차별 표현"
    };
    const CR = [
      ["R01", "최상급 · 절대 표현", "수정 요청", "ad", "최고 · 최저가 · 1위 · 완벽 · 무조건처럼 객관적 근거 없이 단정하는 표현"],
      ["R02", "부당 비교", "수정 요청", "ad", "타사 · 백화점 · 정가 대비처럼 비교 대상과 근거 없이 우위를 말하는 표현"],
      ["R03", "할인율 · 가격 근거", "확인 필요", "price", "할인율이 실제 가격과 맞는지, '최대 N%' 상품이 실제로 있는지"],
      ["R04", "기간 · 수량 희소성", "확인 필요", "ad", "오늘만 · 품절 임박 · 한정 수량은 실제 기간 · 재고 근거가 있어야 함"],
      ["R05", "소재 · 혼용률 불일치", "수정 요청", "fiber", "문구 속 소재(캐시미어 · 울 · 구스 등)가 상품정보고시에 있는지"],
      ["R06", "친환경 · 윤리 표현", "확인 필요", "eco", "친환경 · 비건 · 리사이클은 인증 · 시험 근거 필요 (그린워싱)"],
      ["R07", "기능 · 효과 단정", "확인 필요", "func", "방수 · 발열 · 체형 보정 · 항균은 시험성적서 근거 필요"],
      ["R08", "타 상표 · 명품 연상", "수정 요청", "tm", "명품st · 타 브랜드명 사용. 레플리카 · 미러급은 등록 불가"],
      ["R09", "광고 · 협찬 표기", "확인 필요", "rec", "인플루언서 · 셀럽 콘텐츠는 '광고' · '협찬' 표기 확인"],
      ["R10", "원산지 표현 불일치", "수정 요청", "origin", "Made in · 국내 생산 같은 표현이 고시 제조국과 맞는지"],
      ["R11", "단독 표현 근거", "수정 요청", "excl", "'단독'은 W컨셉 단독 상품에만"],
      ["R12", "외모 비하 · 차별", "수정 요청", "ethic", "하체비만 · 뚱뚱 같은 체형 비하 표현"]
    ];
    const MATS = [
      ["캐시미어", /캐시미어|cashmere/i, /캐시미어|cashmere/i],
      ["알파카", /알파카|alpaca/i, /알파카|alpaca/i],
      ["울", /(?<![겨가-힣])울(?![림산트퉁])|\bwool\b|메리노/i, /울|wool|(?:^|[^가-힣])모\s?\d/i],
      ["구스다운", /구스|goose/i, /구스|goose|거위/i],
      ["덕다운", /덕\s?다운|\bduck\b/i, /덕|duck|오리/i],
      ["실크", /실크|\bsilk\b/i, /실크|silk|(?:^|[^가-힣])견\s?\d/i],
      ["가죽", /(?<!비건\s?|인조\s?|에코\s?)(?:가죽|레더|leather)/i, /가죽|레더|leather/i],
      ["리넨", /리넨|린넨|\blinen\b/i, /리넨|린넨|linen|(?:^|[^가-힣])마\s?\d/i],
      ["모헤어", /모헤어|mohair/i, /모헤어|mohair/i],
      ["앙고라", /앙고라|angora/i, /앙고라|angora/i]
    ];
    const COUNTRIES = [["이탈리아", /이탈리아|italy/i], ["프랑스", /프랑스|france/i], ["영국", /영국|\buk\b|england/i], ["일본", /일본|japan/i], ["대한민국", /국내|한국|대한민국|korea/i], ["중국", /중국|china/i], ["베트남", /베트남|vietnam/i]];
    function checkCopy(text, o = {}) {
      const t = String(text || ""), H = [], prods = o.products || [];
      const add = (c, m, lv) => { const r = CR.find(x => x[0] === c); H.push({ c, name: r[1], lv: lv || r[2], law: LAW[r[3]], m }); };
      const hits = re => [...new Set((t.match(re) || []).map(s => s.trim()))];
      // R01
      const sup = hits(/최고(?!가)|최저가|최상(?!단)|업계\s*1위|(?<![\d.])1위|넘버\s*원|no\.?\s?1\b|유일(?:한|무이)|완벽(?:한|하게|히)?|100\s?%\s?(?:만족|효과|보장|환불)|무조건|역대급|세계\s*최초|국내\s*최초|최강/gi);
      if (sup.length) add("R01", `'${sup.join("', '")}'`, /\((?:[^)]*기준|출처)[^)]*\)/.test(t) ? "확인 필요" : null);
      // R02
      const cmp = hits(/타사|타\s*브랜드|백화점\s*(?:보다|대비)|(?:보다|대비)\s*(?:더\s*)?(?:저렴|싸|좋)/g); if (cmp.length) add("R02", `'${cmp.join("', '")}'`);
      // R03
      const disc = [...t.matchAll(/(최대\s*|~\s*)?(\d{1,2})\s?%\s*(할인|off|세일|sale|쿠폰|dc|↓)?/gi)].filter(m => m[1] || m[3]);
      if (disc.length) {
        const pr = o.price || {}; const real = pr.list > 0 && pr.sale > 0 && pr.sale < pr.list ? Math.round((1 - pr.sale / pr.list) * 100) : null;
        const bad = real != null ? disc.filter(m => !m[1] && !/쿠폰/i.test(m[3] || "") && Math.abs(+m[2] - real) > 1) : [];
        if (bad.length) add("R03", `문구 ${bad.map(m => m[2] + "%").join(", ")} · 실제 ${real}% (정가 ${fmt(pr.list)}원 → ${fmt(pr.sale)}원)`, "수정 요청");
        else if (disc.some(m => m[1])) add("R03", `'${disc.filter(m => m[1]).map(m => m[0].trim()).join("', '")}' — 그 할인율 상품이 실제로 있는지 확인`);
        else if (real == null) add("R03", `${disc.map(m => m[0].trim()).join(", ")} — 정가 · 판매가를 넣으면 할인율을 대조해요`);
      }
      // R04
      const rare = hits(/오늘만|단\s*하루|마감\s*임박|품절\s*임박|곧\s*품절|한정\s*수량|단\s*\d+\s*(?:개|장|벌|명)|마지막\s*기회|선착순/g); if (rare.length) add("R04", `'${rare.join("', '")}'`);
      // R05
      const ev = prods.map(p => p.material + " " + p.name).join(" ");
      const ms = MATS.filter(m => m[1].test(t));
      if (ms.length) {
        if (!prods.length) add("R05", `${ms.map(m => m[0]).join(", ")} 언급 — 상품을 연결하면 고시와 대조해요`, "확인 필요");
        else { const miss = ms.filter(m => !m[2].test(ev)); if (miss.length) add("R05", `${miss.map(m => m[0]).join(", ")} — 연결 상품 고시에 없음 (${prods.map(p => p.material).join(" / ")})`); }
      }
      // R06 · R07
      const eco = hits(/친환경|에코(?!백)|지속\s*가능|비건|리사이클|재활용|탄소\s*중립|무독성|오가닉|유기농|생분해/g); if (eco.length) add("R06", `'${eco.join("', '")}'`);
      const fn = hits(/방수|발열|보온\s*(?:효과|100)|체형\s*(?:보정|커버)|다이어트|날씬해(?:져|지는|보이는)|살\s*빠져\s*보이는|키\s*커\s*보이는|항균|자외선\s*차단|UV\s*차단|구김\s*(?:제로|없는)|보풀\s*(?:제로|없는)|늘어나지\s*않|변형\s*없/gi); if (fn.length) add("R07", `'${fn.join("', '")}'`);
      // R08
      const hard = hits(/레플리카|미러급|정품급|이미테이션|짝퉁|st급/gi), soft = hits(/명품\s*(?:st|스타일|느낌|감성)|[가-힣]\s?st(?![a-z])|샤넬|에르메스|버버리|프라다|디올|루이\s?비통|구찌|미우미우|셀린느|보테가|생로랑|발렌시아가|로에베|더\s*로우/gi);
      if (hard.length) add("R08", `'${hard.join("', '")}'`, "등록 불가"); else if (soft.length) add("R08", `'${soft.join("', '")}'`);
      // R09
      if ((o.placement === "sns" || /인플루언서|셀럽|착용템|추천템|\bpick\b|픽/i.test(t)) && !/광고|협찬|유료\s*광고|#ad\b|제공\s*받/i.test(t) && (o.placement === "sns" || /인플루언서|셀럽/.test(t))) add("R09", "광고 · 협찬 표기가 없어요 (#광고 · #협찬)");
      // R10
      const oc = [...t.matchAll(/(?:made\s*in|메이드\s*인)\s*([a-z가-힣]+)|(이탈리아|프랑스|영국|일본|국내|한국|대한민국)\s*(산|생산|제작|제조|원단|공장|수제)/gi)];
      if (oc.length) {
        if (!prods.length) add("R10", `'${oc.map(m => m[0]).join("', '")}' — 상품을 연결하면 고시 제조국과 대조해요`, "확인 필요");
        else oc.forEach(m => { const word = m[1] || m[2], c = COUNTRIES.find(x => x[1].test(word)); if (!c) return; const ok = prods.every(p => c[1].test(p.origin)); if (!ok) add("R10", `'${m[0]}' · 고시 제조국 ${prods.map(p => (p.origin.split("/")[1] || p.origin).trim()).join(", ")}`, /원단/.test(m[3] || "") ? "확인 필요" : null); });
      }
      // R11
      if (/단독|독점|only\s*(?:at\s*)?w|오직\s*(?:이곳|W컨셉)/i.test(t)) { if (!prods.length) add("R11", "상품을 연결하면 단독 여부를 확인해요", "확인 필요"); else if (!prods.some(p => p.excl)) add("R11", `연결 상품 ${prods.map(p => p.brand).join(", ")}은 단독 표시가 없어요`); }
      // R12
      const eth = hits(/뚱뚱|하체\s*비만|코끼리\s*다리|통통족|못생|팔뚝살|뱃살\s*(?:커버|가리)|살\s*쪄\s*보이는/g); if (eth.length) add("R12", `'${eth.join("', '")}'`);
      return { verdict: worst(H), H };
    }
    const hitsHtml = H => H.length ? H.map(h => `<div class="rule"><code>${h.c}</code><div><b>${esc(h.name)}</b> — ${esc(h.m)}<div style="color:var(--mute);font-size:11.5px">${esc(h.law || h.why || "")}</div></div><span class="t ${LVT[h.lv] || "blue"}">${h.lv}</span></div>`).join("") : '<p class="cap" style="margin:6px 0">걸린 규칙이 없어요 · 규칙 미탐지는 법적 승인이 아니에요</p>';

    /* =======================================================================
       ① 콘텐츠 제작 (Reboot 콘텐츠 탭: 시트 → 3안 → 부분 수정 → 검수 → 내 캠페인)
       ======================================================================= */
    const CT = {
      banner: { l: "기획전 배너", lim: { title: 16, body: 30, cta: 10 }, place: "banner", hint: "메인 카피 · 서브 카피 · 버튼" },
      md_comment: { l: "상품 MD 코멘트", lim: { title: 30, body: 300, cta: 40 }, place: "detail", hint: "상세페이지 상단 소개 · 사이즈 팁" },
      push: { l: "앱 푸시", lim: { title: 25, body: 60, cta: 12 }, place: "push", hint: "푸시 제목 · 본문 · 랜딩 버튼" },
      insta: { l: "인스타 캡션", lim: { title: 40, body: 400, cta: 40 }, place: "sns", hint: "첫 줄 훅 · 본문 · 해시태그" }
    };
    const GOALS = ["신규 고객 유입", "구매 전환", "단독 상품 강조", "시즌 전환(날씨)", "사이즈 불안 해소"], TONES = ["세련 · 간결", "친근", "정보형"];
    let cs = Object.assign({ type: "banner", pids: [], goal: "", tone: "세련 · 간결", theme: "", extra: "", count: 3 }, store.cs || {});
    let cres = store.cres || null, csub = "make", cbusy = false, cerr = "";
    const saveCs = () => { store.cs = cs; store.cres = cres; save(); };
    const selProds = () => PRODUCTS.filter(p => cs.pids.includes(p.id));
    function reviewVersion(v, type, prods) {
      const lim = CT[type].lim, txt = [v.title, v.body, v.cta, (v.hashtags || []).join(" ")].join("\n");
      const r = checkCopy(txt, { placement: CT[type].place, products: prods });
      ["title", "body", "cta"].forEach(k => { const n = [...(v[k] || "")].length; if (n > lim[k]) r.H.push({ c: "L01", name: "권장 길이 초과", lv: "확인 필요", law: "권장 길이는 임시값 — 실제 구좌 가이드로 바꿔 쓰기", m: `${({ title: "제목", body: "본문", cta: "버튼" })[k]} ${n}자 / 권장 ${lim[k]}자` }); });
      if (type === "md_comment") prods.forEach(p => { if (p.size && p.size["큼"] >= 30 && !/작게|한\s*치수|사이즈/.test(txt)) r.H.push({ c: "V01", name: "VOC 사이즈 팁 누락", lv: "확인 필요", law: "구매 리뷰 기반 (상품 · VOC 탭)", m: `${p.brand} 리뷰 '크게 나옴' ${p.size["큼"]}% — '한 치수 작게' 안내 권장` }); if (p.size && p.size["작음"] >= 15 && !/크게|한\s*치수|사이즈/.test(txt)) r.H.push({ c: "V01", name: "VOC 사이즈 팁 누락", lv: "확인 필요", law: "구매 리뷰 기반", m: `${p.brand} 리뷰 '작게 나옴' ${p.size["작음"]}% — '한 치수 크게' 안내 권장` }); });
      r.verdict = worst(r.H); return r;
    }
    const vText = v => [v.title, v.body, v.cta, (v.hashtags || []).join(" ")].filter(Boolean).join("\n");
    function vContent() {
      const camps = store.camps || [];
      const head = `<div class="ph"><h2>콘텐츠 제작</h2><span class="t urg">14:00</span><div class="when">${aiBadge()}</div></div>
      <p class="lead">기획전 배너 · MD 코멘트 · 앱 푸시 · 인스타 캡션을 고른 상품의 <b>실제 상품정보고시 · 구매 리뷰</b>만 근거로 3안 만들고, 표현 검수 규칙으로 바로 확인해요. Reboot 콘텐츠 탭의 '시트 → 3안 → 부분 수정 → 검수 → 내 캠페인' 흐름을 MD 업무에 맞게 옮겼어요.</p>
      ${seg("csub", [["make", "AI와 함께 만들기"], ["saved", `내 캠페인 ${camps.length}`]], csub)}`;
      if (csub === "saved") return head + (camps.length ? camps.map((c, i) => `<div class="card" style="margin-top:12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(CT[c.type].l)}</b><span class="t ${LVT[c.verdict]}">${c.verdict}</span><span class="cap">${esc(c.at)} · ${esc(c.target)}</span><button class="btn ghost" data-cp="${i}" style="margin-left:auto">복사</button><button class="btn ghost" data-del="${i}">삭제</button></div><pre class="copy" style="margin-top:8px">${esc(c.text)}</pre></div>`).join("") : '<div class="card" style="margin-top:12px"><p class="cap">아직 저장한 안이 없어요. 만들기에서 마음에 드는 안을 저장하세요.</p></div>');
      const prods = selProds(), t = CT[cs.type];
      const evRef = EVENTS.slice(0, 8).map(e => e[0] + (e[1] ? " " + e[1] : "")).filter((x, i, a) => a.indexOf(x) === i).slice(0, 5);
      const sheet = `<div class="card">
        <div class="field fs"><label>만들 콘텐츠</label>${seg("ctype", Object.entries(CT).map(([k, v]) => [k, v.l]), cs.type)}<div class="cap">${t.hint} · 권장 길이 제목 ${t.lim.title} · 본문 ${t.lim.body}자 (임시값)</div></div>
        <div class="field fs"><label>대상 상품 <span class="cap">최대 4개 · W컨셉 실제 상품</span></label><div class="pick">${PRODUCTS.map(p => `<label class="${cs.pids.includes(p.id) ? "on" : ""}"><input type="checkbox" data-pid="${p.id}" ${cs.pids.includes(p.id) ? "checked" : ""}> ${esc(p.brand)} · ${esc(p.name)}${p.excl ? ' <span class="t blue">단독</span>' : ""}</label>`).join("")}</div></div>
        <div class="field fs"><label>기획전 테마 <span class="cap">비워 두면 상품 중심</span></label><input class="inp" id="ctheme" value="${esc(cs.theme)}" placeholder="예: 첫 영하 주간 아우터"><div class="chips" style="margin-top:6px">${evRef.map(x => `<button class="tbtn" data-th="${esc(x)}">${esc(x)}</button>`).join("")}<span class="cap">← 지금 W컨셉 메인 배너 (참고)</span></div></div>
        <div class="field fs"><label>목적</label><div class="chips">${GOALS.map(g => `<button class="tbtn ${cs.goal === g ? "on" : ""}" data-goal="${g}">${g}</button>`).join("")}</div></div>
        <div class="field fs"><label>톤</label><div class="chips">${TONES.map(g => `<button class="tbtn ${cs.tone === g ? "on" : ""}" data-tone="${g}">${g}</button>`).join("")}</div></div>
        <div class="field fs"><label>혜택 · 추가 요청 <span class="cap">할인율 · 쿠폰은 여기 적은 값만 써요</span></label><textarea id="cextra" rows="2" placeholder="예: 더블유위크 20% 쿠폰, 11/19까지">${esc(cs.extra)}</textarea></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><button class="btn" id="cgo" ${aiReady() && !cbusy && (prods.length || cs.theme) ? "" : "disabled"}>${cbusy ? "만드는 중…" : `${cs.count}안 만들기`}</button>${!prods.length && !cs.theme ? '<span class="cap">상품이나 테마를 하나 이상 골라 주세요</span>' : ""}</div>
        ${cerr ? `<p class="note" style="color:var(--red)">${esc(cerr)}</p>` : ""}
      </div>`;
      const basis = `<div class="card"><h4>AI가 받는 근거 ${src("real")}</h4><p class="cap">이 값 밖의 소재 · 수치 · 혜택은 쓰지 않도록 지시해요</p>
        ${prods.length ? prods.map(p => { const r = revDelta(p); return `<div class="basis"><b>${esc(p.brand)} · ${esc(p.name)}</b>${p.excl ? ' <span class="t blue">단독</span>' : ""}<div>소재 ${esc(p.material)}</div><div>제조 ${esc(p.origin)}</div><div>★${p.rating} · 리뷰 ${fmt(p.cnt)}${r ? ` (+${r.d})` : ""} · 사이즈 작음 ${p.size["작음"]} · 적당 ${p.size["적당함"]} · 큼 ${p.size["큼"]}%</div></div>`; }).join("") : '<p class="cap">상품을 고르면 여기 표시돼요.</p>'}
        <div class="basis"><b>날씨</b> ${src("api", "Open-Meteo")}<div>${esc(weatherFact() || "—")}</div></div></div>`;
      let out = "";
      if (cres && cres.versions) {
        const rp = PRODUCTS.filter(p => (cres.pids || []).includes(p.id));
        out = `<div class="sec"><h3>결과 · ${esc(CT[cres.type].l)}</h3>${aiMeta(cres.meta)}<span class="hint right">${esc(cres.at)}</span></div>
        ${cres.memo ? `<p class="note">${esc(cres.memo)}</p>` : ""}
        <div class="grid g3">${cres.versions.map((v, i) => { const r = reviewVersion(v, cres.type, rp); return `<div class="card ver">
          <div style="display:flex;gap:6px;align-items:center"><b>${esc(v.label)}</b><span class="t ${LVT[r.verdict] || "green"}">${r.verdict}</span></div><div class="cap">${esc(v.angle)}</div>
          <div class="vt">${esc(v.title)}</div><div class="vb">${esc(v.body).replace(/\n/g, "<br>")}</div>${v.cta ? `<div class="vc">${esc(v.cta)}</div>` : ""}${(v.hashtags || []).length ? `<div class="cap">${esc(v.hashtags.join(" "))}</div>` : ""}
          <details><summary>검수 ${r.H.length}건 · 근거 ${(v.used_facts || []).length}개</summary>${hitsHtml(r.H)}${(v.used_facts || []).length ? `<ul class="uf">${v.used_facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}</details>
          <div style="display:flex;gap:6px;margin-top:8px"><button class="btn ghost" data-vcp="${i}">복사</button><button class="btn ghost" data-vsave="${i}">저장</button><button class="btn ghost" data-vchk="${i}">표현 검수로</button></div></div>`; }).join("")}</div>
        <div class="card" style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">부분 수정</b><input class="inp" id="crev" style="flex:1;min-width:220px" placeholder="예: B안만 더 짧게 · C안 버튼을 '코트 보러 가기'로"><button class="btn" id="crevgo" ${aiReady() && !cbusy ? "" : "disabled"}>수정</button></div>`;
      }
      return head + `<div class="grid g32" style="margin-top:12px">${sheet}${basis}</div>` + out;
    }
    async function runContent(mode, instruction) {
      cbusy = true; cerr = ""; rerender();
      const prods = mode === "draft" ? selProds() : PRODUCTS.filter(p => (cres.pids || []).includes(p.id));
      const type = mode === "draft" ? cs.type : cres.type;
      try {
        const j = await aiCall("content", { mode, sheet: mode === "draft" ? cs : cres.sheet, limits: CT[type].lim, facts: { products: prods.map(facts), weather: weatherFact(), today: TODAY }, versions: mode === "revise" ? cres.versions : undefined, instruction });
        cres = { type, pids: prods.map(p => p.id), sheet: mode === "draft" ? { ...cs } : cres.sheet, versions: j.versions || [], memo: j.memo, meta: j.meta, at: new Date().toLocaleString("ko-KR", { hour12: false }).slice(0, -3) };
      } catch (e) { cerr = e.message; }
      cbusy = false; saveCs(); rerender();
    }
    function afterContent() {
      bindSeg("csub", k => { csub = k; rerender(); });
      if (csub === "saved") {
        $$("[data-cp]").forEach(b => b.onclick = () => copy(store.camps[+b.dataset.cp].text));
        $$("[data-del]").forEach(b => b.onclick = () => { store.camps.splice(+b.dataset.del, 1); save(); rerender(); });
        return;
      }
      bindSeg("ctype", k => { cs.type = k; saveCs(); rerender(); });
      $$("[data-pid]").forEach(i => i.onchange = () => { const id = i.dataset.pid; if (i.checked) { if (cs.pids.length >= 4) { toast("상품은 4개까지 고를 수 있어요"); i.checked = false; return; } cs.pids.push(id); } else cs.pids = cs.pids.filter(x => x !== id); saveCs(); rerender(); });
      $("#ctheme").onchange = e => { cs.theme = e.target.value; saveCs(); rerender(); };
      $$("[data-th]").forEach(b => b.onclick = () => { cs.theme = b.dataset.th; saveCs(); rerender(); });
      $$("[data-goal]").forEach(b => b.onclick = () => { cs.goal = cs.goal === b.dataset.goal ? "" : b.dataset.goal; saveCs(); rerender(); });
      $$("[data-tone]").forEach(b => b.onclick = () => { cs.tone = b.dataset.tone; saveCs(); rerender(); });
      $("#cextra").onchange = e => { cs.extra = e.target.value; saveCs(); };
      const go = $("#cgo"); if (go) go.onclick = () => { cs.extra = $("#cextra").value; runContent("draft"); };
      const rv = $("#crevgo"); if (rv) rv.onclick = () => { const s = $("#crev").value.trim(); if (!s) { toast("무엇을 고칠지 적어 주세요"); return; } runContent("revise", s); };
      $$("[data-vcp]").forEach(b => b.onclick = () => copy(vText(cres.versions[+b.dataset.vcp])));
      $$("[data-vsave]").forEach(b => b.onclick = () => { const v = cres.versions[+b.dataset.vsave], rp = PRODUCTS.filter(p => (cres.pids || []).includes(p.id)); (store.camps = store.camps || []).unshift({ type: cres.type, text: vText(v), verdict: reviewVersion(v, cres.type, rp).verdict, at: cres.at, target: rp.map(p => p.brand).join(", ") || cres.sheet.theme || "-" }); save(); toast("내 캠페인에 저장했어요"); rerender(); });
      $$("[data-vchk]").forEach(b => b.onclick = () => { const v = cres.versions[+b.dataset.vchk]; cp = Object.assign(cp, { text: vText(v), place: CT[cres.type].place, pid: (cres.pids || [])[0] || "" }); store.cp = cp; save(); cpRes = null; location.hash = "comply"; });
    }

    /* =======================================================================
       ② 표현 검수 (Reboot 컴플라이언스: 단건 · 일괄 · 규칙 · 점검 기록 + AI 2차 검토)
       ======================================================================= */
    const PLACES = [["banner", "기획전 배너"], ["detail", "상세 · MD 코멘트"], ["name", "상품명"], ["push", "앱 푸시"], ["sns", "SNS · 인플루언서"]];
    let cp = Object.assign({ text: "", place: "banner", pid: "", list: "", sale: "" }, store.cp || {});
    let cpsub = "one", cpRes = null, cpBusy = false, cpErr = "", batch = store.cpBatch || "";
    const cpOpt = () => ({ placement: cp.place, products: PRODUCTS.filter(p => p.id === cp.pid), price: { list: +String(cp.list).replace(/[^\d]/g, ""), sale: +String(cp.sale).replace(/[^\d]/g, "") } });
    const EXAMPLES = [
      ["연습용 · 위반 예시", "[역대급 최저가] 명품st 캐시미어 코트, 오늘만 70% 할인! 하체비만도 완벽 커버 · 이탈리아 생산"],
      ["연습용 · 인플루언서 예시", "셀럽 OO의 겨울 PICK 🧥 따뜻함은 기본, 체형 커버까지"],
      ["연습용 · 무난한 예시", "첫 영하 주간, 손이 먼저 가는 아우터 — 더블유위크 쿠폰으로 지금 만나 보세요"]
    ];
    function vComply() {
      const hist = store.cpHist || [];
      const head = `<div class="ph"><h2>표현 검수</h2><span class="t urg">14:30</span><div class="when">${aiBadge()}</div></div>
      <p class="lead">배너 · 상세 · 푸시 · SNS 문구를 올리기 전에 규칙 ${CR.length}개로 1차 검수해요. 상품을 연결하면 W컨셉 상품정보고시(소재 · 제조국 · 단독)와 대조하고, 정가 · 판매가를 넣으면 할인율을 계산해 맞춰 봐요. Reboot 컴플라이언스의 '규칙이 판정 · AI는 2차 의견' 구조를 한국 패션 이커머스 기준으로 바꿨어요.</p>
      <p class="note">1차 참고용이에요. 법률 자문이 아니고, '통과(규칙 미탐지)'는 법적 승인이 아니에요. 최종 게시는 MD · 법무가 결정해요.</p>
      ${seg("cpsub", [["one", "단건 검수"], ["batch", "일괄 검수"], ["rules", `규칙 ${CR.length}`], ["hist", `점검 기록 ${hist.length}`]], cpsub)}`;
      if (cpsub === "rules") return head + `<div style="margin-top:12px">${table(["코드", "규칙", "기본 판정", "확인하는 것", "관련 기준(참고)"], CR.map(r => `<tr><td><code>${r[0]}</code></td><td><b>${r[1]}</b></td><td><span class="t ${LVT[r[2]]}">${r[2]}</span></td><td style="font-size:12.5px">${r[4]}</td><td style="font-size:12px;color:var(--ink-2)">${LAW[r[3]]}</td></tr>`))}</div>
        <p class="cap" style="margin-top:8px">판정 단계: 통과 → 확인 필요 → 수정 요청 → 등록 불가 (Reboot PASS · REVIEW · REVISE · BLOCK과 같은 체계). 법령 이름은 참고용이며 조문 확인은 법무 검토 대상이에요.</p>`;
      if (cpsub === "hist") return head + (hist.length ? `<div style="margin-top:12px">${table(["시각", "위치", "문구", "판정", "걸린 규칙"], hist.map(h => `<tr><td style="white-space:nowrap">${esc(h.at)}</td><td>${esc((PLACES.find(p => p[0] === h.place) || [0, "-"])[1])}</td><td style="font-size:12.5px">${esc(h.text.slice(0, 80))}${h.text.length > 80 ? "…" : ""}</td><td><span class="t ${LVT[h.verdict]}">${h.verdict}</span></td><td><code>${esc(h.codes)}</code></td></tr>`))}</div><button class="btn ghost" id="cpclr" style="margin-top:8px">기록 지우기</button>` : '<div class="card" style="margin-top:12px"><p class="cap">아직 점검 기록이 없어요.</p></div>');
      if (cpsub === "batch") {
        const lines = batch.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 200);
        const res = lines.map(l => { const m = l.match(/^(banner|detail|name|push|sns)\s*[,\t|]\s*(.+)$/i); const place = m ? m[1].toLowerCase() : "banner", text = m ? m[2] : l; return { place, text, r: checkCopy(text, { placement: place }) }; });
        const cnt = k => res.filter(x => x.r.verdict === k).length;
        return head + `<div class="card" style="margin-top:12px"><div class="field fs"><label>한 줄에 문구 하나 <span class="cap">앞에 위치를 붙이면 그 기준으로 검수 (예: <code>sns, 셀럽 OO의 PICK</code>) · 최대 200줄</span></label><textarea id="bt" rows="7" placeholder="banner, 첫 영하 주간 아우터 최대 60%\npush, 오늘만! 품절 임박 코트">${esc(batch)}</textarea></div><div style="display:flex;gap:8px"><button class="btn" id="btgo">검수</button>${res.length ? '<button class="btn ghost" id="btcsv">결과 CSV</button>' : ""}</div><p class="cap">일괄 검수는 상품 연결 없이 규칙만 적용해요 (소재 · 제조국 · 단독은 '확인 필요'로 표시).</p></div>
        ${res.length ? `<div class="grid g4" style="margin-top:12px">${["통과", "확인 필요", "수정 요청", "등록 불가"].map(k => `<div class="kpi"><div class="k">${k}</div><div class="v">${cnt(k)}<small>건</small></div></div>`).join("")}</div>
        <div style="margin-top:12px">${table(["#", "위치", "문구", "판정", "걸린 규칙"], res.map((x, i) => `<tr><td>${i + 1}</td><td>${esc((PLACES.find(p => p[0] === x.place) || [0, x.place])[1])}</td><td style="font-size:12.5px">${esc(x.text)}</td><td><span class="t ${LVT[x.r.verdict]}">${x.r.verdict}</span></td><td style="font-size:12px">${x.r.H.map(h => `<code>${h.c}</code> ${esc(h.name)}`).join("<br>") || "—"}</td></tr>`))}</div>` : ""}`;
      }
      const opt = cpOpt(), r = cp.text.trim() ? checkCopy(cp.text, opt) : null, pr = opt.products[0];
      const real = opt.price.list > 0 && opt.price.sale > 0 && opt.price.sale < opt.price.list ? Math.round((1 - opt.price.sale / opt.price.list) * 100) : null;
      return head + `<div class="grid g2" style="margin-top:12px">
        <div class="card">
          <div class="field fs"><label>예시 불러오기</label><select id="cpex"><option value="">— 직접 입력 —</option>${EXAMPLES.map((e, i) => `<option value="${i}">${esc(e[0])}</option>`).join("")}</select></div>
          <div class="field fs"><label>문구</label><textarea id="cptext" rows="4" placeholder="검수할 문구를 붙여 넣으세요">${esc(cp.text)}</textarea></div>
          <div class="field fs"><label>노출 위치</label>${seg("cpplace", PLACES, cp.place)}</div>
          <div class="field fs"><label>연결 상품 <span class="cap">고시 · 단독 대조</span></label><select id="cppid"><option value="">— 연결 안 함 —</option>${PRODUCTS.map(p => `<option value="${p.id}" ${cp.pid === p.id ? "selected" : ""}>${esc(p.brand)} · ${esc(p.name)}</option>`).join("")}</select>${pr ? `<div class="cap" style="margin-top:4px">${src("real")} 소재 ${esc(pr.material)} · 제조 ${esc(pr.origin)}${pr.excl ? " · 단독" : ""}</div>` : ""}</div>
          <div class="field fs"><label>정가 · 판매가 <span class="cap">선택 · 할인율 대조</span></label><div style="display:flex;gap:6px;align-items:center"><input class="inp" id="cplist" inputmode="numeric" placeholder="정가" value="${esc(cp.list)}"><input class="inp" id="cpsale" inputmode="numeric" placeholder="판매가" value="${esc(cp.sale)}">${real != null ? `<span class="t ref">실제 ${real}%</span>` : ""}</div></div>
          <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="cpgo">검수</button><button class="btn ghost" id="cpai" ${r && aiReady() && !cpBusy ? "" : "disabled"}>${cpBusy ? "AI 검토 중…" : "AI 2차 검토"}</button></div>
        </div>
        <div class="card">${r ? `<div style="display:flex;gap:10px;align-items:center"><h4 style="margin:0">판정</h4><span class="t ${LVT[r.verdict]}" style="font-size:14px">${r.verdict}</span><span class="cap">규칙 ${r.H.length}건</span></div>
          ${hitsHtml(r.H)}
          ${r.H.length ? '<button class="btn ghost" id="cpreq" style="margin-top:10px">브랜드 수정 요청문 복사</button>' : ""}
          ${cpErr ? `<p class="note" style="color:var(--red)">${esc(cpErr)}</p>` : ""}
          ${cpRes ? `<div class="aibox"><div style="display:flex;gap:6px;align-items:center"><b>AI 2차 의견</b>${aiMeta(cpRes.meta)}</div><p style="margin:6px 0;font-size:13px">${esc(cpRes.summary)}</p>${(cpRes.issues || []).map(x => `<div class="rule"><code>AI</code><div><b>“${esc(x.quote)}”</b> — ${esc(x.concern)}<div style="color:var(--ink-2);font-size:12px">→ ${esc(x.suggestion)}</div></div><span class="t ${LVT[x.level] || "blue"}">${x.level}</span></div>`).join("")}${cpRes.rewrite ? `<div class="field fs"><label>수정 문구 제안</label><pre class="copy">${esc(cpRes.rewrite)}</pre><button class="btn ghost" id="cprw">수정 문구 복사</button></div>` : ""}<p class="cap">AI 의견은 판정을 바꾸지 않아요. 최종 판단은 사람이 해요.</p></div>` : ""}`
          : '<p class="cap">문구를 넣고 검수를 누르세요.</p>'}</div></div>`;
    }
    function afterComply() {
      bindSeg("cpsub", k => { cpsub = k; rerender(); });
      if (cpsub === "hist") { const b = $("#cpclr"); if (b) b.onclick = () => { store.cpHist = []; save(); rerender(); }; return; }
      if (cpsub === "rules") return;
      if (cpsub === "batch") {
        $("#btgo").onclick = () => { batch = $("#bt").value; store.cpBatch = batch; save(); rerender(); };
        const c = $("#btcsv"); if (c) c.onclick = () => { const rows = batch.split(/\n/).map(s => s.trim()).filter(Boolean).map(l => { const m = l.match(/^(banner|detail|name|push|sns)\s*[,\t|]\s*(.+)$/i); const place = m ? m[1].toLowerCase() : "banner", text = m ? m[2] : l, r = checkCopy(text, { placement: place }); return [place, text, r.verdict, r.H.map(h => h.c + " " + h.name).join(" / ")]; }); dl("fmd-compliance-batch.csv", [["위치", "문구", "판정", "걸린 규칙"], ...rows]); };
        return;
      }
      const sync = () => { cp.text = $("#cptext").value; cp.list = $("#cplist").value; cp.sale = $("#cpsale").value; cp.pid = $("#cppid").value; store.cp = cp; save(); };
      $("#cpex").onchange = e => { if (e.target.value === "") return; cp.text = EXAMPLES[+e.target.value][1]; cp.place = +e.target.value === 1 ? "sns" : "banner"; cpRes = null; store.cp = cp; save(); rerender(); };
      bindSeg("cpplace", k => { sync(); cp.place = k; store.cp = cp; save(); rerender(); });
      $("#cppid").onchange = () => { sync(); rerender(); };
      ["#cplist", "#cpsale"].forEach(s => $(s).onchange = () => { sync(); rerender(); });
      $("#cpgo").onclick = () => { sync(); cpRes = null; cpErr = ""; const r = checkCopy(cp.text, cpOpt()); if (cp.text.trim()) { (store.cpHist = store.cpHist || []).unshift({ at: new Date().toLocaleString("ko-KR", { hour12: false }).slice(0, -3), place: cp.place, text: cp.text, verdict: r.verdict, codes: r.H.map(h => h.c).join(" ") || "—" }); store.cpHist = store.cpHist.slice(0, 50); save(); } rerender(); };
      const ai = $("#cpai"); if (ai) ai.onclick = async () => { sync(); cpBusy = true; cpErr = ""; rerender(); const o = cpOpt(), r = checkCopy(cp.text, o); try { cpRes = await aiCall("comply", { data: { text: cp.text, placement: (PLACES.find(p => p[0] === cp.place) || [])[1], rule_hits: r.H.map(h => ({ code: h.c, name: h.name, level: h.lv, detail: h.m })), facts: o.products.map(facts), price: o.price } }); } catch (e) { cpErr = e.message; } cpBusy = false; rerender(); };
      const rq = $("#cpreq"); if (rq) rq.onclick = () => { const r = checkCopy(cp.text, cpOpt()); copy(`[문구 수정 요청] ${(PLACES.find(p => p[0] === cp.place) || [])[1]}\n\n원문: ${cp.text}\n\n아래 표현 수정 부탁드립니다.\n${r.H.map((h, i) => `${i + 1}. (${h.lv}) ${h.name}: ${h.m}`).join("\n")}\n\n노출 일정이 있어 ${md(addD(TODAY, 1))}까지 회신 주시면 바로 확인하겠습니다.`, "수정 요청문을 복사했어요"); };
      const rw = $("#cprw"); if (rw) rw.onclick = () => copy(cpRes.rewrite, "수정 문구를 복사했어요");
    }
    function dl(name, rows) { const csv = "﻿" + rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

    /* =======================================================================
       ③ 성과 분석 + 보고서 (Reboot 성과분석: CSV → 지표 · 차트 · 잘한 점/개선할 점 · AI 제안 · A4 보고서)
       ======================================================================= */
    const HEAD = ["날짜", "브랜드", "기획전", "노출수", "클릭수", "주문수", "매출", "할인금액", "쿠폰비용"];
    let PD = store.perf || null, pr = store.perfPr || null, psub = "analyze", pgroup = "브랜드", pAI = store.perfAI || null, pBusy = false, pErr = "", pSel = [];
    function parseCSV(text) {
      const rows = [], re = /("([^"]|"")*"|[^,\r\n]*)(,|\r?\n|$)/g; let row = [], m;
      text = text.replace(/^﻿/, "");
      while ((m = re.exec(text)) && m[0] !== "") { let v = m[1]; if (/^"/.test(v)) v = v.slice(1, -1).replace(/""/g, '"'); row.push(v.trim()); if (m[3] !== ",") { rows.push(row); row = []; } if (m.index === re.lastIndex) re.lastIndex++; }
      if (row.length) rows.push(row);
      return rows.filter(r => r.some(Boolean));
    }
    const num = v => +String(v || "0").replace(/[^\d.-]/g, "") || 0;
    const nd = v => { const m = String(v).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null; };
    function loadCSV(text, name) {
      const rows = parseCSV(text); if (!rows.length) throw new Error("빈 파일이에요.");
      const h = rows[0].map(s => s.replace(/\s/g, "")), idx = HEAD.map(k => h.indexOf(k));
      const miss = HEAD.filter((k, i) => idx[i] < 0 && k !== "기획전" && k !== "할인금액" && k !== "쿠폰비용"); if (miss.length) throw new Error(`필수 열이 없어요: ${miss.join(", ")} · 빈 양식을 받아 형식을 맞춰 주세요.`);
      const out = rows.slice(1).map(r => { const g = k => { const i = idx[HEAD.indexOf(k)]; return i < 0 ? "" : r[i]; }; return { d: nd(g("날짜")), b: g("브랜드") || "(미지정)", e: g("기획전") || "", imp: num(g("노출수")), clk: num(g("클릭수")), ord: num(g("주문수")), rev: num(g("매출")), disc: num(g("할인금액")), cpn: num(g("쿠폰비용")) }; }).filter(r => r.d);
      if (!out.length) throw new Error("날짜를 읽을 수 있는 행이 없어요 (예: 2026-11-10).");
      return { rows: out, name, fake: false };
    }
    function practice() {
      let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const B = [["브랜드 A", 150000, 0.032, 1], ["브랜드 B", 98000, 0.028, 1.6], ["브랜드 C", 210000, 0.022, 1], ["브랜드 D", 72000, 0.041, 0.9], ["브랜드 E", 128000, 0.03, 1], ["브랜드 F", 185000, 0.019, 1.1]];
      const EV = ["더블유위크", "24시간 특가", "신상 기획전", ""], rows = [], end = addD(TODAY, -1);
      for (let i = 27; i >= 0; i--) { const d = addD(end, -i), late = i < 7; B.forEach(([b, aov, cvr, g], k) => { const imp = Math.round((18000 + rnd() * 50000) * (late && k === 1 ? g : 1)); const clk = Math.round(imp * (0.025 + rnd() * 0.025)); const c = cvr * (late && k === 4 ? 0.62 : 1) * (0.85 + rnd() * 0.3); const ord = Math.round(clk * c); const rev = Math.round(ord * aov * (0.9 + rnd() * 0.2) / 100) * 100; const e = EV[(k + i) % 4]; rows.push({ d, b, e, imp, clk, ord, rev, disc: Math.round(rev * (0.18 + rnd() * 0.15) / 100) * 100, cpn: Math.round(rev * (k === 5 ? 0.14 : 0.05 + rnd() * 0.04) / 100) * 100 }); }); }
      return { rows, name: "연습용 가상 데이터 (브랜드 A~F)", fake: true };
    }
    const agg = rows => { const a = { imp: 0, clk: 0, ord: 0, rev: 0, disc: 0, cpn: 0 }; rows.forEach(r => { for (const k in a) a[k] += r[k]; }); a.ctr = a.imp ? a.clk / a.imp : 0; a.cvr = a.clk ? a.ord / a.clk : 0; a.aov = a.ord ? a.rev / a.ord : 0; a.cpr = a.rev ? a.cpn / a.rev : 0; a.dr = a.rev + a.disc ? a.disc / (a.rev + a.disc) : 0; return a; };
    function periods() {
      const ds = [...new Set(PD.rows.map(r => r.d))].sort(), min = ds[0], max = ds[ds.length - 1];
      let s = pr && pr.s >= min && pr.s <= max ? pr.s : addD(max, -6), e = pr && pr.e >= min && pr.e <= max ? pr.e : max; if (s < min) s = min; if (e < s) e = s;
      const len = Math.round((new Date(e) - new Date(s)) / 864e5) + 1, ps = addD(s, -len), pe = addD(s, -1);
      return { s, e, len, ps, pe, min, max, prevOk: ps >= min, label: len === 7 ? "전주 대비" : "직전 기간 대비" };
    }
    function perfCalc() {
      const T = periods(), cur = PD.rows.filter(r => r.d >= T.s && r.d <= T.e), prev = T.prevOk ? PD.rows.filter(r => r.d >= T.ps && r.d <= T.pe) : [];
      const A = agg(cur), B = T.prevOk ? agg(prev) : null;
      const keyOf = r => pgroup === "브랜드" ? r.b : (r.e || "(기획전 없음)");
      const keys = [...new Set(cur.map(keyOf))];
      const G = keys.map(k => { const a = agg(cur.filter(r => keyOf(r) === k)), b = T.prevOk ? agg(prev.filter(r => keyOf(r) === k)) : null; return { k, a, b, dRev: b && b.rev ? a.rev / b.rev - 1 : null, share: A.rev ? a.rev / A.rev : 0 }; }).sort((x, y) => y.a.rev - x.a.rev);
      const BR = [...new Set(cur.map(r => r.b))].map(k => { const a = agg(cur.filter(r => r.b === k)), b = T.prevOk ? agg(prev.filter(r => r.b === k)) : null; return { k, a, b, dRev: b && b.rev ? a.rev / b.rev - 1 : null }; });
      const pts = [];
      if (B) pts.push({ g: A.rev >= B.rev ? "good" : "bad", t: `전체 매출 ${won(A.rev)} (${T.label} ${sign(A.rev / B.rev - 1)}) · 주문 ${fmt(A.ord)}건 · CVR ${pct(A.cvr, 2)}` });
      const up = BR.filter(x => x.dRev != null).sort((a, b) => b.dRev - a.dRev);
      if (up[0] && up[0].dRev > 0.1) pts.push({ g: "good", t: `${up[0].k} 매출 ${sign(up[0].dRev)} (${won(up[0].b.rev)} → ${won(up[0].a.rev)}) — 노출 ${sign(up[0].b.imp ? up[0].a.imp / up[0].b.imp - 1 : 0)}` });
      const dn = up[up.length - 1]; if (dn && dn.dRev < -0.1) pts.push({ g: "bad", t: `${dn.k} 매출 ${sign(dn.dRev)} — CVR ${pct(dn.b.cvr, 2)} → ${pct(dn.a.cvr, 2)}${dn.a.cvr < dn.b.cvr * 0.8 ? " (전환 하락이 원인일 수 있음 → 상세페이지 · 사이즈 안내 · 가격 확인)" : ""}` });
      const lowCvr = BR.filter(x => x.a.clk > 200).sort((a, b) => a.a.cvr - b.a.cvr)[0]; if (lowCvr && lowCvr.a.cvr < A.cvr * 0.75) pts.push({ g: "bad", t: `${lowCvr.k} CVR ${pct(lowCvr.a.cvr, 2)} — 전체 평균 ${pct(A.cvr, 2)}의 ${pct(lowCvr.a.cvr / A.cvr)}` });
      const hiC = BR.filter(x => x.a.rev > 0).sort((a, b) => b.a.cpr - a.a.cpr)[0]; if (hiC && hiC.a.cpr > A.cpr * 1.5) pts.push({ g: "bad", t: `${hiC.k} 쿠폰비용률 ${pct(hiC.a.cpr, 1)} — 전체 ${pct(A.cpr, 1)}보다 높음 (쿠폰 효율 · 분담 조건 확인)` });
      const EVG = [...new Set(cur.map(r => r.e).filter(Boolean))].map(k => ({ k, a: agg(cur.filter(r => r.e === k)) })).sort((a, b) => b.a.cvr - a.a.cvr);
      if (EVG.length > 1) pts.push({ g: "good", t: `기획전 CVR 1위 '${EVG[0].k}' ${pct(EVG[0].a.cvr, 2)} · 최하 '${EVG[EVG.length - 1].k}' ${pct(EVG[EVG.length - 1].a.cvr, 2)}` });
      return { T, A, B, G, BR, pts, cur };
    }
    const won = n => { const a = Math.abs(n); if (a >= 1e8) return (n / 1e8).toFixed(2) + "억"; if (a >= 1e4) return fmt(n / 1e4) + "만"; return fmt(n) + "원"; };
    function kpis(R) {
      const k = [["매출", R.A.rev, R.B && R.B.rev, won, 1], ["주문수", R.A.ord, R.B && R.B.ord, v => fmt(v) + "건", 1], ["객단가", R.A.aov, R.B && R.B.aov, won, 1], ["CVR (주문/클릭)", R.A.cvr, R.B && R.B.cvr, v => pct(v, 2), 2], ["CTR (클릭/노출)", R.A.ctr, R.B && R.B.ctr, v => pct(v, 2), 2], ["쿠폰비용률", R.A.cpr, R.B && R.B.cpr, v => pct(v, 1), -2]];
      return k.map(([l, a, b, f, mode]) => { let d = "비교 데이터 없음", cls = ""; if (b != null && b) { const r = Math.abs(mode) === 2 ? a - b : a / b - 1; d = `${R.T.label} ${Math.abs(mode) === 2 ? pp(r) : sign(r)}`; cls = (mode > 0 ? r >= 0 : r <= 0) ? "up" : "down"; } return { l, v: f(a), d, cls }; });
    }
    const fakeBanner = () => PD && PD.fake ? '<div class="fake">연습용 가상 데이터예요 — 브랜드 A~F는 실제 브랜드가 아니고 숫자도 만든 값이에요. 실제 분석은 사내 데이터 CSV를 올려 주세요.</div>' : "";
    function vPerf() {
      const head = `<div class="ph"><h2>성과 분석</h2><span class="t urg">17:00</span><div class="when">${aiBadge()}</div></div>
      <p class="lead">브랜드 · 기획전별 노출 · 클릭 · 주문 · 매출 CSV를 올리면 지표, 비교 기간 증감, 차트, 잘한 점 · 개선할 점, 다음 주 실행 과제를 만들고 A4 보고서로 뽑아요. 판매 데이터는 공개되지 않아 직접 올리는 방식이에요. Reboot 성과분석(채널별 광고비 · 매출 → ROAS · 예산 제안)을 MD 지표(CVR · 객단가 · 쿠폰비용률)로 바꿨어요.</p>
      <div class="card no-print" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="btn" style="cursor:pointer">CSV 올리기<input type="file" id="pf" accept=".csv,text/csv" hidden></label><button class="btn ghost" id="ptpl">빈 양식 CSV</button><button class="btn ghost" id="pfake">연습용 가상 데이터로 보기</button>${PD ? `<span class="cap">${esc(PD.name)} · ${fmt(PD.rows.length)}행</span><button class="btn ghost" id="pclr">데이터 지우기</button>` : ""}</div>
      ${pErr ? `<p class="note" style="color:var(--red)">${esc(pErr)}</p>` : ""}`;
      if (!PD) return head + `<div class="card" style="margin-top:12px"><h4>CSV 형식</h4><pre class="copy">${HEAD.join(",")}\n2026-11-10,브랜드명,더블유위크,52000,1300,42,8260000,1520000,410000</pre><p class="cap">기획전 · 할인금액 · 쿠폰비용은 비워도 돼요. 날짜는 2026-11-10 · 2026/11/10 · 2026.11.10 모두 읽어요. 파일은 브라우저 안에서만 읽고 어디에도 보내지 않아요 (AI 제안을 누를 때만 합계 지표가 로컬 서버로 가요).</p></div>`;
      const R = perfCalc(), T = R.T;
      const ctl = `<div class="card no-print" style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">기간</b><input type="date" class="inp" id="ps" value="${T.s}" min="${T.min}" max="${T.max}" style="width:auto"> ~ <input type="date" class="inp" id="pe" value="${T.e}" min="${T.min}" max="${T.max}" style="width:auto"><button class="btn ghost" id="p7">최근 7일</button><span class="cap">비교 ${T.prevOk ? `${md(T.ps)}~${md(T.pe)} (${T.label})` : "— 데이터가 부족해 비교하지 않아요"}</span>${seg("psub", [["analyze", "분석"], ["report", "보고서 (A4 · PDF)"]], psub)}</div>`;
      const K = kpis(R);
      const aiBlock = `<div class="card"><div style="display:flex;gap:8px;align-items:center"><h4 style="margin:0">AI 제안 · 다음 주 실행 과제</h4>${pAI ? aiMeta(pAI.meta) : ""}<button class="btn ghost no-print" id="pai" style="margin-left:auto" ${aiReady() && !pBusy ? "" : "disabled"}>${pBusy ? "만드는 중…" : pAI ? "다시 만들기" : "AI 제안 받기"}</button></div>
        ${pAI && pAI.key === T.s + T.e + PD.name ? `<p style="font-size:13px">${esc(pAI.summary)}</p><div class="grid g2"><div><b style="font-size:12.5px">잘한 점</b><ul class="uf">${pAI.good.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div><b style="font-size:12.5px">개선할 점</b><ul class="uf">${pAI.improve.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>${pAI.actions.map(a => `<div class="todo"><span class="t opp">${esc(a.when)}</span><div><b>${esc(a.title)}</b><div class="why">${esc(a.why)}</div></div></div>`).join("")}`
          : `<p class="cap">${aiReady() ? "규칙이 뽑은 사실(왼쪽)과 지표만 보내 문장 · 실행 과제를 받아요." : "AI가 꺼져 있어도 규칙 기준 잘한 점 · 개선할 점은 그대로 보여요."}</p>`}
        ${pErr && pBusy === false && /AI/.test(pErr) ? "" : ""}</div>`;
      const pts = `<div class="card"><h4>잘한 점 · 개선할 점 <span class="cap">규칙 기준</span></h4>${R.pts.map(p => `<div class="todo"><span class="t ${p.g === "good" ? "green" : "amber"}">${p.g === "good" ? "잘한 점" : "개선"}</span><div>${esc(p.t)}</div></div>`).join("") || '<p class="cap">비교할 데이터가 부족해요.</p>'}</div>`;
      if (psub === "report") {
        return head + ctl + `<div class="a4">${fakeBanner()}<div class="a4h"><div><div class="cap">패션 온라인MD · 주간 성과 보고서</div><h2 style="margin:4px 0 0;font-family:var(--slab)">${md(T.s)} ~ ${md(T.e)} 성과</h2></div><div class="cap" style="text-align:right">작성 ${TODAY} · 강현서<br>비교 ${T.prevOk ? `${md(T.ps)}~${md(T.pe)}` : "없음"}<br>데이터 ${esc(PD.name)}</div></div>
          <div class="grid g3" style="margin:14px 0">${K.map(k => `<div class="kpi"><div class="k">${k.l}</div><div class="v">${k.v}</div><div class="s ${k.cls}">${k.d}</div></div>`).join("")}</div>
          <h4>${pgroup}별 성과</h4>${table([pgroup, "#매출", "#증감", "#비중", "#주문", "#CVR", "#객단가", "#쿠폰비용률"], R.G.slice(0, 12).map(g => `<tr><td><b>${esc(g.k)}</b></td><td class="num">${won(g.a.rev)}</td><td class="num">${g.dRev == null ? "—" : sign(g.dRev)}</td><td class="num">${pct(g.share, 1)}</td><td class="num">${fmt(g.a.ord)}</td><td class="num">${pct(g.a.cvr, 2)}</td><td class="num">${won(g.a.aov)}</td><td class="num">${pct(g.a.cpr, 1)}</td></tr>`))}
          <div class="grid g2" style="margin-top:14px">${pts}${aiBlock}</div>
          <p class="cap" style="margin-top:12px">※ 지표 정의: CVR = 주문수 ÷ 클릭수 · CTR = 클릭수 ÷ 노출수 · 객단가 = 매출 ÷ 주문수 · 쿠폰비용률 = 쿠폰비용 ÷ 매출. 비교 기간은 고른 기간 바로 앞의 같은 길이.</p></div>
          <button class="btn no-print" onclick="window.print()" style="margin-top:12px">인쇄 · PDF로 저장</button>`;
      }
      return head + ctl + fakeBanner() + `<div class="grid g3" style="margin-top:12px">${K.map(k => `<div class="kpi"><div class="k">${k.l}</div><div class="v">${k.v}</div><div class="s ${k.cls}">${k.d}</div></div>`).join("")}</div>
        <div class="sec"><h3>${pgroup}별 성과</h3>${PD.fake ? '<span class="src calc">가상</span>' : src("calc", "업로드 CSV")}<div class="right">${seg("pgroup", [["브랜드", "브랜드"], ["기획전", "기획전"]], pgroup)}</div></div>
        ${table([pgroup, "#매출", "#증감", "#비중", "#노출", "#CTR", "#주문", "#CVR", "#객단가", "#쿠폰비용률"], R.G.map(g => `<tr class="click ${pSel.includes(g.k) ? "sel" : ""}" data-g="${esc(g.k)}"><td><b>${esc(g.k)}</b></td><td class="num">${won(g.a.rev)}</td><td class="num ${g.dRev > 0 ? "up" : g.dRev < 0 ? "down" : ""}">${g.dRev == null ? "—" : sign(g.dRev)}</td><td class="num">${pct(g.share, 1)}</td><td class="num">${fmt(g.a.imp)}</td><td class="num">${pct(g.a.ctr, 2)}</td><td class="num">${fmt(g.a.ord)}</td><td class="num">${pct(g.a.cvr, 2)}</td><td class="num">${won(g.a.aov)}</td><td class="num">${pct(g.a.cpr, 1)}</td></tr>`))}
        <p class="cap">행을 누르면 아래 일별 추이에 그 ${pgroup}만 표시돼요 (여러 개 선택 가능).</p>
        <div class="grid g2" style="margin-top:8px"><div class="card"><h4>${pgroup}별 매출 · 이번 vs 비교 기간</h4><div class="chart" style="height:260px"><canvas id="pc1"></canvas></div></div><div class="card"><h4>일별 매출 추이</h4><div class="chart" style="height:260px"><canvas id="pc2"></canvas></div></div></div>
        <div class="grid g2" style="margin-top:12px">${pts}${aiBlock}</div>`;
    }
    const PAL = ["#151515", "#2f6fde", "#d9480f", "#2b8a3e", "#9c36b5", "#868e96"];
    function afterPerf() {
      $("#pf").onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { PD = loadCSV(rd.result, f.name); pErr = ""; pr = null; pAI = null; store.perf = PD; store.perfAI = null; save(); } catch (er) { pErr = er.message; } rerender(); }; rd.readAsText(f, "utf-8"); };
      $("#ptpl").onclick = () => dl("fmd-performance-template.csv", [HEAD]);
      $("#pfake").onclick = () => { PD = practice(); pr = null; pAI = null; pErr = ""; store.perf = PD; store.perfAI = null; save(); rerender(); };
      const c = $("#pclr"); if (c) c.onclick = () => { PD = null; pAI = null; store.perf = null; store.perfAI = null; save(); rerender(); };
      if (!PD) return;
      const setP = () => { pr = { s: $("#ps").value, e: $("#pe").value }; store.perfPr = pr; save(); rerender(); };
      $("#ps").onchange = setP; $("#pe").onchange = setP; $("#p7").onclick = () => { pr = null; store.perfPr = null; save(); rerender(); };
      bindSeg("psub", k => { psub = k; rerender(); });
      bindSeg("pgroup", k => { pgroup = k; pSel = []; rerender(); });
      $$("tr[data-g]").forEach(tr => tr.onclick = () => { const k = tr.dataset.g; pSel = pSel.includes(k) ? pSel.filter(x => x !== k) : [...pSel, k]; rerender(); });
      const R = perfCalc();
      const ai = $("#pai"); if (ai) ai.onclick = async () => { pBusy = true; pErr = ""; rerender(); try { const j = await aiCall("perf", { data: { period: `${R.T.s}~${R.T.e}`, compare: R.T.prevOk ? `${R.T.ps}~${R.T.pe}` : "없음", data_note: PD.fake ? "연습용 가상 데이터" : "업로드한 사내 데이터", kpis: kpis(R).map(k => `${k.l} ${k.v} (${k.d})`), brands: R.BR.map(b => ({ brand: b.k, rev: Math.round(b.a.rev), rev_change: b.dRev == null ? null : sign(b.dRev), orders: b.a.ord, cvr: pct(b.a.cvr, 2), aov: Math.round(b.a.aov), coupon_rate: pct(b.a.cpr, 1) })), rule_points: R.pts.map(p => p.t) } }); pAI = { ...j, key: R.T.s + R.T.e + PD.name }; store.perfAI = pAI; save(); } catch (e) { pErr = e.message; } pBusy = false; rerender(); };
      if (psub === "report") return;
      const G = R.G.slice(0, 10);
      chart("pc1", { type: "bar", data: { labels: G.map(g => g.k), datasets: [{ label: "이번 기간", data: G.map(g => g.a.rev), backgroundColor: "#151515", borderRadius: 4 }, ...(R.T.prevOk ? [{ label: "비교 기간", data: G.map(g => g.b ? g.b.rev : 0), backgroundColor: "#c9c9c9", borderRadius: 4 }] : [])] }, options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => `${c.dataset.label} ${won(c.raw)}` } } }, scales: { y: { ticks: { callback: v => won(v) } }, x: { ticks: { autoSkip: false, maxRotation: 40 } } } } });
      const days = []; for (let d = R.T.s; d <= R.T.e; d = addD(d, 1)) days.push(d);
      const keyOf = r => pgroup === "브랜드" ? r.b : (r.e || "(기획전 없음)");
      const sel = pSel.length ? pSel : null;
      const ds = sel ? sel.map((k, i) => ({ label: k, data: days.map(d => R.cur.filter(r => r.d === d && keyOf(r) === k).reduce((a, r) => a + r.rev, 0)), borderColor: PAL[i % PAL.length], backgroundColor: PAL[i % PAL.length], tension: .3, borderWidth: 2, pointRadius: 2 }))
        : [{ label: "전체 매출", data: days.map(d => R.cur.filter(r => r.d === d).reduce((a, r) => a + r.rev, 0)), borderColor: "#151515", backgroundColor: "#151515", tension: .3, borderWidth: 2, pointRadius: 2 }];
      chart("pc2", { type: "line", data: { labels: days.map(md), datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => `${c.dataset.label} ${won(c.raw)}` } } }, scales: { y: { ticks: { callback: v => won(v) } } } } });
    }

    /* =======================================================================
       ④ 시장 인사이트 (Reboot 인사이트: 주간 리뷰 · 시장 변화) — W컨셉 실제 수집값만
       ======================================================================= */
    const D1 = SNAP[0], D2 = SNAP[1], D3 = SNAP[2];
    let isub = "weekly", iAI = store.insAI || null, iBusy = false, iErr = "";
    const rankMap = sn => { const m = {}; sn.scores.forEach((x, i) => m[x[0]] = i + 1); return m; };
    function marketDiff() {
      const t1 = D1.top.map(x => x.b), t3 = D3.top.slice(0, 20).map(x => x.b);
      const entered = t3.filter(b => !t1.includes(b)), left = t1.filter(b => !t3.includes(b));
      const r2 = rankMap(D2), r3 = rankMap(D3);
      const moves = Object.keys(r3).map(b => ({ b, r2: r2[b] || null, r3: r3[b], d: r2[b] ? r2[b] - r3[b] : null }));
      const up = moves.filter(m => m.d != null).sort((a, b) => b.d - a.d).slice(0, 8), down = moves.filter(m => m.d != null).sort((a, b) => a.d - b.d).slice(0, 8);
      const newIn = moves.filter(m => m.r2 == null).sort((a, b) => a.r3 - b.r3), out = Object.keys(r2).filter(b => !r3[b]).map(b => ({ b, r2: r2[b] })).sort((a, b) => a.r2 - b.r2);
      return { entered, left, up, down, newIn, out };
    }
    function weeklyActions() {
      const X = marketDiff(), A = [];
      X.entered.slice(0, 3).forEach(b => { const s = scoreOf(D3, b); A.push({ g: "기회", t: `${b} 베스트 TOP20 신규 진입`, why: `11/11 TOP20 밖 → 11/13 ${s.rank}위 (점수 ${fmt(s.score)} · 베스트 상품 ${s.n}개)`, do: "브랜드 미팅 · 기획전 구좌 제안", s: "real", n: `${s.rank}위` }); });
      [...X.left.filter(b => exclBrands.includes(b)), ...X.left.filter(b => !exclBrands.includes(b)).slice(0, 2)].forEach(b => { const ex = exclBrands.includes(b); const s = scoreOf(D3, b); A.push({ g: ex ? "긴급" : "참고", t: `${b} TOP20 이탈${ex ? " (단독 브랜드)" : ""}`, why: `11/11 TOP20 → 11/13 ${s ? s.rank + "위" : "TOP60 밖"}`, do: ex ? "단독 상품 노출 · 재고 확인" : "원인 확인 (재고 · 가격)", s: "real", n: s ? `${s.rank}위` : "60위 밖" }); });
      X.up.filter(m => m.d >= 10).slice(0, 3).forEach(m => A.push({ g: "기회", t: `${m.b} 순위 급등`, why: `11/12 ${m.r2}위 → 11/13 ${m.r3}위 (+${m.d})`, do: "급등 상품 확인 · 메인 노출 검토", s: "real", n: `+${m.d}` }));
      CATS.filter(c => D1.cats[c] && D3.cats[c]).sort((x, y) => Math.abs(D3.cats[y].avgDisc - D1.cats[y].avgDisc) - Math.abs(D3.cats[x].avgDisc - D1.cats[x].avgDisc)).slice(0, 2).forEach(c => { const a = D1.cats[c], b = D3.cats[c]; if (Math.abs(b.avgDisc - a.avgDisc) >= 2) A.push({ g: "참고", t: `${c} 베스트 평균 할인율 ${b.avgDisc > a.avgDisc ? "상승" : "하락"}`, why: `${a.avgDisc}% → ${b.avgDisc}% (11/11 → 11/13)`, do: b.avgDisc > a.avgDisc ? "담당 브랜드 할인 경쟁력 점검" : "정가 판매 여지 확인", s: "real", n: `${(b.avgDisc - a.avgDisc).toFixed(1)}%p` }); });
      PRODUCTS.map(p => ({ p, r: revDelta(p) })).filter(x => x.r && x.r.rate >= 0.05).sort((a, b) => b.r.rate - a.r.rate).slice(0, 3).forEach(x => A.push({ g: "기회", t: `${x.p.brand} ${x.p.name} 리뷰 급증`, why: `리뷰 +${x.r.d}건 (${pct(x.r.rate, 1)}, 3일) — 판매 신호`, do: "재고 · 리오더 확인", s: "real", n: "+" + pct(x.r.rate, 1) }));
      PRODUCTS.filter(p => p.size && p.size["큼"] >= 30).sort((a, b) => b.size["큼"] - a.size["큼"]).slice(0, 3).forEach(p => A.push({ g: "긴급", t: `${p.brand} ${p.name} '크게 나옴' ${p.size["큼"]}%`, why: "구매 리뷰 사이즈 평가 — 반품 위험", do: "상세페이지 '한 치수 작게' 안내 요청", s: "real", n: p.size["큼"] + "%" }));
      const nextH = (API.holidays || []).filter(h => h.date > TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0]; if (nextH) { const d = Math.round((new Date(nextH.date) - new Date(TODAY)) / 864e5); if (d <= 60) A.push({ g: d <= 30 ? "긴급" : "기회", t: `${nextH.name} D-${d}`, why: `${nextH.date} · 기획전 준비는 4주 전부터`, do: "참여 브랜드 섭외 · 구좌 신청", s: "api", n: `D-${d}` }); }
      const cold = wxDays().find(x => x.min <= 0); if (cold) A.push({ g: "기회", t: `${md(cold.date)} 서울 첫 영하 (${cold.min}℃)`, why: "Open-Meteo 14일 예보", do: "아우터 · 부츠 메인 구좌 전환", s: "api", n: cold.min + "℃" });
      const O = { "긴급": 0, "기회": 1, "참고": 2 }; return A.sort((a, b) => O[a.g] - O[b.g]);
    }
    const GT = { "긴급": "urg", "기회": "opp", "참고": "ref" };
    function vInsight() {
      const head = `<div class="ph"><h2>시장 인사이트</h2><span class="t urg">월 10:00</span><div class="when">${aiBadge()}</div></div>
      <p class="lead">한 주 동안 모은 W컨셉 베스트 · 기획전 · 신상 · 상품 리뷰를 비교해 '이번 주 무엇을 해야 하나'(주간 리뷰)와 '무엇이 달라졌나'(시장 변화)로 정리해요. Reboot 인사이트처럼 판단은 규칙이 하고, AI는 요약 문장만 써요.</p>
      ${seg("isub", [["weekly", "주간 리뷰"], ["changes", "시장 변화"]], isub)}`;
      const X = marketDiff();
      if (isub === "weekly") {
        const A = weeklyActions(), c = g => A.filter(a => a.g === g).length;
        return head + `<div class="grid g4" style="margin-top:12px">${[["긴급", c("긴급")], ["기회", c("기회")], ["참고", c("참고")], ["수집", "3회"]].map(([k, v]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}${typeof v === "number" ? "<small>건</small>" : ""}</div><div class="s">${k === "수집" ? `${D1.at} · ${D2.at} · ${D3.at}` : ""}</div></div>`).join("")}</div>
          <div class="sec"><h3>이번 주 액션</h3><span class="hint">규칙 8개 · 유형별 상위만 표시 · 전체 순위 변동은 '시장 변화'</span></div>
          <div class="card">${A.map(a => `<div class="act"><span class="t ${GT[a.g]}">${a.g}</span><div><b>${esc(a.t)}</b><div class="why">${esc(a.why)} → <em>${esc(a.do)}</em> ${src(a.s)}</div></div><span class="n">${esc(a.n)}</span></div>`).join("")}</div>
          <div class="card" style="margin-top:12px"><div style="display:flex;gap:8px;align-items:center"><h4 style="margin:0">AI 한 줄 정리</h4>${iAI ? aiMeta(iAI.meta) : ""}<button class="btn ghost" id="iai" style="margin-left:auto" ${aiReady() && !iBusy ? "" : "disabled"}>${iBusy ? "정리 중…" : iAI ? "다시 정리" : "팀 공유용으로 정리"}</button></div>
            ${iErr ? `<p class="note" style="color:var(--red)">${esc(iErr)}</p>` : ""}
            ${iAI ? `<p style="font-size:15px;font-weight:700;margin:10px 0 6px">${esc(iAI.headline)}</p><ul class="uf">${iAI.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul><p class="cap">${esc(iAI.caution)}</p><button class="btn ghost" id="icp">복사</button>` : `<p class="cap">규칙 결과(위 목록)와 시장 숫자만 보내 3줄 요약을 받아요.</p>`}</div>`;
      }
      const cats = CATS.map(c => [c, D1.cats[c], D2.cats[c], D3.cats[c]]);
      const arrow = (a, b, unit = "", d = 1) => a == null || b == null ? "—" : `${a}${unit} → <b>${b}${unit}</b> <span class="${b > a ? "up" : b < a ? "down" : ""}">${b > a ? "▲" : b < a ? "▼" : "–"}${Math.abs(b - a).toFixed(d).replace(/\.0$/, "")}</span>`;
      const evc = {}; EVENTS.forEach(e => { const t = evType(e); evc[t] = (evc[t] || 0) + 1; });
      const nb = (M.newArrivals && M.newArrivals.newBrands) || [], r3 = rankMap(D3);
      return head + `<div class="sec"><h3>카테고리 변화 (베스트 TOP100)</h3>${src("real", "11/11 → 11/13")}</div>
        ${table(["카테고리", "평균 할인율", "단독 상품", "더블유위크 상품", "브랜드 수"], cats.map(([c, a, b, d]) => `<tr><td><b>${c}</b></td><td>${arrow(a.avgDisc, d.avgDisc, "%")}</td><td>${arrow(a.excl, d.excl, "개", 0)}</td><td>${arrow(a.wweek, d.wweek, "개", 0)}</td><td>${arrow(a.brands, d.brands, "", 0)}</td></tr>`))}
        <div class="grid g2" style="margin-top:12px">
          <div class="card"><h4>순위 급등 · 11/12 → 11/13 ${src("real")}</h4>${table(["브랜드", "#순위", "#변화"], X.up.map(m => `<tr><td>${esc(m.b)}</td><td class="num">${m.r2} → <b>${m.r3}</b></td><td class="num up">+${m.d}</td></tr>`))}</div>
          <div class="card"><h4>순위 급락 · 11/12 → 11/13 ${src("real")}</h4>${table(["브랜드", "#순위", "#변화"], X.down.map(m => `<tr><td>${esc(m.b)}</td><td class="num">${m.r2} → <b>${m.r3}</b></td><td class="num down">${m.d}</td></tr>`))}</div>
        </div>
        <div class="grid g2" style="margin-top:12px">
          <div class="card"><h4>TOP60 신규 진입 ${X.newIn.length} · 이탈 ${X.out.length}</h4><p style="font-size:13px;line-height:1.8;margin:6px 0"><b>진입</b> ${X.newIn.slice(0, 12).map(m => `${esc(m.b)}(${m.r3}위)`).join(", ") || "없음"}${X.newIn.length > 12 ? ` 외 ${X.newIn.length - 12}` : ""}<br><b>이탈</b> ${X.out.slice(0, 12).map(m => `${esc(m.b)}(11/12 ${m.r2}위)`).join(", ") || "없음"}${X.out.length > 12 ? ` 외 ${X.out.length - 12}` : ""}</p><p class="cap">TOP20 기준 (11/11 → 11/13): 진입 ${X.entered.join(", ") || "없음"} · 이탈 ${X.left.join(", ") || "없음"}</p></div>
          <div class="card"><h4>상위 브랜드 점수 추이 ${src("real")}</h4><div class="chart" style="height:220px"><canvas id="ic1"></canvas></div></div>
        </div>
        <div class="grid g2" style="margin-top:12px">
          <div class="card"><h4>메인 기획전 배너 유형 ${src("real", M.eventsMeta.at)}</h4><div class="chart" style="height:200px"><canvas id="ic2"></canvas></div></div>
          <div class="card"><h4>신규 입점 브랜드 ${src("real", "신상 페이지")}</h4><div class="chips">${nb.map(b => `<span class="tbtn ${r3[b] ? "on" : ""}">${esc(b)}${r3[b] ? ` · 베스트 ${r3[b]}위` : ""}</span>`).join("")}</div><p class="cap" style="margin-top:8px">검은 칩 = 이미 베스트 TOP60에 들어온 신규 브랜드 → 육성 우선순위</p></div>
        </div>`;
    }
    function afterInsight() {
      bindSeg("isub", k => { isub = k; rerender(); });
      if (isub === "weekly") {
        const b = $("#iai"); if (b) b.onclick = async () => { iBusy = true; iErr = ""; rerender(); const X = marketDiff(); try { iAI = await aiCall("insight", { data: { week: `${D1.at} ~ ${D3.at}`, actions: weeklyActions().map(a => ({ grade: a.g, title: a.t, evidence: a.why, todo: a.do })), market: { top20_entered: X.entered, top20_left: X.left, rank_up: X.up.slice(0, 5).map(m => `${m.b} ${m.r2}→${m.r3}위`), category_avg_discount: CATS.map(c => `${c} ${D1.cats[c].avgDisc}%→${D3.cats[c].avgDisc}%`) }, limits: "W컨셉 공개 화면 3일치(11/11~11/13) · 판매·재고 미연결" } }); store.insAI = iAI; save(); } catch (e) { iErr = e.message; } iBusy = false; rerender(); };
        const c = $("#icp"); if (c) c.onclick = () => copy([iAI.headline, ...iAI.lines.map(l => "- " + l), "※ " + iAI.caution].join("\n"));
        return;
      }
      const top = D3.scores.slice(0, 8).map(x => x[0]);
      chart("ic1", { type: "line", data: { labels: ["11/11", "11/12", "11/13"], datasets: top.slice(0, 6).map((b, i) => ({ label: b, data: [scoreOf(D1, b), scoreOf(D2, b), scoreOf(D3, b)].map(s => s ? s.score : null), borderColor: PAL[i], backgroundColor: PAL[i], borderWidth: 2, pointRadius: 3, spanGaps: true })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { y: { title: { display: true, text: "브랜드 점수 Σ(101−순위)" } } } } });
      const evc = {}; EVENTS.forEach(e => { const t = evType(e); evc[t] = (evc[t] || 0) + 1; }); const ek = Object.keys(evc).sort((a, b) => evc[b] - evc[a]);
      chart("ic2", { type: "bar", data: { labels: ek, datasets: [{ data: ek.map(k => evc[k]), backgroundColor: "#151515", borderRadius: 4 }] }, options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}개` } } } } });
    }

    return [
      { id: "content", label: "콘텐츠 제작", time: "14:00", after: "voc", view: vContent, bind: afterContent },
      { id: "comply", label: "표현 검수", time: "14:30", after: "content", view: vComply, bind: afterComply },
      { id: "perf", label: "성과 분석", time: "17:00", after: "register", view: vPerf, bind: afterPerf },
      { id: "insight", label: "시장 인사이트", time: "월 10:00", after: "perf", view: vInsight, bind: afterInsight }
    ];
  };
})();
