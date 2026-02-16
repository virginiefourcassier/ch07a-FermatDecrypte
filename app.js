/* Modélisation simple (canvas) — Ag2S + Al + H2O -> Ag + Al(OH)3 + H2S
   Objectif pédagogique: observer l'évolution et repérer réactif limitant.

   Remarque: pour préserver l'idée de proportions stœchiométriques, la réaction
   est déclenchée quand une collision Al <-> Ag2S survient ET que les quantités
   disponibles permettent un "paquet" stœchiométrique complet:
     3 Ag2S + 2 Al + 6 H2O  -> 6 Ag + 2 Al(OH)3 + 3 H2S
*/
(() => {
  "use strict";

  // ---------- DOM ----------
  const canvas = document.getElementById("sim");
  const ctx = canvas.getContext("2d");

  const ag2sRange = document.getElementById("ag2sRange");
  const alRange   = document.getElementById("alRange");
  const h2oRange  = document.getElementById("h2oRange");
  const tRange    = document.getElementById("tRange");

  const ag2sVal = document.getElementById("ag2sVal");
  const alVal   = document.getElementById("alVal");
  const h2oVal  = document.getElementById("h2oVal");
  const tVal    = document.getElementById("tVal");

  const pauseBtn  = document.getElementById("pauseBtn");
  const resetBtn  = document.getElementById("resetBtn");
  const labelsBtn = document.getElementById("labelsBtn");

  const C = {
    ag2s: document.getElementById("c_ag2s"),
    al: document.getElementById("c_al"),
    h2o: document.getElementById("c_h2o"),
    ag: document.getElementById("c_ag"),
    aloh3: document.getElementById("c_aloh3"),
    h2s: document.getElementById("c_h2s"),
  };

  const diagBox = document.getElementById("diag");

  // ---------- Helpers ----------
  const rand = (a,b) => a + Math.random()*(b-a);
  const clamp = (x,a,b)=> Math.max(a, Math.min(b,x));
  const hypot = Math.hypot;

  // HiDPI
  function resizeCanvas(){
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize", resizeCanvas);

  // ---------- Visual style: "space-filling" glossy spheres ----------
  function drawSphere(x,y,r,color,light=true){
    // shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(x, y + r*0.55, r*0.85, r*0.35, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    // body
    const g = ctx.createRadialGradient(x - r*0.35, y - r*0.35, r*0.2, x, y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, color);
    g.addColorStop(1, "#000000");
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = g;
    ctx.fill();

    // highlight
    if(light){
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x - r*0.35, y - r*0.35, r*0.35, 0, Math.PI*2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
    }

    // subtle rim
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1, r*0.08);
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(text,x,y){
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 3;
    ctx.strokeText(text,x,y);
    ctx.fillText(text,x,y);
    ctx.restore();
  }

  // ---------- Species models (approx. as in the provided picture) ----------
  const COLORS = {
    Ag:  "#cfd3d8",
    S:   "#f2c100",
    Al:  "#9aa0a6",
    O:   "#e11d2e",
    H:   "#f4f5f7",
  };

  // Atom radii in pixels (visual only)
  const R = { Ag:16, S:15, Al:12, O:10, H:7 };

  // Molecule templates: atoms with local offsets
  const TPL = {
    Ag2S: {
      label: "Ag₂S",
      atoms: [
        {e:"Ag", x:-18, y:0, r:R.Ag, c:COLORS.Ag},
        {e:"S",  x:  0, y:0, r:R.S,  c:COLORS.S},
        {e:"Ag", x: 18, y:0, r:R.Ag, c:COLORS.Ag},
      ],
      // collision radius
      cr: 28
    },
    Al: {
      label:"Al",
      atoms: [{e:"Al", x:0, y:0, r:R.Al, c:COLORS.Al}],
      cr: 18
    },
    H2O: {
      label:"H₂O",
      atoms: [
        {e:"O", x:0, y:0, r:R.O, c:COLORS.O},
        {e:"H", x:-12, y:10, r:R.H, c:COLORS.H},
        {e:"H", x: 12, y:10, r:R.H, c:COLORS.H},
      ],
      cr: 16
    },
    Ag: {
      label:"Ag",
      atoms: [{e:"Ag", x:0, y:0, r:R.Ag, c:COLORS.Ag}],
      cr: 18
    },
    AlOH3: {
      label:"Al(OH)₃",
      atoms: [
        {e:"Al", x:0, y:0, r:14, c:COLORS.Al},
        {e:"O", x:-16, y:12, r:9, c:COLORS.O},
        {e:"H", x:-26, y:22, r:6, c:COLORS.H},
        {e:"O", x: 16, y:12, r:9, c:COLORS.O},
        {e:"H", x: 26, y:22, r:6, c:COLORS.H},
        {e:"O", x:  0, y:-18, r:9, c:COLORS.O},
        {e:"H", x:  0, y:-30, r:6, c:COLORS.H},
      ],
      cr: 22
    },
    H2S: {
      label:"H₂S",
      atoms: [
        {e:"S", x:0, y:0, r:14, c:COLORS.S},
        {e:"H", x:-14, y:12, r:7, c:COLORS.H},
        {e:"H", x: 14, y:12, r:7, c:COLORS.H},
      ],
      cr: 18
    }
  };

  // ---------- Simulation state ----------
  let showLabels = false;
  let paused = false;

  // reaction controls (hidden)
  let reactionMul = 1.0;     // via key R
  let trapMode = false;      // via key T
  let diag = false;          // via key P

  // temperature
  let T = 1;

  // all entities
  /** @type {Entity[]} */
  let ents = [];

  class Entity {
    constructor(type, x, y, vx, vy, rot, vr){
      this.type = type;
      this.x=x; this.y=y;
      this.vx=vx; this.vy=vy;
      this.rot = rot || 0;
      this.vr = vr || 0;
      const tpl = TPL[type];
      this.cr = tpl.cr;
      // slight variation to avoid perfect overlaps
      this.seed = Math.random()*1000;
    }
    step(dt){
      // temperature controls agitation (linéaire >> rotation)
      // T agit fortement sur la vitesse de déplacement, et plus modérément sur la rotation.
      const linMul = (0.7 + 0.9*T);   // T=1..8 => ~1.6..7.9 (fort)
      const angMul = (0.3 + 0.2*T);   // T=1..8 => ~0.5..1.9 (modéré)
      const damp = 0.999; // minimal damping
      this.x += this.vx * dt * linMul;
      this.y += this.vy * dt * linMul;
      this.rot += this.vr * dt * angMul;

      this.vx *= damp;
      this.vy *= damp;

      // boundaries
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const r = this.cr;
      if(this.x < r){ this.x=r; this.vx = Math.abs(this.vx); }
      if(this.x > w-r){ this.x=w-r; this.vx = -Math.abs(this.vx); }
      if(this.y < r){ this.y=r; this.vy = Math.abs(this.vy); }
      if(this.y > h-r){ this.y=h-r; this.vy = -Math.abs(this.vy); }
    }
    draw(){
      const tpl = TPL[this.type];
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);

      // atoms
      for(const a of tpl.atoms){
        drawSphere(a.x, a.y, a.r, a.c, true);
      }
      if(showLabels){
        drawLabel(tpl.label, 0, -this.cr-10);
      }

      ctx.restore();
    }
  }

  function clear(){
    // background with subtle vignette
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    const g = ctx.createRadialGradient(w*0.5, h*0.35, 50, w*0.5, h*0.5, Math.max(w,h));
    g.addColorStop(0, "#eef1f6");
    g.addColorStop(1, "#cfd6df");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  }

  // basic repulsion to avoid overlaps
  function resolveCollisions(){
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for(let i=0;i<ents.length;i++){
      const a = ents[i];
      for(let j=i+1;j<ents.length;j++){
        const b = ents[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx,dy);
        const minD = a.cr + b.cr;
        if(dist > 0 && dist < minD){
          const nx = dx / dist, ny = dy / dist;
          const overlap = (minD - dist) * 0.55;
          a.x -= nx*overlap; a.y -= ny*overlap;
          b.x += nx*overlap; b.y += ny*overlap;

          // elastic-ish velocity swap along normal
          const relvx = b.vx - a.vx;
          const relvy = b.vy - a.vy;
          const reln = relvx*nx + relvy*ny;
          if(reln < 0){
            const impulse = -reln * 0.9;
            a.vx -= impulse*nx; a.vy -= impulse*ny;
            b.vx += impulse*nx; b.vy += impulse*ny;
          }
        }
      }
      // keep in bounds after pushes
      a.x = clamp(a.x, a.cr, w-a.cr);
      a.y = clamp(a.y, a.cr, h-a.cr);
    }
  }

  // ---------- Reaction logic ----------
  function count(type){
    let n=0;
    for(const e of ents) if(e.type===type) n++;
    return n;
  }

  function removeSome(type, n, nearX, nearY){
    // remove up to n, prefer closest to (nearX,nearY) to keep visual coherence
    const idx = [];
    for(let i=0;i<ents.length;i++){
      if(ents[i].type===type){
        const dx = ents[i].x - nearX, dy = ents[i].y - nearY;
        idx.push([i, dx*dx+dy*dy]);
      }
    }
    idx.sort((a,b)=>a[1]-b[1]);
    const toRemove = idx.slice(0,n).map(p=>p[0]).sort((a,b)=>b-a);
    for(const k of toRemove) ents.splice(k,1);
  }

  function spawn(type, n, x, y){
    for(let i=0;i<n;i++){
      const vx = rand(-60,60);
      const vy = rand(-60,60);
      const rot = rand(0,Math.PI*2);
      const vr = rand(-0.9, 0.9);
      const ex = x + rand(-18,18);
      const ey = y + rand(-18,18);
      ents.push(new Entity(type, ex, ey, vx, vy, rot, vr));
    }
  }

  function reactionProbability(){
    // more T => more probability; trapMode reduces it.
    const base = 0.020; // probabilité de base
    const tFactor = (0.5 + 0.75*T); // T=1..8 : effet plus marqué
    const trap = trapMode ? 0.35 : 1.0;
    return base * tFactor * reactionMul * trap;
  }

  function tryReact(){
    // detect collisions Al <-> Ag2S
    const p = reactionProbability();
    if(Math.random() > p) return;

    // ensure stoichiometric packet available
    if(count("Ag2S") < 3) return;
    if(count("Al")   < 2) return;
    if(count("H2O")  < 6) return;

    // pick a candidate collision pair
    for(let i=0;i<ents.length;i++){
      const a = ents[i];
      if(a.type !== "Al") continue;
      for(let j=0;j<ents.length;j++){
        const b = ents[j];
        if(b.type !== "Ag2S") continue;
        const d = hypot(b.x-a.x, b.y-a.y);
        if(d < a.cr + b.cr + 6){
          const cx = (a.x+b.x)/2;
          const cy = (a.y+b.y)/2;

          // consume packet (prefer local)
          removeSome("Ag2S", 3, cx, cy);
          removeSome("Al",   2, cx, cy);
          removeSome("H2O",  6, cx, cy);

          // produce
          spawn("Ag",     6, cx, cy);
          spawn("AlOH3",  2, cx, cy);
          spawn("H2S",    3, cx, cy);

          // small "kick"
          for(const e of ents){
            const dx = e.x - cx, dy = e.y - cy;
            const dd = Math.hypot(dx,dy);
            if(dd < 120 && dd > 0){
              const k = (120-dd)/120;
              e.vx += (dx/dd) * 40*k;
              e.vy += (dy/dd) * 40*k;
            }
          }
          return;
        }
      }
    }
  }

  // ---------- Initialization ----------
  function randomSpawn(type, n){
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for(let i=0;i<n;i++){
      const x = rand(40, w-40);
      const y = rand(60, h-40);
      const vx = rand(-70,70);
      const vy = rand(-70,70);
      const rot = rand(0,Math.PI*2);
      const vr = rand(-0.7, 0.7);
      ents.push(new Entity(type, x, y, vx, vy, rot, vr));
    }
  }

  function reset(){
    ents = [];
    randomSpawn("Ag2S", +ag2sRange.value);
    randomSpawn("Al",   +alRange.value);
    randomSpawn("H2O",  +h2oRange.value);

    // products start at 0
    updateCounts();
  }

  function updateCounts(){
    C.ag2s.textContent = String(count("Ag2S"));
    C.al.textContent   = String(count("Al"));
    C.h2o.textContent  = String(count("H2O"));
    C.ag.textContent   = String(count("Ag"));
    C.aloh3.textContent= String(count("AlOH3"));
    C.h2s.textContent  = String(count("H2S"));
  }

  // ---------- UI wiring ----------
  function bindRange(rng, out){
    const f = ()=>{ out.textContent = rng.value; };
    rng.addEventListener("input", f);
    f();
  }
  bindRange(ag2sRange, ag2sVal);
  bindRange(alRange, alVal);
  bindRange(h2oRange, h2oVal);
  bindRange(tRange, tVal);

  tRange.addEventListener("input", ()=>{ T = +tRange.value; });

  pauseBtn.addEventListener("click", ()=>{
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ Reprendre" : "⏸ Pause";
  });

  resetBtn.addEventListener("click", ()=>{
    paused = false;
    pauseBtn.textContent = "⏸ Pause";
    reset();
  });

  labelsBtn.addEventListener("click", ()=>{
    showLabels = !showLabels;
    labelsBtn.textContent = showLabels ? "🏷️ Symboles : ON" : "🏷️ Symboles : OFF";
  });

  // When changing initial counts, keep current products but reset fully to avoid confusion
  [ag2sRange, alRange, h2oRange].forEach(el => el.addEventListener("change", reset));

  // hidden keys
  window.addEventListener("keydown", (e)=>{
    const k = e.key.toLowerCase();
    if(k==="p"){ diag = !diag; diagBox.style.display = diag ? "block" : "none"; }
    if(k==="r"){
      if(reactionMul < 1.6) reactionMul = 2.2;
      else if(reactionMul < 2.5) reactionMul = 3.2;
      else reactionMul = 1.0;
    }
    if(k==="t"){ trapMode = !trapMode; }
  });

  // ---------- Main loop ----------
  resizeCanvas();
  reset();
  T = +tRange.value;

  let last = performance.now();
  let fps = 0, fpsAcc=0, fpsN=0, fpsLast=performance.now();

  function frame(now){
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last)/1000);
    last = now;

    if(!paused){
      for(const e of ents) e.step(dt);

      // collisions + anti-overlap
      resolveCollisions();

      // attempt reactions (multiple tries per frame at higher T)
      const tries = 1 + Math.floor((T-1)/2);
      for(let i=0;i<tries;i++) tryReact();

      updateCounts();
    }

    clear();
    for(const e of ents) e.draw();

    // diag
    fpsAcc += 1/dt; fpsN++;
    if(now - fpsLast > 350){
      fps = fpsAcc / fpsN;
      fpsAcc=0; fpsN=0; fpsLast=now;
      if(diag){
        diagBox.innerHTML =
          "<b>Diagnostic</b><br>" +
          "fps: " + fps.toFixed(0) + "<br>" +
          "T: " + T + "<br>" +
          "réaction×: " + reactionMul.toFixed(1) + "<br>" +
          "piège: " + (trapMode ? "ON" : "OFF") + "<br>" +
          "entités: " + ents.length;
      }
    }
  }
  requestAnimationFrame(frame);
})();
