/* PHI office: stylised 3D person built from primitives (Three.js r128 global).
   PHIFigure.build(THREE, look, shirtHex) -> { group, update(t, state), meshes }
   state = { mode: "idle"|"walk"|"sit"|"type", talking, emotion, lookX, lookY, phase } */
(function(){
  "use strict";
  function build(THREE, look, shirtHex){
    look = look || {};
    const M = (c, r) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).convertSRGBToLinear(), roughness: r == null ? 0.72 : r, metalness: 0.02 });
    const skin = M(look.skin || "#C68A5E", 0.6), hair = M(look.hair || "#2A2A2A", 0.85), shirt = M(shirtHex || "#3F4A8C", 0.8),
      pants = M(look.pants || "#2F3A4A", 0.85), shoe = M("#1C1C1C", 0.6), dark = M("#151515", 0.4), lip = M("#8E3B3B", 0.6),
      white = M("#F4F4F2", 0.4), hijab = M(look.hijab || "#5F7FA0", 0.9);
    const meshes = [];
    const mesh = (geo, mat, parent, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x||0, y||0, z||0); parent.add(m); meshes.push(m); return m; };
    const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x||0, y||0, z||0); parent.add(g); return g; };

    const root = new THREE.Group();
    const hips = pivot(root, 0, 0.95, 0);
    mesh(new THREE.BoxGeometry(0.32, 0.16, 0.2), pants, hips, 0, -0.02, 0);
    // legs
    const legs = [-1, 1].map(s => {
      const up = pivot(hips, s*0.085, -0.05, 0);
      mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.44, 10), pants, up, 0, -0.22, 0);
      const knee = pivot(up, 0, -0.44, 0);
      mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.42, 10), pants, knee, 0, -0.21, 0);
      mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoe, knee, 0, -0.44, 0.04);
      return { up, knee };
    });
    // torso
    const torso = pivot(hips, 0, 0.04, 0);
    const chest = mesh(new THREE.CylinderGeometry(0.2, 0.165, 0.5, 14), shirt, torso, 0, 0.25, 0);
    chest.scale.z = 0.62;
    mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI*2, 0, Math.PI/2), shirt, torso, 0, 0.49, 0).scale.set(1, 0.32, 0.62);
    if (look.style !== "hijab"){ const col = mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 14), white, torso, 0, 0.53, 0.02); col.rotation.x = Math.PI/2; }
    mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.1, 10), skin, torso, 0, 0.56, 0);
    // arms
    const arms = [-1, 1].map(s => {
      const sh = pivot(torso, s*0.215, 0.46, 0);
      mesh(new THREE.SphereGeometry(0.062, 10, 8), shirt, sh, 0, 0, 0);
      mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.3, 10), shirt, sh, 0, -0.15, 0);
      const el = pivot(sh, 0, -0.3, 0);
      mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.27, 10), skin, el, 0, -0.135, 0);
      mesh(new THREE.SphereGeometry(0.045, 10, 8), skin, el, 0, -0.29, 0);
      return { sh, el, s };
    });
    // head
    const neck = pivot(torso, 0, 0.6, 0);
    const head = pivot(neck, 0, 0.02, 0);
    const skull = mesh(new THREE.SphereGeometry(0.118, 20, 16), skin, head, 0, 0.12, 0);
    skull.scale.set(0.94, 1.06, 1);
    mesh(new THREE.SphereGeometry(0.018, 8, 6), skin, head, 0, 0.105, 0.115).scale.set(1, 1.2, 1);
    [-1, 1].forEach(s => mesh(new THREE.SphereGeometry(0.026, 8, 6), skin, head, s*0.112, 0.115, 0).scale.set(0.5, 1, 0.8));
    const eyes = [-1, 1].map(s => { const w = mesh(new THREE.SphereGeometry(0.02, 10, 8), white, head, s*0.042, 0.135, 0.098); w.scale.set(1.1, 0.9, 0.5); const p = mesh(new THREE.SphereGeometry(0.0115, 8, 6), dark, head, s*0.042, 0.135, 0.108); return { w, p, s }; });
    const brows = [-1, 1].map(s => { const b = mesh(new THREE.BoxGeometry(0.04, 0.009, 0.01), look.style === "hijab" ? M("#3B2A20") : hair, head, s*0.044, 0.172, 0.106); return { b, s }; });
    const mouth = mesh(new THREE.BoxGeometry(0.042, 0.009, 0.01), lip, head, 0, 0.06, 0.11);
    // hair styles
    const st = look.style || "short";
    if (st === "hijab"){
      const scarf = mesh(new THREE.SphereGeometry(0.142, 20, 16, Math.PI*0.66, Math.PI*1.68, 0, Math.PI*0.78), hijab, head, 0, 0.12, 0.004);
      scarf.scale.set(0.98, 1.08, 1.02);
      const top = mesh(new THREE.SphereGeometry(0.143, 20, 12, 0, Math.PI*2, 0, Math.PI*0.34), hijab, head, 0, 0.12, 0.004); top.scale.set(0.98, 1.08, 1.02);
      const drape = mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.17, 18, 1, true), hijab, head, 0, -0.03, -0.005);
      drape.material = hijab.clone(); drape.material.side = THREE.DoubleSide;
    } else if (st !== "bald"){
      const cap = mesh(new THREE.SphereGeometry(0.126, 20, 14, 0, Math.PI*2, 0, Math.PI*0.48), hair, head, 0, 0.125, -0.006);
      cap.scale.set(0.97, 1.08, 1.04);
      mesh(new THREE.SphereGeometry(0.123, 16, 12, Math.PI, Math.PI, Math.PI*0.3, Math.PI*0.42), hair, head, 0, 0.12, -0.004);
      if (st === "curly") for (let i = 0; i < 9; i++){ const a = i/9*Math.PI*2; mesh(new THREE.SphereGeometry(0.042, 8, 6), hair, head, Math.cos(a)*0.08, 0.215 + Math.sin(i)*0.01, Math.sin(a)*0.075 - 0.025); }
      if (st === "side"){ const f = mesh(new THREE.SphereGeometry(0.06, 10, 8), hair, head, -0.05, 0.2, 0.07); f.scale.set(1.4, 0.5, 0.8); }
      if (st === "long"){ mesh(new THREE.BoxGeometry(0.22, 0.28, 0.08), hair, head, 0, 0.0, -0.085); [-1,1].forEach(s => mesh(new THREE.BoxGeometry(0.05, 0.22, 0.09), hair, head, s*0.105, 0.03, 0.0)); }
      if (st === "bun") mesh(new THREE.SphereGeometry(0.055, 10, 8), hair, head, 0, 0.22, -0.09);
    }
    if (look.beard && st !== "hijab"){ const bd = mesh(new THREE.SphereGeometry(0.105, 16, 10, 0, Math.PI*2, Math.PI*0.52, Math.PI*0.4), hair, head, 0, 0.115, 0.012); bd.scale.set(0.95, 1.05, 1.02); }
    if (look.glasses){ const gm = M("#202020", 0.3); [-1, 1].forEach(s => { mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 16), gm, head, s*0.043, 0.135, 0.118); }); mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), gm, head, 0, 0.138, 0.12); }

    let blinkUntil = 0, nextBlink = 1 + Math.random()*3;
    const lerp = (a, b, k) => a + (b - a) * k;
    function update(t, s){
      s = s || {};
      const mode = s.mode || "idle", ph = s.phase || 0;
      const breathe = Math.sin(t*2.1)*0.012;
      torso.scale.set(1, 1 + breathe, 1);
      // legs + hips
      if (mode === "sit"){
        hips.position.y = lerp(hips.position.y, 0.52, 0.2);
        legs.forEach(l => { l.up.rotation.x = lerp(l.up.rotation.x, -1.5, 0.25); l.knee.rotation.x = lerp(l.knee.rotation.x, 1.5, 0.25); });
      } else {
        hips.position.y = lerp(hips.position.y, 0.95 + (mode === "walk" ? Math.abs(Math.cos(ph))*0.025 : 0), 0.3);
        legs.forEach((l, i) => { const sw = mode === "walk" ? Math.sin(ph + i*Math.PI)*0.55 : 0; l.up.rotation.x = lerp(l.up.rotation.x, sw, 0.35); l.knee.rotation.x = lerp(l.knee.rotation.x, mode === "walk" ? Math.max(0, -Math.sin(ph + i*Math.PI))*0.7 : 0, 0.35); });
      }
      // arms
      arms.forEach((a, i) => {
        let sx = 0, sz = a.s*0.08, ex = 0;
        if (mode === "walk"){ sx = Math.sin(ph + (i ? 0 : Math.PI))*0.45; ex = -0.25; }
        else if (mode === "type"){ sx = -0.75 + Math.sin(t*14 + i*1.7)*0.05; ex = -1.0 + Math.sin(t*16 + i)*0.08; sz = a.s*0.05; }
        else if (s.talking){ sx = i ? -0.25 + Math.sin(t*3)*0.15 : 0.02; ex = i ? -0.7 : -0.1; }
        else if (s.gesture === "think" && i === 1){ sx = -2.4; ex = -1.9; sz = 0.25; }
        else { sx = Math.sin(t*1.2 + i)*0.03; ex = -0.08; }
        a.sh.rotation.x = lerp(a.sh.rotation.x, sx, 0.25); a.sh.rotation.z = lerp(a.sh.rotation.z, sz, 0.25); a.el.rotation.x = lerp(a.el.rotation.x, ex, 0.25);
      });
      // head look + nod
      const lx = (s.lookX || 0) * 0.5, ly = (s.lookY || 0) * 0.25;
      head.rotation.y = lerp(head.rotation.y, lx + Math.sin(t*0.4)*0.06, 0.08);
      head.rotation.x = lerp(head.rotation.x, ly + (s.talking ? Math.sin(t*5)*0.04 : 0) + (mode === "type" ? 0.18 : 0), 0.1);
      head.rotation.z = lerp(head.rotation.z, (s.emotion === "surprised" ? 0.05 : 0) + Math.sin(t*0.7)*0.02, 0.05);
      // blink + emotion
      if (t > nextBlink){ blinkUntil = t + 0.13; nextBlink = t + 2.5 + Math.random()*3.5; }
      const tired = s.emotion === "tired";
      const open = t < blinkUntil ? 0.08 : tired ? 0.5 : s.emotion === "surprised" ? 1.25 : 1;
      eyes.forEach(e => { e.w.scale.y = 0.9*open; e.p.scale.y = open; e.p.position.x = e.s*0.042 + (s.lookX||0)*0.006; });
      const emo = s.emotion || "calm";
      brows.forEach(b => {
        const lift = emo === "surprised" ? 0.016 : emo === "happy" ? 0.006 : tired ? -0.004 : 0;
        const tilt = emo === "stressed" ? -b.s*0.35 : emo === "focused" ? b.s*0.22 : emo === "happy" ? -b.s*0.1 : 0;
        b.b.position.y = lerp(b.b.position.y, 0.172 + lift, 0.2); b.b.rotation.z = lerp(b.b.rotation.z, tilt, 0.2);
      });
      const talkOpen = s.talking ? 1 + Math.abs(Math.sin(t*17))*3.2 : 1;
      mouth.scale.y = lerp(mouth.scale.y, talkOpen, 0.5);
      mouth.scale.x = lerp(mouth.scale.x, emo === "happy" && !s.talking ? 1.3 : 1, 0.2);
    }
    return { group: root, update, meshes, head };
  }
  window.PHIFigure = { build };
})();
