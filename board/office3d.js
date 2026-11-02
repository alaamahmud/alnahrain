/* PHI office: walk through any room in 3D (first person), watch the team live.
   Mirrors the 2D simulation (window.PHI.recs) so people are in the same place in both views. */
(function(){
  "use strict";
  const PHI = window.PHI; if (!PHI) return;
  const h = PHI.h, S_ = 0.01, WALL_H = 2.8, EYE = 1.62;

  const ov = h("div", {class:"o3d", hidden:true, role:"dialog", "aria-modal":"true", "aria-label":"المكتب ثلاثي الأبعاد"});
  const cvs = h("canvas", {class:"o3d-canvas", tabindex:"0", "aria-label":"المكتب ثلاثي الأبعاد: اسحب حتى تتلفت، وامشِ بالأسهم أو العصا"});
  const roomBar = h("div", {class:"o3d-rooms"});
  const exitBtn = h("button", {class:"vn-pill", type:"button"}, "طلعني للمخطط");
  const where = h("span", {class:"vn-pill o3d-where"});
  const help = h("div", {class:"o3d-help"}, "اسحب حتى تتلفت · الأسهم أو W A S D حتى تمشي · اضغط على موظف حتى تحچي وياه، أو على شاشته حتى تشوف شغله");
  const stick = h("div", {class:"o3d-stick", "aria-hidden":"true"}, h("i"));
  const msg = h("div", {class:"o3d-msg", hidden:true});
  ov.append(cvs, h("div", {class:"o3d-top"}, exitBtn, where, h("span", {style:"flex:1"})), roomBar, help, stick, msg);
  document.body.append(ov);

  let T3 = null, renderer, scene, cam, raf = 0, built = false;
  const people = new Map(), screens = [], colliders = [], clickables = [];
  let yaw = 0, pitch = 0, pos = { x: 4.15, z: 3.3 };
  const keys = {};
  let joy = null, look = null, dragMoved = false;

  function col(hex){ return new T3.Color(hex).convertSRGBToLinear(); }
  function mat(c, opt){ return new T3.MeshStandardMaterial(Object.assign({ color: col(c), roughness: 0.8, metalness: 0.02 }, opt || {})); }
  function box(w, hh, d, m, x, y, z, parent){ const ms = new T3.Mesh(new T3.BoxGeometry(w, hh, d), m); ms.position.set(x, y, z); (parent || scene).add(ms); return ms; }
  const X = (u) => u * S_, Z = (u) => u * S_;

  function floorTex(kind){
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); const P = PHI.P;
    if (kind === "tile"){ g.fillStyle = P["o-tile"]; g.fillRect(0,0,256,256); g.strokeStyle = P["o-tile-line"]; g.lineWidth = 3; for (let i = 0; i <= 256; i += 64){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,256); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(256,i); g.stroke(); } }
    else if (kind === "carpet"){ g.fillStyle = P["o-carpet"]; g.fillRect(0,0,256,256); g.fillStyle = P["o-carpet-dot"]; for (let y = 4; y < 256; y += 16) for (let x = (y/16)%2 ? 12 : 4; x < 256; x += 16) g.fillRect(x, y, 4, 4); }
    else { g.fillStyle = P[kind === "wood2" ? "o-wood2" : "o-wood"]; g.fillRect(0,0,256,256); g.strokeStyle = P["o-wood-line"]; g.lineWidth = 2; for (let y = 0, r = 0; y < 256; y += 32, r++){ g.beginPath(); g.moveTo(0,y); g.lineTo(256,y); g.stroke(); const o = (r%2) ? 0 : 96; for (let x = o; x < 256; x += 192){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+32); g.stroke(); } } }
    const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.encoding = T3.sRGBEncoding; return t;
  }
  function labelSprite(text, color){
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
    g.font = '600 30px "Readex Pro","IBM Plex Sans Arabic",Tahoma,sans-serif'; g.direction = "rtl"; g.textAlign = "center"; g.textBaseline = "middle";
    const w = Math.min(250, g.measureText(text).width + 30);
    g.fillStyle = "rgba(20,28,27,.72)"; if (g.roundRect){ g.beginPath(); g.roundRect(128 - w/2, 8, w, 48, 16); g.fill(); } else g.fillRect(128 - w/2, 8, w, 48);
    if (color){ g.fillStyle = color; g.beginPath(); g.arc(128 + w/2 - 18, 32, 7, 0, Math.PI*2); g.fill(); }
    g.fillStyle = "#fff"; g.fillText(text, 128 - (color ? 6 : 0), 33);
    const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding;
    const sp = new T3.Sprite(new T3.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(0.6, 0.15, 1); sp.renderOrder = 10; return sp;
  }

  function build(){
    const P = PHI.P, dark = P.dark;
    renderer = new T3.WebGLRenderer({ canvas: cvs, antialias: true });
    renderer.outputEncoding = T3.sRGBEncoding;
    scene = new T3.Scene();
    scene.background = col(dark ? "#0d1418" : "#dfe6e2");
    scene.fog = new T3.Fog(scene.background, 9, 22);
    cam = new T3.PerspectiveCamera(70, 1, 0.05, 60); cam.rotation.order = "YXZ";
    scene.add(new T3.HemisphereLight(dark ? 0x8899aa : 0xffffff, dark ? 0x1a2022 : 0x8a8170, dark ? 0.45 : 0.85));
    const sun = new T3.DirectionalLight(0xffffff, dark ? 0.2 : 0.55); sun.position.set(5, 10, 3); scene.add(sun);
    const R = PHI.ROOMS;
    // floors
    for (const [k, r] of Object.entries(R)){
      const tex = floorTex(r.floor); tex.repeat.set(r.w/120, r.h/120);
      const f = new T3.Mesh(new T3.PlaneGeometry(X(r.w), Z(r.h)), new T3.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      f.rotation.x = -Math.PI/2; f.position.set(X(r.x + r.w/2), 0, Z(r.y + r.h/2)); scene.add(f);
      const lamp = new T3.PointLight(dark ? 0xffd9a0 : 0xffffff, dark ? 0.55 : 0.3, 7); lamp.position.set(X(r.x + r.w/2), 2.6, Z(r.y + r.h/2)); scene.add(lamp);
      box(0.9, 0.03, 0.4, mat("#ffffff", { emissive: col(dark ? "#ffe2b0" : "#ffffff"), emissiveIntensity: dark ? 0.9 : 0.4 }), X(r.x + r.w/2), WALL_H - 0.02, Z(r.y + r.h/2));
    }
    const ct = floorTex("tile"); ct.repeat.set(16, 1);
    const cf = new T3.Mesh(new T3.PlaneGeometry(16, 0.9), new T3.MeshStandardMaterial({ map: ct, roughness: 0.9 })); cf.rotation.x = -Math.PI/2; cf.position.set(8, 0.001, 4.25); scene.add(cf);
    const ceil = new T3.Mesh(new T3.PlaneGeometry(16, 9), mat(dark ? "#1c2427" : "#f2f2ee")); ceil.rotation.x = Math.PI/2; ceil.position.set(8, WALL_H, 4.5); scene.add(ceil);
    // walls (2D units)
    const wallM = mat(dark ? "#2a3533" : "#e9ece6"), trimM = mat(P["o-wall"]);
    const wall = (x1, y1, x2, y2) => { const len = Math.hypot(x2-x1, y2-y1); if (len < 1) return; const horiz = Math.abs(y2-y1) < 1;
      const m = box(horiz ? X(len) : 0.12, WALL_H, horiz ? 0.12 : Z(len), wallM, X((x1+x2)/2), WALL_H/2, Z((y1+y2)/2));
      box(horiz ? X(len) : 0.14, 0.08, horiz ? 0.14 : Z(len), trimM, X((x1+x2)/2), 0.04, Z((y1+y2)/2));
      colliders.push({ x1: Math.min(X(x1), X(x2)) - 0.06, x2: Math.max(X(x1), X(x2)) + 0.06, z1: Math.min(Z(y1), Z(y2)) - 0.06, z2: Math.max(Z(y1), Z(y2)) + 0.06 }); return m; };
    const hwall = (y, rooms) => { let x0 = 0; for (const k of rooms){ const d = R[k].door; wall(x0, y, d - PHI.DOORW/2, y); x0 = d + PHI.DOORW/2; } wall(x0, y, PHI.W, y); };
    wall(0, 0, PHI.W, 0); wall(0, PHI.H, PHI.W, PHI.H); wall(PHI.W, 0, PHI.W, PHI.H); wall(0, 0, 0, 396); wall(0, 454, 0, PHI.H);
    hwall(PHI.CY1, ["tea","library","meeting","ceo"]); hwall(PHI.CY2, ["marketing","dev","it"]);
    for (const x of [270, 560, 1120]) wall(x, 0, x, PHI.CY1);
    for (const x of [540, 1070]) wall(x, PHI.CY2, x, PHI.H);
    // windows on outer walls
    const hour = PHI.bagHour(); const day = hour >= 6 && hour < 18;
    const skyM = mat(day ? "#9fd0ee" : "#1b2a4a", { emissive: col(day ? "#bfe3f7" : "#22345c"), emissiveIntensity: day ? 0.8 : 0.5 });
    for (const [x, w] of [[40,180],[300,240],[600,140],[980,120],[1160,140],[1440,130]]) box(X(w), 1.1, 0.02, skyM, X(x + w/2), 1.6, 0.07);
    for (const [x, w] of [[90,180],[330,160],[640,200],[860,160],[1180,180],[1400,160]]) box(X(w), 1.1, 0.02, skyM, X(x + w/2), 1.6, 8.93);
    // workstations
    const deskM = mat(P["o-desk"]), edgeM = mat(P["o-desk-edge"]), chairM = mat(P["o-chair"]), monM = mat("#1c232b", { roughness: 0.4 });
    for (const st of PHI.ALL_STATIONS){
      const d = st.desk, cx = X(d.x + d.w/2), cz = Z(d.y + d.h/2);
      box(X(d.w), 0.04, Z(d.h), deskM, cx, 0.74, cz); box(X(d.w), 0.08, 0.02, edgeM, cx, 0.7, cz + Z(d.h)/2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.72, 0.04, edgeM, cx + sx*(X(d.w)/2 - 0.05), 0.36, cz + sz*(Z(d.h)/2 - 0.05));
      colliders.push({ x1: cx - X(d.w)/2 - 0.1, x2: cx + X(d.w)/2 + 0.1, z1: cz - Z(d.h)/2 - 0.1, z2: cz + Z(d.h)/2 + 0.05 });
      const mons = st.big ? [0] : st.dual ? [-0.27, 0.27] : [0];
      for (const off of mons){
        const mw = st.dual ? 0.5 : 0.56, mh = 0.32;
        const c = document.createElement("canvas"); c.width = 160; c.height = 96; const tex = new T3.CanvasTexture(c); tex.encoding = T3.sRGBEncoding;
        box(mw + 0.03, mh + 0.03, 0.03, monM, cx + off, 1.0, cz - 0.12);
        box(0.04, 0.2, 0.04, monM, cx + off, 0.84, cz - 0.14); box(0.18, 0.015, 0.12, monM, cx + off, 0.765, cz - 0.14);
        const scr = new T3.Mesh(new T3.PlaneGeometry(mw, mh), new T3.MeshBasicMaterial({ map: tex }));
        scr.position.set(cx + off, 1.0, cz - 0.104); scene.add(scr);
        scr.userData = { kind: "screen", station: st };
        screens.push({ c, g: c.getContext("2d"), tex, st, seed: (off + 1) * 7 }); clickables.push(scr);
      }
      box(0.42, 0.02, 0.14, mat(dark ? "#4b535b" : "#dfe2e4"), cx, 0.77, cz + 0.12);
      const sp = st.spot, chx = X(sp.x), chz = Z(sp.y);
      box(0.46, 0.06, 0.44, chairM, chx, 0.47, chz); box(0.46, 0.5, 0.06, chairM, chx, 0.75, chz + 0.22); box(0.05, 0.45, 0.05, mat("#555"), chx, 0.22, chz);
    }
    // meeting room
    box(3.0, 0.05, 1.1, deskM, 8.4, 0.75, 1.85); box(0.2, 0.72, 0.2, edgeM, 8.4, 0.37, 1.85);
    colliders.push({ x1: 6.85, x2: 9.95, z1: 1.25, z2: 2.45 });
    for (const sp of PHI.MEET_SPOTS){ const cx = X(sp.x), cz = Z(sp.y) + (sp.face === "down" ? -0.05 : sp.face === "up" ? 0.05 : 0); box(0.46, 0.06, 0.44, chairM, cx, 0.47, cz); const back = sp.face === "down" ? -0.22 : sp.face === "up" ? 0.22 : 0; if (back) box(0.46, 0.5, 0.06, chairM, cx, 0.75, cz + back); else box(0.06, 0.5, 0.46, chairM, cx + (sp.face === "right" ? -0.22 : 0.22), 0.75, cz); }
    const tvC = document.createElement("canvas"); tvC.width = 320; tvC.height = 180; const tvTex = new T3.CanvasTexture(tvC); tvTex.encoding = T3.sRGBEncoding;
    box(1.7, 0.98, 0.05, monM, 8.4, 1.75, 0.1); const tv = new T3.Mesh(new T3.PlaneGeometry(1.6, 0.9), new T3.MeshBasicMaterial({ map: tvTex })); tv.position.set(8.4, 1.75, 0.13); scene.add(tv);
    screens.push({ c: tvC, g: tvC.getContext("2d"), tex: tvTex, tv: true });
    // tea corner
    box(1.7, 0.9, 0.5, edgeM, 1.55, 0.45, 0.35); box(1.72, 0.04, 0.52, deskM, 1.55, 0.92, 0.35); colliders.push({ x1: 0.65, x2: 2.45, z1: 0, z2: 0.65 });
    const samovar = new T3.Mesh(new T3.CylinderGeometry(0.12, 0.15, 0.4, 16), mat("#C9A24A", { metalness: 0.6, roughness: 0.3 })); samovar.position.set(1.05, 1.14, 0.35); scene.add(samovar);
    for (let i = 0; i < 4; i++){ const g = new T3.Mesh(new T3.CylinderGeometry(0.03, 0.022, 0.08, 10), mat("#B8681E", { transparent: true, opacity: 0.85 })); g.position.set(1.55 + i*0.15, 0.98, 0.35); scene.add(g); }
    const sofaM = mat(P["o-sofa"]); box(0.5, 0.45, 1.4, sofaM, 0.35, 0.22, 2.2); box(0.15, 0.85, 1.4, sofaM, 0.15, 0.42, 2.2); colliders.push({ x1: 0, x2: 0.65, z1: 1.45, z2: 2.95 });
    const cooler = new T3.Mesh(new T3.CylinderGeometry(0.13, 0.13, 0.35, 14), mat("#7bbbe6", { transparent: true, opacity: 0.7 })); cooler.position.set(2.4, 1.15, 1.1); scene.add(cooler); box(0.3, 0.95, 0.3, mat("#dfe5ea"), 2.4, 0.48, 1.1);
    // library shelves + chairs
    for (let i = 0; i < 3; i++){ const sx = 3.3 + i*0.88; box(0.8, 2.0, 0.3, edgeM, sx, 1.0, 0.25); for (let s = 0; s < 4; s++) for (let b = 0; b < 7; b++) box(0.07, 0.3, 0.2, mat(["#2f7d8c","#c27a1a","#a13b5b","#3f4a8c","#2e7a49"][(b + s + i) % 5]), sx - 0.3 + b*0.1, 0.4 + s*0.45, 0.3); }
    colliders.push({ x1: 2.75, x2: 5.55, z1: 0, z2: 0.45 });
    for (const sp of PHI.LIB_SPOTS) if (sp.chair) { box(0.6, 0.45, 0.55, sofaM, X(sp.x), 0.22, Z(sp.y) - 0.2); box(0.6, 0.5, 0.12, sofaM, X(sp.x), 0.6, Z(sp.y) - 0.45); }
    // IT racks
    const rackM = mat("#1a1f24", { roughness: 0.5 }); const leds = [];
    for (const rx of [15.12, 15.62]){ box(0.46, 1.9, 0.6, rackM, rx, 0.95, 5.4); colliders.push({ x1: rx - 0.3, x2: rx + 0.3, z1: 5.05, z2: 5.75 });
      for (let i = 0; i < 10; i++){ const l = box(0.025, 0.025, 0.01, new T3.MeshBasicMaterial({ color: 0x4bd07a }), rx + 0.12, 0.3 + i*0.16, 5.705); leds.push(l); } }
    scene.userData.leds = leds;
    // dev kanban + marketing printer + banner
    box(1.12, 1.5, 0.05, mat("#fbfbf8"), 10.35, 1.2, 6.9).rotation.y = -Math.PI/2; colliders.push({ x1: 10.25, x2: 10.45, z1: 6.3, z2: 7.5 });
    box(0.6, 0.35, 0.45, mat(dark ? "#4a5058" : "#d9dde0"), 4.55, 0.85, 5.3); box(0.7, 0.68, 0.5, edgeM, 4.55, 0.34, 5.3); colliders.push({ x1: 4.2, x2: 4.9, z1: 5.0, z2: 5.6 });
    box(0.5, 1.0, 0.04, mat(P.accent), 4.7, 0.6, 8.4);
    // plants
    const leaf = mat(P["o-leaf"]), pot = mat(P["o-pot"]);
    for (const [x, y] of [[26,362],[292,362],[582,362],[1142,362],[1585,450],[20,880],[1050,880],[1585,880],[86,394]]){ box(0.24, 0.3, 0.24, pot, X(x), 0.15, Z(y) - 0.12); const b = new T3.Mesh(new T3.SphereGeometry(0.28, 10, 8), leaf); b.position.set(X(x), 0.55, Z(y) - 0.12); b.scale.y = 1.3; scene.add(b); }
    built = true;
  }

  function drawScreens(t){
    for (const s of screens){
      if (s.tv){ const g = s.g, live = PHI.S.meetings.find(m => m.status === "live"); g.fillStyle = live ? "#14303c" : "#10171e"; g.fillRect(0,0,320,180); g.direction = "rtl"; g.textAlign = "center"; g.fillStyle = live ? "#eaf4f1" : "#4f7e78";
        g.font = live ? '600 26px "Readex Pro",Tahoma,sans-serif' : '700 70px "Readex Pro",Tahoma,sans-serif'; g.fillText(live ? (live.title || "اجتماع").slice(0, 20) : "φ", 160, live ? 80 : 115);
        if (live){ g.fillStyle = Math.sin(t*3) > 0 ? "#f06a5c" : "#b8443a"; g.beginPath(); g.arc(250, 130, 8, 0, 7); g.fill(); g.font = '600 18px "Readex Pro",Tahoma'; g.fillText("مباشر", 200, 136); }
        s.tex.needsUpdate = true; continue; }
      PHI.drawScreen(s.g, 0, 0, 160, 96, PHI.screenMode(s.st), t, s.seed); s.tex.needsUpdate = true;
    }
  }

  function syncPeople(t, dt){
    const seen = new Set();
    for (const rec of PHI.recs.values()){
      const s = PHI.staffById(rec.id); if (!s) continue; seen.add(rec.id);
      let p = people.get(rec.id);
      if (!p){
        const fig = window.PHIFigure.build(T3, PHI.lookOf(s), PHI.shirtOf(s));
        fig.group.traverse(o => { if (o.isMesh) o.userData = { kind: "person", id: rec.id }; });
        scene.add(fig.group); clickables.push(...fig.meshes);
        const tag = labelSprite(s.name, PHI.STATUS[PHI.visualStatus(s)].c); scene.add(tag);
        p = { fig, tag, tagKey: "", ry: 0, bubble: null, bubbleKey: "" }; people.set(rec.id, p);
      }
      const st = PHI.visualStatus(s);
      p.fig.group.visible = rec.visible; p.tag.visible = rec.visible;
      const sit = rec.pose === "sit", walk = rec.pose === "walk";
      let ox = 0, oz = 0;
      if (sit && rec.face === "up") oz = 0.05; if (sit && rec.face === "down") oz = -0.05;
      p.fig.group.position.set(X(rec.pos.x) + ox, 0, Z(rec.pos.y) + oz);
      const target = { down: 0, up: Math.PI, right: Math.PI/2, left: -Math.PI/2 }[rec.face] || 0;
      let d = target - p.ry; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2; p.ry += d * Math.min(1, dt*8);
      p.fig.group.rotation.y = p.ry;
      p.fig.update(t, { mode: walk ? "walk" : sit ? ((rec.act === "type" || rec.act === "browse") ? "type" : "sit") : "idle", phase: rec.walk * 0.9, talking: !!(rec.bubble && rec.bubble.until > performance.now()/1000), emotion: s.mood === "stressed" ? "stressed" : s.mood === "happy" ? "happy" : s.mood === "tired" ? "tired" : "calm", gesture: rec.act === "think" ? "think" : null });
      const key = s.name + "|" + st;
      if (p.tagKey !== key){ scene.remove(p.tag); p.tag = labelSprite(s.name, PHI.STATUS[st].c); scene.add(p.tag); p.tagKey = key; }
      p.tag.position.set(X(rec.pos.x), sit ? 1.55 : 1.98, Z(rec.pos.y));
      const b = rec.bubble && rec.bubble.until > performance.now()/1000 ? rec.bubble.text : "";
      if (b !== p.bubbleKey){ if (p.bubble) scene.remove(p.bubble); p.bubble = null; p.bubbleKey = b; if (b){ p.bubble = labelSprite(b.length > 26 ? b.slice(0, 25) + "…" : b, null); p.bubble.scale.set(1.3, 0.32, 1); scene.add(p.bubble); } }
      if (p.bubble) p.bubble.position.set(X(rec.pos.x), sit ? 1.85 : 2.3, Z(rec.pos.y));
    }
    for (const [id, p] of people) if (!seen.has(id)){ scene.remove(p.fig.group); scene.remove(p.tag); p.bubble && scene.remove(p.bubble); people.delete(id); }
  }

  function blocked(x, z){ const r = 0.22; if (x < 0.2 || x > 15.8 || z < 0.2 || z > 8.8) return true; for (const c of colliders) if (x + r > c.x1 && x - r < c.x2 && z + r > c.z1 && z - r < c.z2) return true; return false; }
  function roomName(){ const k = PHI.roomOf(pos.x / S_, pos.z / S_); return PHI.ROOMS[k] ? PHI.ROOMS[k].label : k === "corridor" ? "الممر" : "المدخل"; }

  let last = 0;
  function frame(now){
    if (ov.hidden){ raf = 0; return; }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now; const t = now / 1000;
    const w = cvs.clientWidth, hh = cvs.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (cvs.width !== Math.round(w*dpr) || cvs.height !== Math.round(hh*dpr)){ renderer.setPixelRatio(dpr); renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); }
    // movement
    let f = 0, s = 0;
    if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1; if (keys.KeyA || keys.ArrowLeft) s -= 1; if (keys.KeyD || keys.ArrowRight) s += 1;
    if (joy){ f += -joy.dy; s += joy.dx; }
    const sp = (keys.ShiftLeft || keys.ShiftRight ? 3.2 : 1.8) * dt;
    if (f || s){ const len = Math.hypot(f, s) || 1; f /= Math.max(1, len); s /= Math.max(1, len);
      const dx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp, dz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
      if (!blocked(pos.x + dx, pos.z)) pos.x += dx; if (!blocked(pos.x, pos.z + dz)) pos.z += dz; where.textContent = roomName(); }
    cam.position.set(pos.x, EYE + (f || s ? Math.sin(t*9)*0.015 : 0), pos.z); cam.rotation.set(pitch, yaw, 0);
    if (!drawScreens.last || t - drawScreens.last > 0.25){ drawScreens(t); drawScreens.last = t; }
    const leds = scene.userData.leds || []; leds.forEach((l, i) => { l.visible = Math.sin(t*(3 + (i%5)) + i*1.7) > -0.2; });
    syncPeople(t, dt);
    renderer.render(scene, cam);
  }

  function teleport(k){
    const r = PHI.ROOMS[k]; if (!r) return;
    const bottom = r.y > 0;
    pos = { x: X(r.door), z: bottom ? Z(r.y + 45) : Z(r.y + r.h - 45) };
    yaw = bottom ? Math.PI : 0; pitch = -0.08; where.textContent = r.label;
  }
  async function open(room){
    ov.hidden = false; document.documentElement.style.overflow = "hidden"; msg.hidden = true;
    try { T3 = await window.PHILoadThree(); } catch (e){ msg.hidden = false; msg.textContent = "ما انحمّل محرك الـ 3D. تأكد من الإنترنت وجرّب مرة ثانية."; return; }
    try { if (!built) build(); } catch (e){ msg.hidden = false; msg.textContent = "جهازك ما يدعم عرض 3D (WebGL)."; return; }
    if (!roomBar.childElementCount) for (const [k, r] of Object.entries(PHI.ROOMS)){ const b = h("button", {class:"vn-pill", type:"button"}, r.label); b.addEventListener("click", () => teleport(k)); roomBar.append(b); }
    teleport(room || "dev"); cvs.focus();
    if (!raf){ last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function close(){ ov.hidden = true; document.documentElement.style.overflow = ""; for (const k in keys) keys[k] = false; }
  exitBtn.addEventListener("click", close);
  addEventListener("keydown", (e) => { if (ov.hidden) return; if (e.key === "Escape" && document.querySelector(".vn[hidden]") && document.querySelector(".term[hidden]")) { close(); return; } if (e.target === cvs || e.target === document.body){ keys[e.code] = true; if (e.code.startsWith("Arrow")) e.preventDefault(); } });
  addEventListener("keyup", (e) => { keys[e.code] = false; });

  // pointer: left-bottom quarter = joystick on touch; elsewhere drag to look; tap = interact
  cvs.addEventListener("pointerdown", (e) => {
    cvs.setPointerCapture(e.pointerId); dragMoved = false;
    const r = cvs.getBoundingClientRect();
    if (e.pointerType !== "mouse" && e.clientX - r.left < r.width * 0.4 && e.clientY - r.top > r.height * 0.45){ joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; stick.classList.add("on"); stick.style.left = (e.clientX - r.left - 50) + "px"; stick.style.top = (e.clientY - r.top - 50) + "px"; return; }
    look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
  });
  cvs.addEventListener("pointermove", (e) => {
    if (joy && e.pointerId === joy.id){ joy.dx = Math.max(-1, Math.min(1, (e.clientX - joy.x0) / 45)); joy.dy = Math.max(-1, Math.min(1, (e.clientY - joy.y0) / 45)); stick.firstChild.style.transform = `translate(${joy.dx*30}px,${joy.dy*30}px)`; return; }
    if (look && e.pointerId === look.id){ const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY; if (Math.hypot(e.clientX - look.sx, e.clientY - look.sy) > 6) dragMoved = true; yaw -= dx * 0.005; pitch = Math.max(-1.2, Math.min(1.1, pitch - dy * 0.004)); }
  });
  const endPtr = (e) => {
    if (joy && e.pointerId === joy.id){ joy = null; stick.classList.remove("on"); stick.firstChild.style.transform = ""; return; }
    if (look && e.pointerId === look.id){ const tap = !dragMoved; look = null; if (tap) interact(e); }
  };
  cvs.addEventListener("pointerup", endPtr); cvs.addEventListener("pointercancel", endPtr);
  function interact(e){
    if (!scene) return;
    const r = cvs.getBoundingClientRect(); const v = new T3.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new T3.Raycaster(); ray.setFromCamera(v, cam); ray.far = 8;
    const hit = ray.intersectObjects(clickables, false).find(x => x.object.visible !== false);
    if (!hit) return;
    const u = hit.object.userData || {};
    if (u.kind === "person" && window.PHIVN) window.PHIVN.open(u.id);
    else if (u.kind === "screen" && window.PHIVN){ const occ = PHI.occupantOf(u.station); if (occ) window.PHIVN.openScreen(occ.id); }
  }
  window.PHI3D = { open, close };
})();
