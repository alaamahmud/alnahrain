/* PHI office extras: flying documents, live screens badge, annex construction, swipe decisions + signature,
   morning brief, calendar & gmail on the walls, cost meter, desk upgrades, employee of the week, weekly card.
   Depends on window.PHI (index.html), window.PHIVN (vn.js). */
(function(){
  "use strict";
  const PHI = window.PHI; if (!PHI) return;
  const h = PHI.h, T = () => performance.now() / 1000;
  const TZ = "Asia/Baghdad";
  const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
  const toD = (s) => { const d = new Date(s); return isNaN(d) ? null : d; };
  const fmtTok = (n) => n >= 1e6 ? (n/1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n/1e3) + "k" : String(n|0);
  const ls = { get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} } };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const nameOf = (id) => (PHI.staffById(id) || {}).name || id;
  const weekAgo = () => Date.now() - 7*864e5;

  let MCP = null, ASSETS = null, DOWN = null;
  (async () => {
    const u = (n) => window.claude && window.claude.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
    [MCP, ASSETS, DOWN] = await Promise.all([u("mcp"), u("assets"), u("downloads")]);
    renderHeader();
    if (MCP && ls.get("phi-wall") === "on") startWall();
  })();

  /* ================= header actions ================= */
  const hdr = document.getElementById("hdrActions");
  const btnDeck = h("button", {class:"hbtn pri", type:"button"}, "قرارات سريعة");
  const btnBrief = h("button", {class:"hbtn", type:"button"}, "نشرة اليوم");
  const btnWall = h("button", {class:"hbtn", type:"button", hidden:true}, "اربط تقويمي وإيميلي");
  const btnCard = h("button", {class:"hbtn", type:"button", hidden:true}, "بطاقة الأسبوع");
  const costChip = h("span", {class:"chip cost-chip", title:"توكنات استهلكها الفريق اليوم"});
  if (hdr) hdr.append(btnDeck, btnBrief, btnWall, btnCard, costChip);
  btnDeck.addEventListener("click", () => openDeck());
  btnBrief.addEventListener("click", () => runBrief(true));
  btnWall.addEventListener("click", () => { ls.set("phi-wall", "on"); startWall(); });
  btnCard.addEventListener("click", () => weeklyCard());
  function renderHeader(){
    const open = PHI.S.needs.filter(n => n.status === "open").length;
    btnDeck.textContent = open ? `قرارات سريعة (${open})` : "قرارات سريعة";
    btnDeck.disabled = !open;
    btnWall.hidden = !MCP || wall.started;
    btnCard.hidden = !DOWN;
    const today = dayKey();
    const tok = PHI.S.costs.filter(c => c.at && dayKey(toD(c.at)) === today).reduce((a, c) => a + (+c.tokens || 0), 0);
    costChip.textContent = `كلفة اليوم: ${fmtTok(tok)} توكن`;
  }

  /* ================= 1) flying documents + done sparks + live badge ================= */
  const seen = new Set(); let evInit = false; const flights = [], sparks = [];
  function onEvents(){
    if (!PHI.S.loaded.events) return;
    const evs = PHI.S.events;
    if (!evInit){ const cut = Date.now() - 90e3; evs.forEach(e => { const d = toD(e.at); if (!(d && d > cut)) seen.add(e.id); }); evInit = true; }
    for (const e of evs.slice().reverse()){
      if (seen.has(e.id)) continue; seen.add(e.id);
      if (e.kind === "handoff" && e.to && e.who) flights.push({ from: e.who, to: e.to, label: String(e.file || e.text || "").slice(0, 26), t0: T() + flights.length * 0.6 });
      else if (e.kind === "done" && e.who) sparks.push({ who: e.who, t0: T() });
    }
  }
  function drawDoc(c, x, y, rot, s){
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(-9, -10, 20, 25);
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.moveTo(-10, -13); c.lineTo(5, -13); c.lineTo(10, -8); c.lineTo(10, 13); c.lineTo(-10, 13); c.closePath(); c.fill();
    c.fillStyle = "#DDE3E1"; c.beginPath(); c.moveTo(5, -13); c.lineTo(10, -8); c.lineTo(5, -8); c.closePath(); c.fill();
    c.fillStyle = PHI.P.accent; c.fillRect(-10, -13, 3, 26);
    c.fillStyle = "#B8C2BE"; for (let i = 0; i < 4; i++) c.fillRect(-5, -6 + i*5, 12 - (i%2)*4, 1.6);
    c.restore();
  }
  PHI.overlayHooks.push((c, t) => {
    const now = T();
    for (let i = flights.length - 1; i >= 0; i--){
      const f = flights[i], k = (now - f.t0) / 2.8;
      if (k < 0) continue;
      const a = PHI.recs.get(f.from), b = PHI.recs.get(f.to);
      if (!a || !b || k > 1.25){ flights.splice(i, 1); continue; }
      const kk = Math.min(1, k), e = kk < .5 ? 2*kk*kk : 1 - Math.pow(-2*kk + 2, 2)/2;
      const ax = a.pos.x, ay = a.pos.y - 60, bx = b.pos.x, by = b.pos.y - 60;
      const x = ax + (bx - ax) * e, y = ay + (by - ay) * e - Math.sin(Math.PI * e) * Math.min(220, 60 + Math.hypot(bx - ax, by - ay) * 0.35);
      c.save(); c.globalAlpha = .35; c.fillStyle = PHI.P.accent;
      for (let j = 1; j <= 6; j++){ const e2 = Math.max(0, e - j*0.03); const x2 = ax + (bx - ax) * e2, y2 = ay + (by - ay) * e2 - Math.sin(Math.PI * e2) * Math.min(220, 60 + Math.hypot(bx - ax, by - ay) * 0.35); PHI.ell(c, x2, y2, 3.5 - j*0.4, 3.5 - j*0.4); c.fill(); }
      c.restore();
      if (k <= 1){ drawDoc(c, x, y, Math.sin(now*6)*0.15, 1.4);
        if (f.label){ c.font = PHI.FD(600, 11); c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle"; const w = c.measureText(f.label).width + 14;
          c.globalAlpha = .92; PHI.fillRR(c, x - w/2, y - 38, w, 18, 6, PHI.P.surface); c.globalAlpha = 1; c.fillStyle = PHI.P.ink; c.fillText(f.label, x, y - 29); } }
      else { const r = 14 + (k - 1) * 120; c.strokeStyle = PHI.P.accent; c.globalAlpha = Math.max(0, 1 - (k - 1) * 4); c.lineWidth = 3; PHI.ell(c, bx, by - 30, r, r * .5); c.stroke(); c.globalAlpha = 1; }
    }
    for (let i = sparks.length - 1; i >= 0; i--){
      const s = sparks[i], k = (now - s.t0) / 2.6, r = PHI.recs.get(s.who);
      if (!r || k > 1){ sparks.splice(i, 1); continue; }
      const x = r.pos.x, y = r.pos.y - 100 - k * 40;
      c.globalAlpha = 1 - k; PHI.ell(c, x, y, 13, 13); c.fillStyle = PHI.P.ok; c.fill();
      c.strokeStyle = "#fff"; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x - 1, y + 5); c.lineTo(x + 7, y - 5); c.stroke();
      for (let j = 0; j < 8; j++){ const a2 = j/8*Math.PI*2 + k*2; PHI.ell(c, x + Math.cos(a2)*(18 + k*20), y + Math.sin(a2)*(18 + k*20), 2.5, 2.5); c.fillStyle = [PHI.P.amber, PHI.P.accent, PHI.P.ok][j%3]; c.fill(); }
      c.globalAlpha = 1;
    }
    // live badge: someone wrote to their screen in the last 2 minutes
    const cut = Date.now() - 120e3;
    const liveIds = new Set(PHI.S.screenlog.filter(l => { const d = toD(l.at); return d && d > cut; }).map(l => l.who));
    for (const id of liveIds){
      const r = PHI.recs.get(id); if (!r || !r.visible) continue;
      const x = r.pos.x - 34, y = r.pos.y + (r.pose === "sit" ? -78 : -92);
      c.font = PHI.FD(700, 9); c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle";
      PHI.fillRR(c, x - 20, y - 8, 40, 16, 8, "#C8372D"); c.fillStyle = "#fff"; c.fillText("مباشر", x + 3, y + 0.5);
      c.globalAlpha = .5 + .5*Math.sin(t*5); PHI.ell(c, x - 13, y, 2.6, 2.6); c.fillStyle = "#fff"; c.fill(); c.globalAlpha = 1;
    }
    drawWallSigns(c, t);
    drawEotw(c);
  });

  /* ================= desk upgrades by level ================= */
  PHI.deskHooks.push((c, st, t, occ) => {
    if (!occ) return;
    const lv = Math.max(1, Math.min(10, +occ.level || 1)), d = st.desk;
    if (lv >= 2){ const x = d.x + d.w - 30, y = d.y + 44; PHI.fillRR(c, x - 5, y - 6, 10, 8, 2, PHI.P["o-pot"]); c.fillStyle = PHI.P["o-leaf"]; for (const a of [-.6, 0, .6]){ c.save(); c.translate(x, y - 6); c.rotate(a); PHI.ell(c, 0, -5, 2.5, 5); c.fill(); c.restore(); } }
    if (lv >= 3){ PHI.fillRR(c, d.x + 28, d.y + 6, 14, 11, 1.5, "#6B4A2B"); c.fillStyle = "#9FC7DA"; c.fillRect(d.x + 30, d.y + 8, 10, 7); }
    if (lv >= 4){ const x = d.x + 50, y = d.y + 12; c.fillStyle = "#E3B341"; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 6, y - 6); c.lineTo(x + 4, y + 2); c.lineTo(x - 4, y + 2); c.closePath(); c.fill(); c.fillRect(x - 1.5, y + 2, 3, 4); c.fillRect(x - 4, y + 6, 8, 2); }
    if (lv >= 5){ PHI.fillRR(c, d.x + d.w/2 - 18, d.y + d.h - 14, 36, 8, 2, "#C9A24A"); }
    if (lv >= 7){ c.strokeStyle = "#E3B341"; c.lineWidth = 2; PHI.rr(c, d.x - 2, d.y - 2, d.w + 4, d.h + 4, 6); c.stroke(); }
  });

  /* ================= employee of the week ================= */
  function eotw(){
    const cut = weekAgo(), score = {};
    for (const e of PHI.S.events){ const d = toD(e.at); if (e.kind === "done" && e.who && e.who !== "ceo" && d && +d > cut) score[e.who] = (score[e.who] || 0) + 10; }
    for (const s of PHI.S.staff) if (s.dept !== "ceo") score[s.id] = (score[s.id] || 0) + (+s.xp || 0);
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : null;
  }
  function drawEotw(c){
    const id = eotw(); if (!id) return;
    const x = 100, y = 383;
    PHI.fillRR(c, x, y, 150, 30, 4, "#3A2E1E"); PHI.fillRR(c, x + 3, y + 3, 144, 24, 3, "#F4E9CF");
    c.fillStyle = "#C9A24A"; c.font = PHI.FD(700, 13); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("★", x + 136, y + 15);
    c.direction = "rtl"; c.fillStyle = "#3A2E1E"; c.font = PHI.FD(600, 10); c.fillText(`موظف الأسبوع: ${nameOf(id)}`, x + 68, y + 15.5);
  }

  /* ================= 8) calendar & gmail on the walls ================= */
  const wall = { started: false, next: null, unread: null, more: false, calErr: false, mailErr: false };
  function startWall(){
    if (!MCP || wall.started) return; wall.started = true; renderHeader();
    try {
      MCP.watchTool("Google Calendar", "list_events", { pageSize: 5, orderBy: "startTime" }, (ev) => {
        if (ev.type === "error"){ wall.calErr = true; return; }
        const p = (ev.result && (ev.result.payload || ev.result)) || {};
        const list = p.events || p.items || [];
        const now = Date.now();
        const upcoming = list.map(e => ({ title: e.summary || e.title || "اجتماع", at: toD((e.start && (e.start.dateTime || e.start.date)) || e.startTime || "") }))
          .filter(e => e.at && +e.at >= now - 15*60e3).sort((a, b) => a.at - b.at);
        wall.next = upcoming[0] || false; wall.calErr = false;
      }, { refetchInterval: 300000 });
    } catch (e) { wall.calErr = true; }
    try {
      MCP.watchTool("Gmail", "search_threads", { query: "is:unread in:inbox newer_than:2d", pageSize: 50, view: "THREAD_VIEW_IDS_ONLY" }, (ev) => {
        if (ev.type === "error"){ wall.mailErr = true; return; }
        const p = (ev.result && (ev.result.payload || ev.result)) || {};
        wall.unread = (p.threads || []).length; wall.more = !!p.nextPageToken; wall.mailErr = false;
      }, { refetchInterval: 300000 });
    } catch (e) { wall.mailErr = true; }
  }
  const fT = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
  const fDay = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { timeZone: TZ, weekday: "long" });
  function sign(c, x, y, w, text, col){
    PHI.fillRR(c, x, y, w, 26, 4, "#1E262E"); PHI.fillRR(c, x + 2, y + 2, w - 4, 22, 3, "#0F171D");
    c.fillStyle = col || "#9FE3C2"; c.font = PHI.FD(600, 10.5); c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle";
    let tx = text; while (c.measureText(tx).width > w - 14 && tx.length > 4) tx = tx.slice(0, -2); if (tx !== text) tx += "…";
    c.fillText(tx, x + w/2, y + 13.5);
  }
  function drawWallSigns(c){
    if (!wall.started) return;
    if (wall.next !== null){
      const n = wall.next;
      const same = n && dayKey(n.at) === dayKey();
      sign(c, 885, 384, 200, n ? `اجتماعك الجاي: ${n.title} · ${same ? "" : fDay.format(n.at) + " "}${fT.format(n.at)}` : "ماكو اجتماعات بالتقويم", n ? "#FFD58A" : "#9FB3AE");
    }
    if (wall.unread !== null) sign(c, 1295, 384, 175, wall.unread ? `✉ ${wall.unread}${wall.more ? "+" : ""} إيميل غير مقروء` : "✉ البريد مقروء كله", wall.unread ? "#FFB4A8" : "#9FB3AE");
  }

  /* ================= 10) cost meter panel ================= */
  const costPanel = h("section", {class:"panel", "aria-labelledby":"hCost"},
    h("header", null, h("h2", {id:"hCost"}, "كلفة الشغل"), h("small", null, "توكنات من تشغيل الموظفين")));
  const costBody = h("div", {class:"cost"}); costPanel.append(costBody);
  const feedPanel = document.querySelector('[aria-labelledby="hFeed"]');
  if (feedPanel) feedPanel.parentNode.insertBefore(costPanel, feedPanel);
  function renderCost(){
    costBody.textContent = "";
    const all = PHI.S.costs, today = dayKey(), cut = weekAgo();
    if (!all.length){ costBody.append(h("div", {class:"empty"}, PHI.S.loaded.costs ? "ما انسجلت كلفة بعد." : "يتم التحميل…")); return; }
    const td = all.filter(c => c.at && dayKey(toD(c.at)) === today), wk = all.filter(c => { const d = toD(c.at); return d && +d > cut; });
    const sum = (a) => a.reduce((x, c) => x + (+c.tokens || 0), 0);
    costBody.append(h("div", {class:"cost-top"},
      h("div", null, h("b", {class:"num"}, fmtTok(sum(td))), h("span", null, "اليوم")),
      h("div", null, h("b", {class:"num"}, fmtTok(sum(wk))), h("span", null, "آخر 7 أيام")),
      h("div", null, h("b", {class:"num"}, String(wk.length)), h("span", null, "تشغيل"))));
    const byDept = {}; for (const c of wk){ const s = PHI.staffById(c.who); const d = s ? s.dept : "other"; byDept[d] = (byDept[d] || 0) + (+c.tokens || 0); }
    const max = Math.max(1, ...Object.values(byDept));
    const bars = h("div", {class:"cost-bars"});
    for (const [d, v] of Object.entries(byDept).sort((a, b) => b[1] - a[1])) bars.append(h("div", {class:"cost-row"}, h("span", null, PHI.DEPT[d] || "أخرى"), h("div", {class:"bar"}, h("i", {style:`width:${Math.round(v/max*100)}%;background:${PHI.dc(d)}`})), h("span", {class:"num"}, fmtTok(v))));
    costBody.append(bars);
    const list = h("div", {class:"cost-list"});
    for (const c of all.slice(0, 6)) list.append(h("div", {class:"cost-item"}, h("span", null, `${nameOf(c.who)}: ${c.task || c.note || ""}`), h("span", {class:"num"}, fmtTok(+c.tokens || 0))));
    costBody.append(list);
  }

  /* ================= 4) annex: rooms that get built ================= */
  const ANNEX = [
    { key: "legal", label: "القانونية", seats: 2, note: "عقود وامتثال" },
    { key: "accounting", label: "المحاسبة", seats: 2, note: "قيود وتقارير مالية" },
    { key: "audit", label: "التدقيق الداخلي", seats: 2, note: "يرفع للمالك مباشرة" },
  ];
  const AW = 1600, AH = 300;
  const annex = h("section", {class:"floor-shell annex", "aria-labelledby":"hAnnex"});
  const acv = h("canvas", {class:"annex-cv", role:"img", "aria-label":"ملحق الشركة: الأقسام الجاية"});
  const abtns = h("div", {class:"annex-btns"});
  annex.append(h("div", {class:"floor-head"}, h("h2", {id:"hAnnex"}, "ملحق الشركة"), h("small", null, "الأقسام المؤجلة. من توافق على قسم، يبدي البناء وزيد يجهز موظفيه")), h("div", {class:"floor-scroll"}, acv), abtns);
  const shell = document.querySelector(".floor-shell");
  if (shell) shell.parentNode.insertBefore(annex, shell.nextSibling);
  const actx = acv.getContext("2d");
  const annexRecs = new Map();
  function roomState(k){
    const cfg = (PHI.S.config.find(d => d.id === "office") || {}).rooms || {};
    const hasStaff = PHI.S.staff.some(s => s.dept === k);
    if (hasStaff || (cfg[k] && cfg[k].state === "open")) return "open";
    return cfg[k] && cfg[k].state === "building" ? "building" : "planned";
  }
  function roomSince(k){ const cfg = (PHI.S.config.find(d => d.id === "office") || {}).rooms || {}; return cfg[k] && toD(cfg[k].at); }
  const armed = {};
  function renderAnnexBtns(){
    abtns.textContent = "";
    for (const r of ANNEX){
      const st = roomState(r.key);
      if (st !== "planned"){ abtns.append(h("span", {class:"tag"}, `${r.label}: ${st === "open" ? "مفتوح" : "قيد البناء"}`)); continue; }
      const b = h("button", {class:"btn", type:"button", disabled: PHI.S.canWrite === false || !PHI.DB}, armed[r.key] ? `متأكد؟ اضغط مرة ثانية لفتح ${r.label}` : `ابدأ بناء ${r.label}`);
      b.addEventListener("click", async () => {
        if (!armed[r.key]){ armed[r.key] = true; renderAnnexBtns(); setTimeout(() => { armed[r.key] = false; renderAnnexBtns(); }, 5000); return; }
        armed[r.key] = false; b.disabled = true; b.textContent = "يبدي البناء…";
        const cur = PHI.S.config.find(d => d.id === "office") || {};
        const rooms = Object.assign({}, cur.rooms || {}); rooms[r.key] = { state: "building", at: new Date().toISOString() };
        try {
          const rest = Object.assign({}, cur); delete rest.id; rest.rooms = rooms; await PHI.DB.collection("config").doc("office").set(rest);
          const ok = window.PHIWake ? await window.PHIWake(`[المالك وافق على فتح قسم ${r.label} (${r.key}) من ملحق اللوحة] افتح القسم حسب الهيكل المعتمد: ${r.seats} موظفين، أنشئ وصفهم الوظيفي وملفات الـ agents وسجّلهم على اللوحة، وبعدها غيّر config/office إلى open.`) : false;
          toast(ok ? `⚡ بدأ بناء ${r.label}، وزيد وصله الطلب.` : `بدأ بناء ${r.label}. زيد يشوفه بأول جلسة.`);
        } catch (e){ toast("ما انحفظ القرار. جرّب مرة ثانية."); }
        renderAnnexBtns();
      });
      abtns.append(b);
    }
  }
  function resizeAnnex(){ const w = acv.clientWidth; if (!w) return; const dpr = Math.min(2, devicePixelRatio || 1); acv.width = Math.round(w*dpr); acv.height = Math.round(w*AH/AW*dpr); }
  new ResizeObserver(resizeAnnex).observe(acv);
  function drawAnnex(t){
    const c = actx, P = PHI.P, K = acv.width / AW; if (!K) return;
    c.setTransform(1,0,0,1,0,0); c.clearRect(0, 0, acv.width, acv.height); c.setTransform(K,0,0,K,0,0);
    c.fillStyle = P["o-corr"]; c.fillRect(0, 0, AW, AH);
    const pw = AW / 3;
    ANNEX.forEach((r, i) => {
      const x0 = i*pw, st = roomState(r.key);
      if (st === "open"){
        c.fillStyle = P[i % 2 ? "o-wood2" : "o-wood"]; c.fillRect(x0 + 8, 10, pw - 16, AH - 20);
        c.strokeStyle = P["o-wood-line"]; c.lineWidth = 1; for (let y = 10; y < AH - 10; y += 22){ c.beginPath(); c.moveTo(x0 + 8, y); c.lineTo(x0 + pw - 8, y); c.stroke(); }
        c.strokeStyle = P["o-wall"]; c.lineWidth = 8; c.strokeRect(x0 + 8, 10, pw - 16, AH - 20);
        const staff = PHI.S.staff.filter(s => s.dept === r.key).sort((a, b) => String(a.id).localeCompare(b.id));
        [0, 1, 2].slice(0, Math.max(r.seats, staff.length)).forEach((j) => {
          const cx = x0 + pw * (0.3 + j * 0.4), cy = 120;
          PHI.fillRR(c, cx - 60, cy - 26, 120, 52, 4, P["o-desk"]); PHI.fillRR(c, cx - 60, cy + 20, 120, 8, 3, P["o-desk-edge"]);
          PHI.fillRR(c, cx - 27, cy - 44, 54, 32, 3, "#1E262E");
          const s = staff[j];
          PHI.drawScreen(c, cx - 24, cy - 41, 48, 26, s ? (PHI.visualStatus(s) === "working" ? "term" : PHI.visualStatus(s) === "off" ? "off" : "saver") : "off", t, j + i*3);
          PHI.fillRR(c, cx - 19, cy + 50, 38, 22, 7, P["o-chair"]);
          if (s){
            let rec = annexRecs.get(s.id);
            if (!rec){ rec = { id: s.id, pos: { x: cx, y: cy + 70 }, pose: "sit", face: "up", act: "type", walk: 0, seed: (i*7 + j) / 3, bubble: null, visible: true }; annexRecs.set(s.id, rec); }
            rec.pos = { x: cx, y: cy + 70 }; rec.act = PHI.visualStatus(s) === "working" ? "type" : "browse";
            PHI.drawPerson(c, rec, s, t);
            c.font = PHI.FD(600, 11); c.fillStyle = P.ink; c.textAlign = "center"; c.direction = "rtl"; c.fillText(s.name || s.id, cx, cy + 96);
          }
        });
        if (r.key === "audit"){ PHI.fillRR(c, x0 + pw - 170, 22, 150, 22, 4, "#3A2E1E"); c.fillStyle = "#F4E9CF"; c.font = PHI.FD(600, 10); c.textAlign = "center"; c.fillText("يرفع تقاريره للمالك مباشرة", x0 + pw - 95, 37); }
      } else if (st === "building"){
        c.fillStyle = "#C9B48A"; c.fillRect(x0 + 8, 10, pw - 16, AH - 20);
        c.fillStyle = "rgba(0,0,0,.06)"; for (let k = 0; k < 40; k++){ c.fillRect(x0 + 12 + (k*97 % (pw - 30)), 14 + (k*53 % (AH - 30)), 6, 3); }
        // scaffold
        c.strokeStyle = "#8C6A3A"; c.lineWidth = 3;
        for (let k = 0; k < 6; k++){ const sx = x0 + 70 + k*60; c.beginPath(); c.moveTo(sx, 60); c.lineTo(sx, AH - 30); c.stroke(); }
        for (let y = 80; y < AH - 30; y += 50){ c.beginPath(); c.moveTo(x0 + 70, y); c.lineTo(x0 + 370, y); c.stroke(); }
        // crane
        const mx = x0 + pw - 90; c.strokeStyle = "#E0A12E"; c.lineWidth = 4; c.beginPath(); c.moveTo(mx, AH - 20); c.lineTo(mx, 24); c.lineTo(mx - 240, 24); c.stroke();
        c.lineWidth = 1.5; for (let y = 30; y < AH - 20; y += 16){ c.beginPath(); c.moveTo(mx - 6, y); c.lineTo(mx + 6, y + 16); c.stroke(); }
        const sw = reduce.matches ? 0 : Math.sin(t*1.2) * 10, hx = mx - 160 + sw;
        c.strokeStyle = "#333"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mx - 160, 24); c.lineTo(hx, 120); c.stroke();
        PHI.fillRR(c, hx - 22, 120, 44, 18, 2, "#B4532A");
        // workers
        for (const [wx, ph] of [[x0 + 120, 0], [x0 + 260, 1.7]]){
          const wy = AH - 40; PHI.ell(c, wx, wy - 40, 9, 9); c.fillStyle = "#E3B085"; c.fill();
          c.fillStyle = "#F2C230"; c.beginPath(); c.arc(wx, wy - 44, 10, Math.PI, 0); c.fill();
          PHI.fillRR(c, wx - 9, wy - 30, 18, 24, 5, "#E8742B"); PHI.fillRR(c, wx - 8, wy - 7, 6, 14, 2, "#2F3A4A"); PHI.fillRR(c, wx + 2, wy - 7, 6, 14, 2, "#2F3A4A");
          const a = reduce.matches ? -1 : -1 + Math.sin(t*7 + ph) * 0.7; c.save(); c.translate(wx + 8, wy - 26); c.rotate(a); c.fillStyle = "#E8742B"; c.fillRect(0, -2, 14, 5); c.fillStyle = "#555"; c.fillRect(13, -6, 4, 12); c.restore();
          if (!reduce.matches && Math.sin(t*7 + ph) > 0.9){ c.fillStyle = "#FFD27A"; for (let k = 0; k < 4; k++){ PHI.ell(c, wx + 26 + k*3, wy - 28 - k*4, 1.6, 1.6); c.fill(); } }
        }
        const since = roomSince(r.key), pct = since ? Math.min(92, Math.round((Date.now() - since) / (20*60e3) * 92)) : 10;
        PHI.fillRR(c, x0 + 40, AH - 34, pw - 80, 12, 6, "rgba(0,0,0,.18)"); PHI.fillRR(c, x0 + 40, AH - 34, (pw - 80) * pct/100, 12, 6, "#E0A12E");
        c.fillStyle = "#3A2E1E"; c.font = PHI.FD(600, 12); c.textAlign = "center"; c.direction = "rtl"; PHI.fillRR(c, x0 + pw/2 - 150, 14, 300, 26, 6, "rgba(244,233,207,.92)"); c.fillText(`قيد البناء: ${r.label} · زيد يجهز الموظفين`, x0 + pw/2, 32);
      } else {
        c.setLineDash([10, 8]); c.strokeStyle = P.muted; c.lineWidth = 2; c.strokeRect(x0 + 14, 16, pw - 28, AH - 32); c.setLineDash([]);
        c.fillStyle = "rgba(140,152,147,.08)"; c.fillRect(x0 + 14, 16, pw - 28, AH - 32);
        const sx = x0 + pw/2; c.fillStyle = "#8C6A3A"; c.fillRect(sx - 3, 150, 6, 90);
        PHI.fillRR(c, sx - 110, 92, 220, 64, 6, "#F4E9CF"); c.strokeStyle = "#8C6A3A"; c.lineWidth = 3; PHI.rr(c, sx - 110, 92, 220, 64, 6); c.stroke();
        c.fillStyle = "#3A2E1E"; c.font = PHI.FD(700, 18); c.textAlign = "center"; c.direction = "rtl"; c.fillText(`قريباً: ${r.label}`, sx, 120);
        c.font = PHI.FD(400, 12); c.fillText(`${r.seats} موظفين · ${r.note}`, sx, 142);
      }
    });
  }
  acv.addEventListener("click", (ev) => {
    const r = acv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * AW, y = (ev.clientY - r.top) / r.height * AH;
    for (const [id, rec] of annexRecs){ if (Math.abs(x - rec.pos.x) < 26 && y > rec.pos.y - 90 && y < rec.pos.y + 20 && window.PHIVN){ window.PHIVN.open(id); return; } }
  });

  /* ================= 6) swipe decisions + signature ================= */
  const deck = h("div", {class:"deck", hidden:true, role:"dialog", "aria-modal":"true", "aria-label":"قرارات سريعة"});
  const deckStack = h("div", {class:"deck-stack"});
  const deckTop = h("div", {class:"deck-top"}, h("button", {class:"vn-pill", type:"button", onclick: () => closeDeck()}, "سكّر"), h("span", {class:"vn-pill deck-count"}));
  const deckHint = h("div", {class:"deck-hint"}, h("span", null, "← رفض / بعدين"), h("span", null, "↑ رد"), h("span", null, "موافق / أجاوب →"));
  const deckBtns = h("div", {class:"deck-btns"});
  deck.append(deckTop, deckStack, deckHint, deckBtns);
  document.body.append(deck);
  let queue = [], decided = [];
  function openDeck(){
    queue = PHI.S.needs.filter(n => n.status === "open").sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    decided = []; if (window.PHIVN) window.PHIVN.close();
    deck.hidden = false; document.documentElement.style.overflow = "hidden"; renderDeck();
  }
  async function closeDeck(){
    deck.hidden = true; document.documentElement.style.overflow = "";
    if (decided.length && window.PHIWake){
      const txt = "[قرارات المالك من البطاقات السريعة] " + decided.map(d => `«${d.title}»: ${d.label}${d.reply ? " — " + d.reply : ""}`).join(" · ");
      const ok = await window.PHIWake(txt); toast(ok ? `⚡ ${decided.length} قرارات وصلت لزيد.` : `انحفظت ${decided.length} قرارات على اللوحة.`);
    }
    decided = [];
  }
  function cardEl(n, top){
    const appr = n.kind === "approval";
    const ta = h("textarea", {class:"deck-reply", placeholder: appr ? "ملاحظة (اختياري)" : "اكتب جوابك…", id: "dr-" + n.id, "aria-label":"ردك"});
    const el = h("article", {class:"deck-card" + (top ? " top" : ""), "data-id": n.id},
      h("div", {class:"deck-kind"}, h("span", {class:"tag"}, appr ? "موافقة" : n.kind === "decision" ? "قرار" : "معلومة"), h("span", {class:"deck-from", style:`--dc:${PHI.dc((PHI.staffById(n.from) || {}).dept)}`}, nameOf(n.from))),
      h("h3", null, n.title || n.id), n.detail ? h("p", null, n.detail) : null, ta,
      h("div", {class:"deck-stamp ok"}, appr ? "موافق" : "أجاوب"), h("div", {class:"deck-stamp no"}, appr ? "رفض" : "بعدين"));
    return el;
  }
  function renderDeck(){
    deckStack.textContent = ""; deckBtns.textContent = "";
    deck.querySelector(".deck-count").textContent = queue.length ? `باقي ${queue.length}` : "خلصت";
    if (!queue.length){
      deckStack.append(h("div", {class:"deck-done"}, h("b", null, decided.length ? `خلصت ${decided.length} قرارات` : "ماكو قرارات تنتظرك"), h("span", null, "زيد يستلمها من تسكّر.")));
      deckBtns.append(h("button", {class:"vn-send", type:"button", onclick: () => closeDeck()}, "تمام"));
      return;
    }
    queue.slice(0, 3).reverse().forEach((n, i, arr) => { const el = cardEl(n, i === arr.length - 1); el.style.setProperty("--i", String(arr.length - 1 - i)); deckStack.append(el); });
    const top = deckStack.lastChild, n = queue[0], appr = n.kind === "approval";
    deckBtns.append(
      h("button", {class:"deck-b no", type:"button", "aria-label": appr ? "رفض" : "بعدين", onclick: () => act(n, "left")}, "✕"),
      h("button", {class:"deck-b", type:"button", "aria-label":"رد", onclick: () => act(n, "up")}, "✎"),
      h("button", {class:"deck-b ok", type:"button", "aria-label": appr ? "موافق" : "أجاوب", onclick: () => act(n, "right")}, "✓"));
    attachDrag(top, n);
  }
  function attachDrag(el, n){
    let sx = 0, sy = 0, dx = 0, dy = 0, drag = false;
    el.addEventListener("pointerdown", (e) => { if (e.target.closest("textarea")) return; drag = true; sx = e.clientX; sy = e.clientY; el.setPointerCapture(e.pointerId); el.style.transition = "none"; });
    el.addEventListener("pointermove", (e) => { if (!drag) return; dx = e.clientX - sx; dy = e.clientY - sy; el.style.transform = `translate(${dx}px,${dy}px) rotate(${dx/18}deg)`; el.classList.toggle("go-ok", dx > 60); el.classList.toggle("go-no", dx < -60); });
    const end = () => { if (!drag) return; drag = false; el.style.transition = ""; el.classList.remove("go-ok", "go-no");
      if (dx > 110) fly(el, 1, () => act(n, "right")); else if (dx < -110) fly(el, -1, () => act(n, "left")); else if (dy < -110) act(n, "up"); else el.style.transform = ""; dx = dy = 0; };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  }
  function fly(el, dir, done){ el.style.transform = `translate(${dir*innerWidth}px,-60px) rotate(${dir*30}deg)`; el.style.opacity = "0"; setTimeout(done, reduce.matches ? 0 : 260); }
  async function act(n, dir){
    const ta = document.getElementById("dr-" + n.id); const reply = ta ? ta.value.trim() : "";
    const appr = n.kind === "approval";
    if (dir === "up" || (dir === "right" && !appr && !reply)){ if (ta){ ta.classList.add("need"); ta.focus(); } return; }
    if (dir === "left" && !appr){ queue.push(queue.shift()); renderDeck(); return; } // later
    let status = appr ? (dir === "right" ? "approved" : "rejected") : "answered";
    let signature = null;
    if (status === "approved" && ASSETS){ signature = await askSignature(n); if (signature === false) { renderDeck(); return; } }
    const data = { status, owner_reply: reply, decided_at: new Date().toISOString(), decided_via: "swipe" };
    if (signature) data.signature = signature;
    try { await PHI.DB.collection("needs").doc(n.id).update(data); }
    catch (e){ toast("ما انحفظ القرار. جرّب مرة ثانية."); renderDeck(); return; }
    decided.push({ title: n.title, label: status === "approved" ? "موافق" : status === "rejected" ? "رفض" : "جواب", reply });
    queue.shift(); renderDeck();
  }
  // signature pad: resolves asset id, null (skipped) or false (cancelled)
  function askSignature(n){
    return new Promise((resolve) => {
      const pad = h("canvas", {class:"sig-pad", width: 600, height: 220, "aria-label":"مكان التوقيع"});
      const box = h("div", {class:"sig"}, h("h3", null, "وقّع على الموافقة"), h("p", null, n.title), pad);
      const done = h("button", {class:"vn-send", type:"button"}, "اعتمد التوقيع");
      const skip = h("button", {class:"vn-pill", type:"button"}, "بدون توقيع");
      const cancel = h("button", {class:"vn-pill", type:"button"}, "رجوع");
      box.append(h("div", {class:"sig-row"}, cancel, skip, done));
      const wrap = h("div", {class:"sig-wrap"}, box); deck.append(wrap);
      const g = pad.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 220); g.strokeStyle = "#1B2826"; g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round";
      g.fillStyle = "#C3CDC7"; g.fillRect(40, 175, 520, 2);
      let drawing = false, any = false;
      const pt = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 600, (e.clientY - r.top) / r.height * 220]; };
      pad.addEventListener("pointerdown", (e) => { drawing = true; any = true; pad.setPointerCapture(e.pointerId); const [x, y] = pt(e); g.beginPath(); g.moveTo(x, y); });
      pad.addEventListener("pointermove", (e) => { if (!drawing) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); });
      pad.addEventListener("pointerup", () => { drawing = false; });
      const fin = (v) => { wrap.remove(); resolve(v); };
      cancel.addEventListener("click", () => fin(false));
      skip.addEventListener("click", () => fin(null));
      done.addEventListener("click", () => {
        if (!any){ box.querySelector("p").textContent = "ارسم توقيعك أول، أو اختار «بدون توقيع»."; return; }
        done.disabled = true; done.textContent = "يحفظ…";
        pad.toBlob(async (blob) => { try { const r = await ASSETS.upload(blob); fin(r.id); } catch (e){ fin(null); toast("ما انحفظ التوقيع، القرار انحفظ بدونه."); } }, "image/png");
      });
    });
  }

  /* ================= 7) morning brief ================= */
  let briefBusy = false;
  function briefText(){
    const S = PHI.S, today = dayKey();
    const open = S.needs.filter(n => n.status === "open");
    const working = S.staff.filter(s => PHI.visualStatus(s) === "working").map(s => s.name);
    const stuck = S.staff.filter(s => PHI.visualStatus(s) === "stuck").map(s => s.name);
    const standup = S.events.find(e => e.kind === "standup" && e.at && dayKey(toD(e.at)) === today);
    const parts = [ "صباح الخير أستاذ." ];
    if (standup) parts.push(standup.text);
    parts.push(open.length ? `عندك ${open.length} قرارات تنتظرك، أولها: ${open[0].title}.` : "ماكو قرارات تنتظرك.");
    if (stuck.length) parts.push(`عالقين: ${stuck.join("، ")}.`);
    parts.push(working.length ? `يشتغلون هسة: ${working.join("، ")}.` : "ماكو أحد يشتغل هسة.");
    if (wall.next) parts.push(`اجتماعك الجاي: ${wall.next.title} الساعة ${fT.format(wall.next.at)}.`);
    if (wall.unread) parts.push(`وعندك ${wall.unread} إيميل غير مقروء.`);
    return parts.join(" ");
  }
  function speak(text){
    try {
      const ss = window.speechSynthesis; if (!ss) { toast("تلفونك ما يدعم القراءة بالصوت."); return; }
      ss.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "ar-IQ";
      const v = ss.getVoices().find(v => /^ar/i.test(v.lang)); if (v) u.voice = v; else toast("ماكو صوت عربي بجهازك، فالقراءة ممكن تطلع بلكنة ثانية.");
      u.rate = 0.95; ss.speak(u);
    } catch (e) { toast("ما كدرت أشغّل الصوت."); }
  }
  const caption = h("div", {class:"brief-cap", hidden:true});
  if (shell) shell.append(caption);
  async function tour(){
    const cvs = document.getElementById("office"); if (!cvs || reduce.matches) return;
    shell.scrollIntoView({ behavior: "smooth", block: "start" });
    const R = PHI.ROOMS, stops = ["ceo", "meeting", "dev", "marketing", "it"];
    const scr = cvs.parentElement, prevOv = scr.style.overflow; scr.style.overflow = "hidden";
    cvs.style.transition = "transform 1.1s cubic-bezier(.6,0,.2,1)"; cvs.style.transformOrigin = "0 0";
    for (const k of stops){
      const r = R[k], sc = Math.min(2.4, PHI.W / r.w * 0.55);
      const cx = (r.x + r.w/2) / PHI.W, cy = (r.y + r.h/2) / PHI.H;
      cvs.style.transform = `translate(${(0.5 - cx*sc)*100}%, ${(0.5 - cy*sc)*100}%) scale(${sc})`;
      const here = PHI.S.staff.filter(s => { const rec = PHI.recs.get(s.id); return rec && rec.visible && PHI.roomOf(rec.pos.x, rec.pos.y) === k; });
      caption.hidden = false; caption.textContent = `${r.label}${here.length ? " · " + here.map(s => `${s.name} (${PHI.STATUS[PHI.visualStatus(s)].t})`).join("، ") : " · فاضية"}`;
      await new Promise(res => setTimeout(res, 1700));
    }
    cvs.style.transform = ""; caption.hidden = true; await new Promise(res => setTimeout(res, 900)); cvs.style.transition = ""; scr.style.overflow = prevOv;
  }
  async function runBrief(force){
    if (briefBusy) return; briefBusy = true;
    try {
      ls.set("phi-brief-" + dayKey(), "1");
      await tour();
      const txt = briefText();
      if (window.PHIVN && PHI.staffById("ceo")) window.PHIVN.open("ceo", { intro: txt, choices: [
        { label: "ابدأ القرارات السريعة", kind: "fn", fn: () => openDeck() },
        { label: "اقرالي إياها بصوت", kind: "fn", fn: () => speak(txt) },
        { label: "تمام، شكراً", kind: "fn", fn: () => window.PHIVN.close() } ] });
    } finally { briefBusy = false; }
  }
  let autoBriefDone = false;
  function maybeAutoBrief(){
    if (autoBriefDone || !PHI.S.loaded.staff || !PHI.S.loaded.needs || !PHI.S.staff.length) return;
    autoBriefDone = true;
    if (ls.get("phi-brief-" + dayKey())) return;
    setTimeout(() => runBrief(false), 1200);
  }

  /* ================= weekly card (download) ================= */
  async function weeklyCard(){
    if (!DOWN) return;
    const S = PHI.S, cut = weekAgo(), P = PHI.P;
    const done = S.tasks.filter(t => t.status === "done" && toD(t.updated_at) && +toD(t.updated_at) > cut).length;
    const decisions = S.needs.filter(n => n.status !== "open" && toD(n.decided_at) && +toD(n.decided_at) > cut).length;
    const evs = S.events.filter(e => toD(e.at) && +toD(e.at) > cut);
    const highlights = evs.filter(e => e.kind === "done").slice(0, 4).map(e => `${nameOf(e.who)}: ${e.text}`);
    const star = eotw();
    const tok = S.costs.filter(c => toD(c.at) && +toD(c.at) > cut).reduce((a, c) => a + (+c.tokens || 0), 0);
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350; const g = cv.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 1080, 1350); grd.addColorStop(0, "#0D6B62"); grd.addColorStop(1, "#13302D"); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = "rgba(255,255,255,.06)"; for (let i = 0; i < 14; i++){ g.beginPath(); g.arc(80 + i*90, 1200 - (i%3)*60, 40 + (i%4)*18, 0, 7); g.fill(); }
    g.direction = "rtl"; g.textAlign = "right"; g.fillStyle = "#fff";
    g.font = '700 120px "Readex Pro",Tahoma,sans-serif'; g.fillText("φ", 1000, 170);
    g.font = '700 72px "Readex Pro",Tahoma,sans-serif'; g.fillText("أسبوع فاي", 860, 150);
    const f2 = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { timeZone: TZ, day: "numeric", month: "long" });
    g.font = '400 34px "IBM Plex Sans Arabic",Tahoma,sans-serif'; g.fillStyle = "rgba(255,255,255,.8)"; g.fillText(`${f2.format(new Date(cut))} – ${f2.format(new Date())}`, 860, 210);
    const stat = (x, y, n, l) => { g.fillStyle = "rgba(255,255,255,.1)"; g.beginPath(); g.roundRect ? g.roundRect(x - 300, y, 300, 190, 26) : g.rect(x - 300, y, 300, 190); g.fill(); g.textAlign = "center"; g.fillStyle = "#fff"; g.font = '700 84px "Readex Pro",Tahoma'; g.fillText(String(n), x - 150, y + 108); g.font = '400 30px "IBM Plex Sans Arabic",Tahoma'; g.fillStyle = "rgba(255,255,255,.8)"; g.fillText(l, x - 150, y + 160); g.textAlign = "right"; };
    stat(1000, 290, done, "مهمة خلصت"); stat(680, 290, decisions, "قرار اتخذته"); stat(360, 290, evs.length, "حدث بالمكتب");
    g.fillStyle = "#F4E9CF"; g.beginPath(); g.roundRect ? g.roundRect(80, 530, 920, 150, 26) : g.rect(80, 530, 920, 150); g.fill();
    g.fillStyle = "#3A2E1E"; g.font = '600 34px "Readex Pro",Tahoma'; g.fillText("★ موظف الأسبوع", 960, 590); g.font = '700 52px "Readex Pro",Tahoma'; g.fillText(star ? nameOf(star) : "—", 960, 655);
    g.fillStyle = "#fff"; g.font = '600 38px "Readex Pro",Tahoma'; g.fillText("أبرز الشغل", 1000, 770);
    g.font = '400 30px "IBM Plex Sans Arabic",Tahoma'; g.fillStyle = "rgba(255,255,255,.9)";
    (highlights.length ? highlights : ["الأسبوع الجاي نسجل أكثر."]).forEach((tx, i) => { let s = "• " + tx; while (g.measureText(s).width > 900 && s.length > 10) s = s.slice(0, -2); g.fillText(s, 1000, 830 + i*58); });
    g.font = '400 26px "IBM Plex Sans Arabic",Tahoma'; g.fillStyle = "rgba(255,255,255,.65)"; g.fillText(`كلفة الأسبوع: ${fmtTok(tok)} توكن · phi-iraq.org`, 1000, 1290);
    cv.toBlob(async (blob) => {
      try { await DOWN.save({ filename: `phi-week-${dayKey()}.png`, data: blob }); toast("البطاقة جاهزة."); }
      catch (e){ if (!(e && (e.code === "cancelled" || e.code === "declined"))) toast("ما انحفظت البطاقة."); }
    }, "image/png");
  }

  /* ================= toast + loop ================= */
  const toastEl = h("div", {class:"toast", role:"status", hidden:true}); document.body.append(toastEl);
  let toastT = 0;
  function toast(msg){ toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 4200); }
  window.PHIToast = toast;

  PHI.onData.push(() => { onEvents(); renderHeader(); renderCost(); renderAnnexBtns(); maybeAutoBrief(); });
  renderHeader(); renderCost(); renderAnnexBtns();
  let lastA = 0;
  (function loop(now){ requestAnimationFrame(loop); if (document.hidden || now - lastA < 40) return; lastA = now; drawAnnex(now/1000); })(0);
  window.PHIExtras = { openDeck, runBrief, weeklyCard, startWall };
})();
