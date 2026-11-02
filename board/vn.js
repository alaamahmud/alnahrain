/* PHI office: Visual Novel dialogue with any employee + their screen ("ssh") viewer.
   Depends on window.PHI (bridge from index.html) and window.PHIFigure (figure3d.js). */
(function(){
  "use strict";
  const PHI = window.PHI; if (!PHI) return;
  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  let threeP = null;
  function loadThree(){
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threeP) threeP = new Promise((res, rej) => { const s = document.createElement("script"); s.src = THREE_URL; s.onload = () => res(window.THREE); s.onerror = () => { threeP = null; rej(new Error("three")); }; document.head.appendChild(s); });
    return threeP;
  }
  window.PHILoadThree = loadThree;
  const h = PHI.h;
  const EMO = ["happy","calm","focused","tired","stressed","surprised"];

  /* ---------- DOM ---------- */
  const vn = h("div", {class:"vn", hidden:true, role:"dialog", "aria-modal":"true", "aria-label":"حوار مع موظف"});
  const bg = h("div", {class:"vn-bg"});
  const stage = h("canvas", {class:"vn-stage", "aria-hidden":"true"});
  const portrait = h("canvas", {class:"vn-portrait", hidden:true, width:360, height:460, "aria-hidden":"true"});
  const btnBack = h("button", {class:"vn-pill", type:"button"}, "رجوع للمكتب");
  const pill = h("span", {class:"vn-pill vn-status"});
  const btnScreen = h("button", {class:"vn-pill", type:"button"}, "شاشته");
  const nameTag = h("div", {class:"vn-name"});
  const textEl = h("div", {class:"vn-text", "aria-live":"polite"});
  const choicesEl = h("div", {class:"vn-choices"});
  const input = h("input", {id:"vnInput", class:"vn-input", type:"text", autocomplete:"off", placeholder:"اكتب له بكلامك…"});
  const sendBtn = h("button", {class:"vn-send", type:"submit"}, "دز");
  const form = h("form", {class:"vn-form"}, input, sendBtn);
  const note = h("div", {class:"vn-note"});
  const histBtn = h("button", {class:"vn-link", type:"button"}, "السجل");
  const hist = h("div", {class:"vn-hist", hidden:true});
  vn.append(bg, stage, portrait,
    h("div", {class:"vn-top"}, btnBack, pill, h("span", {style:"flex:1"}), btnScreen),
    h("div", {class:"vn-box"}, h("div", {class:"vn-head"}, nameTag, histBtn), hist, textEl, choicesEl, form, note));
  document.body.append(vn);

  const term = h("div", {class:"term", hidden:true, role:"dialog", "aria-modal":"true", "aria-label":"شاشة الموظف"});
  const termTitle = h("span", {class:"term-title"});
  const termBody = h("div", {class:"term-body", dir:"ltr"});
  const termClose = h("button", {class:"term-x", type:"button", "aria-label":"سكّر"}, "×");
  term.append(h("div", {class:"term-win"}, h("div", {class:"term-bar"}, h("i"), h("i"), h("i"), termTitle, termClose), termBody, h("div", {class:"term-foot"})));
  document.body.append(term);

  /* ---------- state ---------- */
  let woke = false;
  let cur = null, turns = [], busy = false, ctl = null, typing = null, talkingUntil = 0, emotion = "calm";
  let r3 = null; // three renderer bundle
  const staff = () => cur && PHI.staffById(cur);

  function personaBlock(s){
    const needs = PHI.S.needs.filter(n => n.from === s.id && n.status === "open").map(n => ({id:n.id, title:n.title, detail:n.detail, kind:n.kind}));
    const tasks = PHI.S.tasks.filter(t => t.owner === s.id && t.status !== "done").map(t => ({id:t.id, title:t.title, status:t.status, note:t.note||""}));
    return { needs, tasks };
  }
  function rules(s){
    const {needs, tasks} = personaBlock(s);
    const st = PHI.STATUS[PHI.visualStatus(s)] ? PHI.STATUS[PHI.visualStatus(s)].t : s.status;
    return [
      `أنت تلعب دور "${s.name}"، ${s.role||""} في قسم ${PHI.DEPT[s.dept]||s.dept} بشركة فاي الافتراضية (نظام محاسبي وإداري عربي للشركات العراقية، phi-iraq.org).`,
      `شخصيتك: ${s.persona || "موظف محترف ومهذب"}.`,
      `تحچي ويه مالك الشركة وجهاً لوجه، باللهجة العراقية المهذبة، جمل قصيرة وطبيعية (أقل من 45 كلمة)، بدون رموز تعبيرية.`,
      `حالتك هسة: ${st}. شنو دتسوي: ${s.activity||"—"}. آخر شي كلته: ${s.quote||"—"}. مزاجك: ${s.mood||"calm"}.`,
      `مهامك: ${JSON.stringify(tasks)}`,
      `أسئلتك المفتوحة للمالك: ${JSON.stringify(needs)}`,
      `قواعد: لا تخترع أرقام أو أسعار أو أسماء عملاء أو حقائق مو موجودة هنا؛ إذا ما تعرف كول ما أعرف. ما تكدر تنشر أو ترسل لزبون أو تصرف فلوس. إذا المالك جاوب على سؤال مفتوح، أكّد شنو فهمت.`,
      `مهم جداً (صدق): إنت هنا رد فوري داخل اللوحة وما تكدر تسوي أي فعل: ما تكدر توزع شغل ولا تشغّل موظف ولا تبدي مهمة ولا تتواصل ويه أحد. رسالة المالك تنحفظ وتنرسل لزيد الحقيقي، وهو اللي يقراها ويوزع الشغل بجلسته. ممنوع تكول «بديت» أو «وزعت» أو «سجلت رسمياً» أو «يشتغلون هسة». إذا طلب المالك شغل، كول بصراحة إن طلبه انرسل لزيد وهو يوزعه، وإنت تنتظر توجيهه. ولا تكول إن أحد يشتغل على شي إلا إذا حالته «يعمل» ومهمته مكتوبة فوق.`,
      `أرجع JSON فقط بهذا الشكل: {"reply":"...","emotion":"happy|calm|focused|tired|stressed|surprised","choices":[{"label":"رد قصير يختاره المالك (أقل من 8 كلمات)","kind":"talk|approve_need|reject_need|answer_need|new_task","need_id":"معرّف من أسئلتك إذا يخص سؤال","value":"الجواب إذا answer_need"}]}`,
      `choices: من 2 إلى 3 ردود طبيعية للمالك مثل لعبة visual novel. إذا عندك سؤال مفتوح ما انجاوب، خلي واحد منها يجاوبه مباشرة.`
    ].join("\n");
  }

  /* ---------- 3D stage ---------- */
  async function initStage(s){
    try {
      const THREE = await loadThree();
      if (!r3){
        const renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: true, alpha: true });
        renderer.outputEncoding = THREE.sRGBEncoding;
        const scene = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
        scene.add(new THREE.HemisphereLight(0xfff4e6, 0x334455, 0.85));
        const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(1.2, 2.4, 2.2); scene.add(key);
        const rim = new THREE.DirectionalLight(0x9fd6ff, 0.6); rim.position.set(-1.6, 2, -1.5); scene.add(rim);
        r3 = { THREE, renderer, scene, cam, fig: null, figId: null, raf: 0, mx: 0, my: 0 };
        vn.addEventListener("pointermove", (e) => { r3.mx = (e.clientX / innerWidth) * 2 - 1; r3.my = (e.clientY / innerHeight) * 2 - 1; });
      }
      if (r3.figId !== s.id){
        if (r3.fig) r3.scene.remove(r3.fig.group);
        r3.fig = window.PHIFigure.build(r3.THREE, PHI.lookOf(s), PHI.shirtOf(s));
        r3.fig.group.rotation.y = -0.18; r3.scene.add(r3.fig.group); r3.figId = s.id;
      }
      stage.hidden = false; portrait.hidden = true;
      const loop = () => {
        if (vn.hidden){ r3.raf = 0; return; }
        r3.raf = requestAnimationFrame(loop);
        const w = stage.clientWidth, hh = stage.clientHeight; const dpr = Math.min(2, devicePixelRatio || 1);
        if (stage.width !== Math.round(w*dpr) || stage.height !== Math.round(hh*dpr)){ r3.renderer.setPixelRatio(dpr); r3.renderer.setSize(w, hh, false); r3.cam.aspect = w / hh; r3.cam.updateProjectionMatrix(); }
        const narrow = w < 640;
        r3.cam.position.set(narrow ? 0 : -0.42, 1.38, narrow ? 3.9 : 3.3); r3.cam.lookAt(narrow ? 0 : -0.42, narrow ? 1.12 : 1.3, 0);
        const t = performance.now()/1000, cs = staff();
        r3.fig.update(t, { mode: "idle", talking: t < talkingUntil, emotion, lookX: -r3.mx*0.6, lookY: r3.my*0.4, gesture: cs && PHI.visualStatus(cs) === "stuck" ? "think" : null });
        r3.renderer.render(r3.scene, r3.cam);
      };
      if (!r3.raf) loop();
    } catch (e){ fallbackPortrait(s); }
  }
  function fallbackPortrait(s){
    stage.hidden = true; portrait.hidden = false;
    const c = portrait.getContext("2d"); c.clearRect(0,0,360,460);
    c.save(); c.translate(180, 430); c.scale(4.6, 4.6); PHI.drawPortrait(c, s); c.restore();
  }

  /* ---------- dialogue ---------- */
  function typeText(txt, done){
    clearInterval(typing); textEl.textContent = ""; let i = 0; const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    talkingUntil = performance.now()/1000 + Math.min(6, txt.length * 0.045);
    if (reduce){ textEl.textContent = txt; done && done(); return; }
    typing = setInterval(() => { i += 2; textEl.textContent = txt.slice(0, i); if (i >= txt.length){ clearInterval(typing); done && done(); } }, 22);
  }
  function setChoices(list){
    choicesEl.textContent = "";
    for (const ch of (list || []).slice(0, 4)){
      const b = h("button", {class:"vn-choice" + (ch.kind === "approve_need" ? " ok" : ch.kind === "reject_need" ? " no" : ""), type:"button"}, ch.label);
      b.addEventListener("click", () => onChoice(ch));
      choicesEl.append(b);
    }
  }
  function say(reply, emo, choices){ emotion = EMO.includes(emo) ? emo : "calm"; typeText(reply, () => setChoices(choices)); renderHist(); }

  let COMMENTS = null; (async () => { try { COMMENTS = await (window.claude && window.claude.use ? window.claude.use("comments") : null); } catch (e) { COMMENTS = null; } })();
  async function wakeZaid(text){
    const s = staff(); if (!s) return false;
    try {
      if (!COMMENTS) return false;
      const can = await COMMENTS.canSendToClaude();
      if (can !== "available") return false;
      const anchor = await COMMENTS.anchorFor(document.getElementById("hTeam") || nameTag);
      await COMMENTS.sendToClaude({ anchor, text: `[رسالة من المالك إلى ${s.name} (${s.id}) عبر شاشة الحوار] ${text}` });
      return true;
    } catch (e) { return false; }
  }
  window.PHIWake = async (text) => { try { if (!COMMENTS) return false; if (await COMMENTS.canSendToClaude() !== "available") return false; const anchor = await COMMENTS.anchorFor(document.getElementById("hMeet")); await COMMENTS.sendToClaude({ anchor, text }); return true; } catch (e) { return false; } };
  async function saveChat(from, text, generated, extra){
    const D = PHI.DB; if (!D || !cur) return;
    try { await D.collection("chats").add(Object.assign({ staff: cur, from, text, at: new Date().toISOString(), generated: !!generated, read: from !== "owner" }, extra || {})); } catch (e) {}
  }
  async function decide(need, status, reply){
    const D = PHI.DB; if (!D) throw new Error("db");
    await D.collection("needs").doc(need).update({ status, owner_reply: reply || "", decided_at: new Date().toISOString(), decided_via: "dialogue:" + cur });
  }

  async function onChoice(ch){
    if (busy) return;
    const s = staff(); if (!s) return;
    if (ch.kind === "screen"){ openScreen(s.id); return; }
    if (ch.kind === "focus"){ input.focus(); return; }
    if (ch.kind === "approve_need" || ch.kind === "reject_need" || ch.kind === "answer_need"){
      const need = PHI.S.needs.find(n => n.id === ch.need_id);
      if (!need){ return send(ch.label); }
      if (ch.kind === "answer_need" && !ch.value){ input.value = ""; input.placeholder = "اكتب جوابك على: " + need.title; input.focus(); input.dataset.need = need.id; return; }
      try {
        await decide(need.id, ch.kind === "approve_need" ? "approved" : ch.kind === "reject_need" ? "rejected" : "answered", ch.kind === "answer_need" ? ch.value : ch.label);
        note.textContent = `انحفظ قرارك على «${need.title}» باللوحة.`;
      } catch (e){ note.textContent = "ما انحفظ القرار. جرّب من قسم «ينتظر قرارك»."; return; }
      return send(`${ch.label} (قرار المالك على: ${need.title})`, null, true);
    }
    if (ch.kind === "new_task") return send(ch.label, { needs_ceo: true }, true);
    return send(ch.label);
  }

  async function send(text, extra, wake){
    const s = staff(); if (!s || !text) return;
    turns.push({ role: "user", content: text });
    await saveChat("owner", text, false, extra);
    renderHist();
    if (wake){ wakeZaid(text).then(ok => { woke = ok; note.textContent = ok ? "⚡ وصلت لزيد هسة، وراح يبدي بيها بجلسته." : pendingNote(); }); }
    const SAMPLE = PHI.SAMPLE;
    if (!SAMPLE){
      say("وصلتني رسالتك وانحفظت. زيد يقراها ويبدي من يفتح جلسته.", "calm", [{label:"تمام", kind:"talk"}]);
      note.textContent = "الرد الفوري يحتاج إذن «اسأل Claude» على هاي الصفحة. رسالتك انحفظت للفريق.";
      return;
    }
    busy = true; setChoices([]); textEl.textContent = "…"; talkingUntil = 0; sendBtn.disabled = true;
    ctl = new AbortController();
    const msgs = [{ role: "user", content: rules(s) + "\n\nابدأ المحادثة." }, { role: "assistant", content: JSON.stringify({ reply: openingText(s), emotion: "calm", choices: [] }) }, ...turns.slice(-10)];
    try {
      const out = await SAMPLE.json(msgs, { signal: ctl.signal, cache: false, modelTier: "quick" });
      const reply = String((out && out.reply) || "…").slice(0, 400);
      const choices = Array.isArray(out && out.choices) ? out.choices.filter(c => c && c.label).map(c => ({ label: String(c.label).slice(0, 60), kind: c.kind, need_id: c.need_id, value: c.value })) : [];
      turns.push({ role: "assistant", content: JSON.stringify({ reply, emotion: out && out.emotion, choices }) });
      await saveChat(s.id, reply, true);
      say(reply, out && out.emotion, choices.length ? choices : [{label:"تمام", kind:"talk"}]);
      note.textContent = woke ? "⚡ وصلت لزيد هسة. الرد هنا فوري من الصفحة، والشغل الحقيقي يبديه زيد." : pendingNote();
    } catch (e){
      const msg = e && e.code === "not_granted" ? "ما انطى إذن «اسأل Claude»، فالرد الفوري متوقف. رسالتك انحفظت للفريق." : e && e.code === "rate_limited" ? "أكو ضغط هسة، جرّب بعد شوي." : e && e.code === "cancelled" ? "" : "ما كدرت أرد هسة. رسالتك انحفظت للفريق.";
      if (msg) note.textContent = msg;
      say(e && e.text ? String(e.text).slice(0, 300) : "وصلتني. أرد عليك بعدين.", "calm", [{label:"تمام", kind:"talk"}]);
    } finally { busy = false; sendBtn.disabled = false; }
  }

  function pendingNote(){
    const n = (PHI.S.chats || []).filter(m => m.from === "owner" && !m.read).length;
    return "هذا رد فوري من الصفحة بشخصية الموظف، وما يشغّل أحد. زيد الحقيقي يقرا رسائلك ويبدي الشغل من يفتح جلسته" + (n ? ` (رسائل تنتظره: ${n})` : "") + ". إذا مستعجل اكتبله بمحادثة Claude Code.";
  }
  function openingText(s){
    const needs = PHI.S.needs.filter(n => n.from === s.id && n.status === "open");
    const st = PHI.visualStatus(s);
    if (st === "off") return "هلا أستاذ، أني خارج الدوام هسة، بس تفضل.";
    if (needs.length) return `${s.quote ? s.quote + " " : "هلا أستاذ. "}عندي سؤال إلك: ${needs[0].title}.`;
    if (st === "working") return `هلا أستاذ! هسة دا ${s.activity || "أشتغل"}.`;
    return `هلا أستاذ، تفضل. ${s.activity ? "آخر شي سويته: " + s.activity + "." : ""}`;
  }
  function openingChoices(s){
    const need = PHI.S.needs.find(n => n.from === s.id && n.status === "open");
    const ch = [];
    if (need){
      if (need.kind === "approval"){ ch.push({label:"موافق", kind:"approve_need", need_id:need.id}, {label:"لا، ما أوافق", kind:"reject_need", need_id:need.id}); }
      else ch.push({label:"أجاوبك هسة", kind:"answer_need", need_id:need.id});
      ch.push({label:"فهمني أكثر عنه", kind:"talk"});
    } else {
      ch.push({label:"شلون ماشي الشغل؟", kind:"talk"}, {label:"شنو تحتاج مني؟", kind:"talk"});
    }
    if (PHI.visualStatus(s) === "working" || (s.screen||[]).length) ch.push({label:"خليني أشوف شاشتك", kind:"screen"});
    return ch;
  }
  function renderHist(){
    hist.textContent = "";
    const s = staff(); if (!s) return;
    for (const tn of turns.slice(-12)){
      let txt = tn.content; if (tn.role === "assistant"){ try { txt = JSON.parse(tn.content).reply; } catch (e) {} }
      hist.append(h("div", {class:"vn-hl" + (tn.role === "user" ? " me" : "")}, h("b", null, tn.role === "user" ? "إنت" : s.name), " ", txt));
    }
  }
  function syncHead(){
    const s = staff(); if (!s) return;
    const st = PHI.visualStatus(s);
    nameTag.textContent = `${s.name} · ${s.role || ""}`;
    nameTag.style.setProperty("--dc", PHI.dc(s.dept));
    pill.textContent = PHI.STATUS[st].t; pill.style.color = PHI.STATUS[st].c;
    bg.style.setProperty("--dc", PHI.dc(s.dept));
  }

  async function open(id){
    const s = PHI.staffById(id); if (!s) return;
    if (cur !== id){ turns = []; }
    cur = id; vn.hidden = false; document.documentElement.style.overflow = "hidden";
    syncHead(); note.textContent = pendingNote(); input.value = ""; input.placeholder = "اكتب له بكلامك…"; delete input.dataset.need;
    initStage(s);
    // load recent chat lines for continuity
    const D = PHI.DB;
    if (D && !turns.length){
      try {
        const snap = await D.collection("chats").where("staff", "==", id).orderBy("at", "desc").limit(10).get();
        turns = snap.docs.filter(d => d.exists).map(d => d.data()).reverse().map(m => m.from === "owner" ? { role:"user", content:m.text } : { role:"assistant", content: JSON.stringify({ reply: m.text }) });
      } catch (e) {}
    }
    renderHist();
    say(openingText(s), s.mood === "stressed" ? "stressed" : s.mood === "happy" ? "happy" : "calm", openingChoices(s));
    setTimeout(() => btnBack.focus(), 50);
  }
  function close(){
    vn.hidden = true; document.documentElement.style.overflow = ""; ctl && ctl.abort(); clearInterval(typing);
  }
  btnBack.addEventListener("click", close);
  btnScreen.addEventListener("click", () => cur && openScreen(cur));
  histBtn.addEventListener("click", () => { hist.hidden = !hist.hidden; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); const v = input.value.trim(); if (!v || busy) return;
    const needId = input.dataset.need; input.value = ""; input.placeholder = "اكتب له بكلامك…"; delete input.dataset.need;
    if (needId){
      const need = PHI.S.needs.find(n => n.id === needId);
      try { await decide(needId, "answered", v); note.textContent = `انحفظ جوابك على «${need ? need.title : needId}».`; } catch (err){ note.textContent = "ما انحفظ الجواب على اللوحة."; }
      return send(`${v} (جواب المالك على: ${need ? need.title : needId})`, null, true);
    }
    send(v, null, true);
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape"){ if (!term.hidden) closeScreen(); else if (!vn.hidden) close(); } });

  /* ---------- screen viewer ---------- */
  const TF = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit" });
  let termId = null, termTyped = 0;
  function openScreen(id){ termId = id; term.hidden = false; termTyped = 0; renderScreen(); termClose.focus(); }
  function closeScreen(){ term.hidden = true; termId = null; }
  termClose.addEventListener("click", closeScreen);
  term.addEventListener("click", (e) => { if (e.target === term) closeScreen(); });
  function renderScreen(){
    if (term.hidden || !termId) return;
    const s = PHI.staffById(termId); if (!s) return;
    const st = PHI.visualStatus(s);
    termTitle.textContent = `${termId}@phi-office: ~ — ${s.name}`;
    termBody.textContent = "";
    const lines = (s.screen || []).slice(-24);
    if (!lines.length) termBody.append(h("div", {class:"tl note"}, "# ماكو نشاط مسجل على هاي الشاشة بعد."));
    lines.forEach((l, i) => {
      const cls = "tl " + (l.kind || "out");
      const pre = l.kind === "cmd" ? "$ " : l.kind === "web" ? "↗ " : l.kind === "file" ? "✎ " : l.kind === "note" ? "# " : "";
      const row = h("div", {class: cls}, l.at ? h("span", {class:"ts"}, TF.format(new Date(l.at)) + "  ") : null, pre + (l.text || ""));
      termBody.append(row);
    });
    if (st === "working") termBody.append(h("div", {class:"tl cmd live"}, `$ ${s.activity ? "# " + s.activity : ""}`, h("span", {class:"cur"})));
    else termBody.append(h("div", {class:"tl note"}, `# الحالة: ${PHI.STATUS[st].t}`));
    term.querySelector(".term-foot").textContent = st === "working" ? "● شغال هسة · السجل من التقارير اللي يرجعها الموظف لزيد" : "السجل من التقارير اللي يرجعها الموظف لزيد";
    termBody.scrollTop = termBody.scrollHeight;
  }

  PHI.onData.push(() => { if (!vn.hidden) syncHead(); renderScreen(); });
  window.PHIVN = { open, close, openScreen };
})();
