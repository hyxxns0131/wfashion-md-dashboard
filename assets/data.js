/* =========================================================================
   Fashion MD Workspace — 가상(예시) 데이터
   - 모든 브랜드·상품·수치는 포트폴리오 시연용 가상 데이터입니다.
   - 같은 시드로 항상 같은 숫자가 나오도록 결정적 난수를 씁니다.
   - 실제 운영 시: 이 파일 대신 판매·재고·리뷰 CSV(또는 사내 API)를 읽어 같은 모양의 객체를 만들면 됩니다.
   ========================================================================= */
(function () {
  "use strict";

  // ---- 결정적 난수 ---------------------------------------------------------
  let seed = 20261111;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const round = (v, n = 0) => Math.round(v * 10 ** n) / 10 ** n;

  const TODAY = new Date(2026, 10, 12); // 2026-11-12 (목)
  const DAYS = 56;                       // 8주
  const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dates = Array.from({ length: DAYS }, (_, i) => dayStr(addDays(TODAY, i - DAYS + 1)));

  // ---- 카테고리 ------------------------------------------------------------
  // trend: 11월 시즌성(최근 8주 동안의 수요 기울기), search: 검색 수요 지수(가정)
  const CATEGORIES = {
    "아우터":   { trend: 1.9,  search: 168, searchPrev: 141, sizes: ["S", "M", "L"] },
    "니트":     { trend: 1.5,  search: 132, searchPrev: 118, sizes: ["S", "M", "L"] },
    "셋업":     { trend: 1.1,  search: 96,  searchPrev: 94,  sizes: ["S", "M", "L"] },
    "원피스":   { trend: 0.85, search: 88,  searchPrev: 97,  sizes: ["S", "M", "L"] },
    "상의":     { trend: 0.9,  search: 102, searchPrev: 104, sizes: ["S", "M", "L"] },
    "팬츠":     { trend: 1.05, search: 110, searchPrev: 106, sizes: ["S", "M", "L"] },
    "스커트":   { trend: 0.95, search: 74,  searchPrev: 76,  sizes: ["S", "M", "L"] },
    "가방":     { trend: 1.2,  search: 121, searchPrev: 102, sizes: ["FREE"] },
    "신발":     { trend: 1.3,  search: 117, searchPrev: 99,  sizes: ["230", "240", "250"] },
    "액세서리": { trend: 1.6,  search: 139, searchPrev: 104, sizes: ["FREE"] }
  };

  // ---- 입점 브랜드 (가상) --------------------------------------------------
  // fee: 판매 수수료율, ret: 반품률 기준, leadReg: 평균 등록 리드타임(일), main: 주력 카테고리
  const BRANDS = [
    { id: "b01", name: "모노레일",     main: ["아우터", "니트"],      fee: 0.30, ret: 0.07, leadReg: 2, since: "2021-03", manager: "강현서" },
    { id: "b02", name: "노드니트",     main: ["니트", "상의"],        fee: 0.30, ret: 0.06, leadReg: 3, since: "2022-08", manager: "강현서" },
    { id: "b03", name: "스튜디오 해온", main: ["셋업", "팬츠"],        fee: 0.32, ret: 0.15, leadReg: 6, since: "2020-11", manager: "강현서" },
    { id: "b04", name: "오브제리",     main: ["원피스", "상의"],      fee: 0.31, ret: 0.09, leadReg: 2, since: "2023-02", manager: "강현서" },
    { id: "b05", name: "라운드앤",     main: ["상의", "팬츠"],        fee: 0.28, ret: 0.08, leadReg: 4, since: "2024-05", manager: "강현서" },
    { id: "b06", name: "벨로우즈",     main: ["팬츠", "스커트"],      fee: 0.29, ret: 0.16, leadReg: 5, since: "2022-01", manager: "강현서" },
    { id: "b07", name: "아틀리에 순",   main: ["원피스", "스커트"],    fee: 0.33, ret: 0.10, leadReg: 3, since: "2025-04", manager: "강현서" },
    { id: "b08", name: "그레이포인트", main: ["아우터", "팬츠"],      fee: 0.30, ret: 0.08, leadReg: 2, since: "2021-09", manager: "강현서" },
    { id: "b09", name: "파인레더",     main: ["가방"],                fee: 0.27, ret: 0.04, leadReg: 2, since: "2023-10", manager: "강현서" },
    { id: "b10", name: "스텝앤",       main: ["신발"],                fee: 0.28, ret: 0.12, leadReg: 4, since: "2024-01", manager: "강현서" },
    { id: "b11", name: "오르비",       main: ["액세서리"],            fee: 0.32, ret: 0.03, leadReg: 1, since: "2025-07", manager: "강현서" },
    { id: "b12", name: "코튼루프",     main: ["상의", "니트"],        fee: 0.29, ret: 0.07, leadReg: 7, since: "2023-06", manager: "강현서" }
  ];

  const ITEM_NAMES = {
    "아우터": ["울 블렌드 핸드메이드 코트", "숏 패딩 점퍼", "오버핏 트렌치 코트", "후드 덕다운 파카", "울 발마칸 코트", "레더 블루종"],
    "니트": ["케이블 라운드 니트", "캐시미어 블렌드 터틀넥", "울 브이넥 가디건", "램스울 크루넥 니트", "하프집업 니트"],
    "셋업": ["울 테일러드 재킷", "세미와이드 슬랙스 셋업", "싱글 블레이저", "핀턱 슬랙스"],
    "원피스": ["니트 롱 원피스", "플리츠 셔츠 원피스", "벨티드 미디 원피스", "울 점퍼스커트"],
    "상의": ["코튼 옥스포드 셔츠", "스트라이프 롱슬리브", "기모 스웨트셔츠", "프릴 블라우스", "헨리넥 티셔츠"],
    "팬츠": ["와이드 데님 팬츠", "기모 조거 팬츠", "코듀로이 와이드 팬츠", "스트레이트 슬랙스"],
    "스커트": ["울 플리츠 스커트", "데님 롱 스커트", "니트 머메이드 스커트"],
    "가방": ["레더 숄더백", "미니 토트백", "호보 백", "크로스 메신저백"],
    "신발": ["스웨이드 첼시 부츠", "레더 로퍼", "퍼 슬링백 뮬", "청키 스니커즈"],
    "액세서리": ["울 머플러", "앙고라 비니", "레더 장갑", "실버 이어링"]
  };
  const PRICE = { "아우터": [189000, 429000], "니트": [69000, 189000], "셋업": [129000, 289000], "원피스": [99000, 219000], "상의": [39000, 99000], "팬츠": [59000, 139000], "스커트": [69000, 149000], "가방": [119000, 329000], "신발": [99000, 259000], "액세서리": [29000, 89000] };
  const COLORS = ["블랙", "아이보리", "그레이", "차콜", "베이지", "카멜", "브라운", "네이비", "카키", "버건디", "스카이블루", "핑크"];
  const COLOR_HEX = { "블랙": "#1d1d1f", "아이보리": "#f2ecdf", "그레이": "#a9adb3", "차콜": "#46484d", "베이지": "#d8c3a1", "카멜": "#b58250", "브라운": "#6e4a33", "네이비": "#25335a", "카키": "#6f6b45", "버건디": "#6f1d2e", "스카이블루": "#a9c8ea", "핑크": "#e9b4c1", "화이트": "#f8f8f6", "블루": "#2f5cb8", "레드": "#c0322f", "그린": "#3f7a4a", "옐로우": "#e8c547", "오렌지": "#e07a36", "퍼플": "#6c55a8", "실버": "#c7c9cc" };

  // ---- 상품 · 옵션 · 일별 판매 ---------------------------------------------
  const PRODUCTS = [];
  let pid = 1000;
  BRANDS.forEach(b => {
    const n = ri(5, 7);
    for (let i = 0; i < n; i++) {
      const cat = i < 4 ? b.main[i % b.main.length] : pick(Object.keys(ITEM_NAMES));
      const nm = pick(ITEM_NAMES[cat]);
      const [lo, hi] = PRICE[cat];
      const price = Math.round((lo + rnd() * (hi - lo)) / 1000) * 1000;
      const disc = pick([0, 0, 5, 10, 10, 15, 20, 25, 30]);
      const colors = [];
      const nc = cat === "액세서리" ? ri(1, 2) : ri(2, 3);
      while (colors.length < nc) { const c = pick(COLORS); if (!colors.includes(c)) colors.push(c); }
      const sizes = CATEGORIES[cat].sizes;
      const base = (0.6 + rnd() * 2.6) * (b.main.includes(cat) ? 1.25 : 0.7) * (price > 250000 ? 0.6 : 1);
      const star = rnd() < 0.08;                       // 히트 상품
      const p = {
        id: "P" + (++pid), brand: b.id, cat, name: nm, price, disc, colors, sizes,
        base: star ? base * 2.4 : base,
        rating: round(Math.min(4.9, 3.6 + rnd() * 1.3 + (star ? 0.2 : 0)), 1),
        reviews: ri(4, 160) * (star ? 3 : 1),
        launched: dayStr(addDays(TODAY, -ri(5, 220))),
        options: [], daily: new Array(DAYS).fill(0)
      };
      // 옵션: 컬러 × 사이즈
      const sizeW = sizes.length === 3 ? [0.28, 0.44, 0.28] : [1];
      colors.forEach((c, ci) => {
        const colorW = ci === 0 ? 0.55 : ci === 1 ? 0.3 : 0.15;
        sizes.forEach((s, si) => {
          p.options.push({ sku: `${p.id}-${ci + 1}${si + 1}`, color: c, size: s, w: colorW * (sizeW[si] || 1) * (0.8 + rnd() * 0.4), stock: 0, sold7: 0, sold28: 0 });
        });
      });
      const wsum = p.options.reduce((s, o) => s + o.w, 0);
      p.options.forEach(o => o.w /= wsum);
      PRODUCTS.push(p);
    }
  });
  // W.only 단독 상품 표시 (결정적: 상품 번호 기준 약 30%)
  PRODUCTS.forEach((p, i) => { p.excl = (i * 7) % 10 < 3; });
  // 특정 이슈를 의도적으로 심어 둠 (데모에서 규칙이 잡아내도록)
  const hot = PRODUCTS.find(p => p.brand === "b01" && p.cat === "아우터"); hot.base *= 2.2; hot.name = "울 블렌드 핸드메이드 코트"; hot.rating = 4.8; hot.excl = true;
  const lowRate = PRODUCTS.find(p => p.brand === "b03"); lowRate.rating = 3.6; lowRate.name = "세미와이드 슬랙스 셋업";
  const knitHot = PRODUCTS.find(p => p.brand === "b02" && p.cat === "니트"); knitHot.base *= 1.8; knitHot.name = "캐시미어 블렌드 터틀넥";

  // 프로모션(기획전) 정의 — 날짜 인덱스 기준 매출 부스트
  const idx = s => dates.indexOf(s);
  // W컨셉 행사 구조를 따른 기획전 (이름·구조는 W컨셉 메인 기준, 기간·목표·실적은 가정)
  const PROMOS = [
    { id: "pr1", name: "더블유위크 (W WEEK)", theme: "전 카테고리 · 쿠폰 + 브랜드 할인 · 단독", start: "2026-11-09", end: "2026-11-22", cats: [], disc: 30, coupon: 10, target: 380000000, status: "진행 중", lift: 1.6, wc: "더블유위크" },
    { id: "pr2", name: "미리 고르는 크리스마스 선물", theme: "가방 · 액세서리 · 니트", start: "2026-11-12", end: "2026-12-24", cats: ["가방", "액세서리", "니트"], disc: 15, coupon: 5, target: 240000000, status: "진행 중", lift: 1.15, wc: "테마 기획전" },
    { id: "pr3", name: "가을 데님 & 셋업 기획전", theme: "팬츠 · 셋업", start: "2026-10-13", end: "2026-10-26", cats: ["팬츠", "셋업"], disc: 30, coupon: 5, target: 26000000, status: "종료", lift: 1.35, wc: "테마 기획전" },
    { id: "pr4", name: "W LIVE · 겨울 아우터 위시리스트", theme: "아우터 · 라이브 방송 1회", start: "2026-11-13", end: "2026-11-13", cats: ["아우터"], disc: 35, coupon: 10, target: 30000000, status: "준비", lift: 1.0, lead: 7, wc: "W LIVE" },
    { id: "pr5", name: "W.only 윈터 아우터 단독전", theme: "단독 컬러 · 단독 리오더", start: "2026-11-26", end: "2026-12-07", cats: ["아우터", "니트"], disc: 20, coupon: 10, target: 200000000, status: "준비", lift: 1.4, lead: 21, wc: "단독" },
    { id: "pr6", name: "연말 시즌오프", theme: "26FW 클리어런스", start: "2026-12-26", end: "2027-01-04", cats: [], disc: 40, coupon: 5, target: 350000000, status: "기획", lift: 1.6, lead: 30, wc: "시즌오프" }
  ];

  // 일별 판매 생성
  const weekday = [1.12, 0.92, 0.9, 0.95, 1.0, 1.08, 1.18]; // 일~토
  PRODUCTS.forEach(p => {
    const b = BRANDS.find(x => x.id === p.brand);
    const tr = CATEGORIES[p.cat].trend;
    const launchIdx = Math.max(0, idx(p.launched));
    for (let d = 0; d < DAYS; d++) {
      if (dates[d] < p.launched) continue;
      const day = new Date(dates[d]);
      let m = p.base * weekday[day.getDay()] * (1 + (tr - 1) * (d / (DAYS - 1)));
      PROMOS.forEach(pr => { if (dates[d] >= pr.start && dates[d] <= pr.end && (pr.cats.length === 0 || pr.cats.includes(p.cat))) m *= pr.lift; });
      if (b.id === "b03" && d > DAYS - 8) m *= 0.6;   // 해온: 최근 2주 매출 급감
      if (b.id === "b06" && d > DAYS - 8) m *= 0.78;    // 벨로우즈: 최근 1주 둔화
      if (d - launchIdx < 10 && launchIdx > 0) m *= 1.3; // 신상 효과
      const q = Math.max(0, Math.round(m + (rnd() - 0.5) * m * 0.9));
      p.daily[d] = q;
    }
    // 옵션별 판매 · 재고
    const s7 = p.daily.slice(-7).reduce((a, c) => a + c, 0);
    const s28 = p.daily.slice(-28).reduce((a, c) => a + c, 0);
    p.options.forEach(o => {
      o.sold7 = Math.round(s7 * o.w * (0.85 + rnd() * 0.3));
      o.sold28 = Math.round(s28 * o.w * (0.9 + rnd() * 0.2));
      const cover = 0.9 + rnd() * 4.2;           // 몇 주치 재고
      o.stock = Math.max(0, Math.round((o.sold7 / 7) * 7 * cover + ri(-2, 6)));
      if (rnd() < 0.045) o.stock = 0;
      if (o.size === "S" && (p.cat === "아우터" || p.cat === "팬츠")) o.stock = Math.round(o.stock * 1.9);
      if (o.size === "L" && p.cat === "니트") o.stock = Math.round(o.stock * 0.5);
    });
  });
  // 히트 코트의 블랙 M 을 품절 임박으로
  hot.options.filter(o => o.color === hot.colors[0]).forEach(o => { o.stock = Math.max(1, Math.round(o.sold7 / 7 * 3)); });
  knitHot.options.filter(o => o.size === "M").forEach(o => { o.stock = Math.max(0, Math.round(o.sold7 / 7 * 4)); });

  // ---- 반품 · 리뷰/문의 (VOC) ---------------------------------------------
  const RET_REASONS = ["사이즈 불만", "색상 상이", "품질·소재", "단순 변심", "배송 지연·파손"];
  BRANDS.forEach(b => {
    const w = b.id === "b03" ? [0.52, 0.08, 0.16, 0.18, 0.06]
      : b.id === "b06" ? [0.46, 0.06, 0.2, 0.22, 0.06]
      : b.id === "b10" ? [0.48, 0.05, 0.15, 0.24, 0.08]
      : [0.3, 0.12, 0.16, 0.34, 0.08];
    b.retReasons = Object.fromEntries(RET_REASONS.map((r, i) => [r, w[i]]));
  });

  const VOC_TEMPLATES = {
    "사이즈":   ["평소 M 입는데 M이 너무 작아요. 실측표랑 달라요", "어깨가 생각보다 좁게 나왔어요", "기장이 상세페이지 사이즈랑 3cm 차이나요", "한 치수 크게 주문하는 게 맞나요?", "허리가 커서 교환 신청했어요"],
    "색상":     ["상세컷보다 실물 색이 훨씬 어두워요", "베이지 주문했는데 회색빛이 돌아요", "화면이랑 색감이 달라서 당황했어요"],
    "소재·품질": ["한 번 세탁했는데 보풀이 많이 생겼어요", "캐시미어라고 해서 샀는데 혼용률이 낮네요", "봉제선이 터져서 왔어요", "생각보다 얇아요"],
    "배송":     ["주문한 지 5일째인데 출고가 안 됐어요", "포장이 찢어져서 왔어요", "예약배송 일정이 언제인가요?"],
    "재입고":   ["블랙 M 재입고 언제 되나요?", "품절된 컬러 재입고 알림 신청했어요", "이 사이즈 다시 들어오나요?"],
    "만족":     ["핏이 너무 예뻐요 재구매 의사 있어요", "가격 대비 퀄리티 최고", "선물용으로 샀는데 포장도 좋아요"]
  };
  const VOC = [];
  let vid = 1;
  const vocDays = 28;
  BRANDS.forEach(b => {
    const n = ri(12, 22) + (b.id === "b03" || b.id === "b06" ? 10 : 0);
    const prods = PRODUCTS.filter(p => p.brand === b.id);
    for (let i = 0; i < n; i++) {
      let topic;
      const r = rnd();
      if (b.id === "b03" || b.id === "b06" || b.id === "b10") topic = r < 0.45 ? "사이즈" : r < 0.55 ? "소재·품질" : r < 0.65 ? "배송" : r < 0.72 ? "색상" : r < 0.8 ? "재입고" : "만족";
      else if (b.id === "b01" || b.id === "b02") topic = r < 0.32 ? "재입고" : r < 0.42 ? "사이즈" : r < 0.5 ? "소재·품질" : r < 0.55 ? "배송" : "만족";
      else if (b.id === "b12") topic = r < 0.35 ? "배송" : r < 0.5 ? "사이즈" : r < 0.6 ? "색상" : "만족";
      else topic = r < 0.18 ? "사이즈" : r < 0.27 ? "색상" : r < 0.36 ? "소재·품질" : r < 0.43 ? "배송" : r < 0.5 ? "재입고" : "만족";
      const p = pick(prods);
      VOC.push({ id: vid++, brand: b.id, product: p.id, kind: rnd() < 0.62 ? "리뷰" : "문의", text: pick(VOC_TEMPLATES[topic]), date: dayStr(addDays(TODAY, -ri(0, vocDays - 1))), rating: topic === "만족" ? ri(4, 5) : ri(1, 3) });
    }
  });
  VOC.sort((a, b) => (a.date < b.date ? 1 : -1));

  // ---- 상품 등록 대기 큐 (검수 대상) ----------------------------------------
  const REG_QUEUE = [
    { id: "R-1101", brand: "b01", name: "캐시미어 핸드메이드 롱 코트", cat: "아우터", price: 389000, disc: 0, color: "카멜", material: "울 80%, 캐시미어 10%, 나일론 10%", origin: "대한민국", care: "드라이클리닝", sizeChart: true, img: { w: 1200, h: 1600, ratio: "3:4", fill: 0.62 }, submitted: "2026-11-10" },
    { id: "R-1102", brand: "b05", name: "[최저가] 기모 스웨트셔츠 3color", cat: "상의", price: 59000, disc: 55, color: "그레이", material: "면 80%, 폴리에스터 20%", origin: "중국", care: "", sizeChart: true, img: { w: 800, h: 800, ratio: "1:1", fill: 0.48 }, submitted: "2026-11-10" },
    { id: "R-1103", brand: "b03", name: "울 테일러드 재킷", cat: "셋업", price: 259000, disc: 10, color: "차콜", material: "울 60%, 폴리에스터 40%", origin: "대한민국", care: "드라이클리닝", sizeChart: false, img: { w: 1500, h: 2000, ratio: "3:4", fill: 0.58 }, submitted: "2026-11-09" },
    { id: "R-1104", brand: "b07", name: "명품st 트위드 미디 원피스", cat: "원피스", price: 169000, disc: 0, color: "아이보리", material: "", origin: "대한민국", care: "손세탁", sizeChart: true, img: { w: 1200, h: 1600, ratio: "3:4", fill: 0.55 }, submitted: "2026-11-09" },
    { id: "R-1105", brand: "b10", name: "스웨이드 첼시 부츠", cat: "신발", price: 189000, disc: 15, color: "브라운", material: "소가죽(스웨이드)", origin: "", care: "전용 클리너 사용", sizeChart: true, img: { w: 1000, h: 1000, ratio: "1:1", fill: 0.33 }, submitted: "2026-11-08" },
    { id: "R-1106", brand: "b09", name: "레더 숄더백 미디엄", cat: "가방", price: 249000, disc: 0, color: "블랙", material: "소가죽 100%", origin: "대한민국", care: "가죽 전용 크리너", sizeChart: true, img: { w: 1600, h: 1600, ratio: "1:1", fill: 0.66 }, submitted: "2026-11-08" },
    { id: "R-1107", brand: "b12", name: "램스울 크루넥 니트", cat: "니트", price: 89000, disc: 0, color: "베이지", material: "램스울 70%, 나일론 30%", origin: "중국", care: "울 코스 단독 세탁", sizeChart: true, img: { w: 1200, h: 1500, ratio: "4:5", fill: 0.6 }, submitted: "2026-11-07" }
  ];

  // ---- 소싱 후보 (가상 신진 브랜드) ------------------------------------------
  // designer: 국내 디자이너 브랜드 여부 · exclusive: 단독 컬러/리오더 협의 가능 · overlap: 기존 입점 브랜드와 스타일 중복(0~1)
  const SOURCING = [
    { name: "포레스트 랩",   cat: "액세서리", priceAvg: 54000,  growth: 0.62, followers: 48000, channel: "자사몰 · 외부 플랫폼 A", note: "니트 비니·머플러 리오더 3회", designer: true, exclusive: true, overlap: 0.2 },
    { name: "브릭하우스",    cat: "신발",     priceAvg: 168000, growth: 0.41, followers: 31000, channel: "외부 플랫폼 B 신발 랭킹 상위", note: "첼시·로퍼 주력, 사이즈 실측 상세", designer: true, exclusive: false, overlap: 0.3 },
    { name: "누아 스튜디오", cat: "아우터",   priceAvg: 312000, growth: 0.35, followers: 72000, channel: "자사몰 · 팝업", note: "핸드메이드 코트, 생산 리드타임 3주", designer: true, exclusive: true, overlap: 0.5 },
    { name: "하이드 앤 씨크", cat: "가방",    priceAvg: 138000, growth: 0.28, followers: 26000, channel: "외부 플랫폼 A", note: "미니백 가격대 공백 보완", designer: true, exclusive: true, overlap: 0.25 },
    { name: "오늘의 셔츠",   cat: "상의",     priceAvg: 69000,  growth: 0.12, followers: 15000, channel: "자사몰", note: "기존 입점 상의 브랜드와 스타일 중복", designer: false, exclusive: false, overlap: 0.8 },
    { name: "모먼트 니트웨어", cat: "니트",   priceAvg: 118000, growth: 0.33, followers: 39000, channel: "외부 플랫폼 B", note: "캐시미어 혼용률 표기 명확", designer: true, exclusive: false, overlap: 0.45 }
  ];

  // 인플루언서 PICK 협업 (가상 인플루언서 · 전용 링크 유입 기준) — Reboot 크리에이터 전용 링크 추적 구조 응용
  const PICKS = [
    { who: "@mood.minji", follow: 182000, brand: "b01", product: "울 블렌드 핸드메이드 코트", start: "2026-11-02", clicks: 18400, orders: 1210, reorder: true },
    { who: "@daily_haru", follow: 96000, brand: "b02", product: "캐시미어 블렌드 터틀넥", start: "2026-11-04", clicks: 9800, orders: 540, reorder: true },
    { who: "@seoul.layer", follow: 254000, brand: "b08", product: "레더 블루종", start: "2026-10-28", clicks: 21600, orders: 410, reorder: false },
    { who: "@yeoul.look", follow: 61000, brand: "b09", product: "미니 토트백", start: "2026-11-06", clicks: 5200, orders: 338, reorder: false },
    { who: "@weekend_jin", follow: 143000, brand: "b06", product: "와이드 데님 팬츠", start: "2026-10-30", clicks: 12900, orders: 151, reorder: false },
    { who: "@ivy.archive", follow: 38000, brand: "b07", product: "울 플리츠 스커트", start: "2026-11-08", clicks: 3100, orders: 205, reorder: false }
  ];


  window.FMD = { TODAY, dates, CATEGORIES, BRANDS, PRODUCTS, PROMOS, VOC, REG_QUEUE, SOURCING, PICKS, COLOR_HEX, RET_REASONS, util: { dayStr, addDays } };
})();
