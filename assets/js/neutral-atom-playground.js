/* =========================================================
   NEUTRAL ATOM PLAYGROUND
   Dual-species (171Yb + 87Rb), continuously reloaded,
   cavity-assisted mid-circuit readout.

   One <canvas>, two "views":
     machine : the vacuum system (octagon -> conveyor -> glass cell)
     array   : zoom into the octagon (storage, tweezers, cavity)
   Each step sets up its view and (optionally) a looping sequence.
   ========================================================= */

(function () {
    "use strict";

    const root = document.getElementById("nap");
    if (!root) return;


    /* =========================================================
       DOM
       ========================================================= */

    const canvas = document.getElementById("nap-canvas");
    const mainCtx = canvas.getContext("2d");
    let ctx = mainCtx;

    const el = {
        steps: document.getElementById("nap-steps"),
        label: document.getElementById("nap-sim-label"),
        current: document.getElementById("nap-current"),
        total: document.getElementById("nap-total"),
        title: document.getElementById("nap-title"),
        text: document.getElementById("nap-text"),
        chips: document.getElementById("nap-chips"),
        papers: document.getElementById("nap-papers"),
        papersBox: document.getElementById("nap-papers-box"),
        control: document.getElementById("nap-control"),
        prev: document.getElementById("nap-prev"),
        next: document.getElementById("nap-next"),
        pause: document.getElementById("nap-pause")
    };


    /* =========================================================
       CONSTANTS & HELPERS
       ========================================================= */

    const W = 1000, H = 625, TAU = Math.PI * 2;
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

    const C = {
        text: "#dbe3ee",
        dim: "#8a96a8",
        faint: "#4b5566",
        yb: "#a78bfa",
        rb: "#ff7a59",
        l399: "#8b5cf6",
        l556: "#4ade80",
        l780: "#ef4444",
        lattice: "#f0abfc",
        tweezer: "#ffd27a",
        rydberg: "#38bdf8",
        cavity: "#ff9e7a",
        photon: "#ffe4d9",
        accent: "#ffd27a",
        steel: "#262d39",
        steelEdge: "#4a5466",
        glassEdge: "rgba(170, 200, 240, 0.40)",
        bore: "#07090d"
    };
    const SP = { yb: C.yb, rb: C.rb };

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const randn = () => {
        let u = 0, v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };

    function hexA(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    function mixHex(h1, h2, t) {
        t = Math.round(clamp(t, 0, 1) * 8) / 8;   // quantised -> small sprite cache
        const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
        const ch = s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
        return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
    }


    /* =========================================================
       CANVAS SIZE
       ========================================================= */

    let scale = 1, LS = 1;               // LS: label scale for small screens
    let compact = false;                 // phone width: fewer labels, no inset panel
    const buf = document.createElement("canvas");
    const bufCtx = buf.getContext("2d");

    function resize() {
        const w = canvas.getBoundingClientRect().width || 800;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = buf.width = Math.round(w * dpr);
        canvas.height = buf.height = Math.round(w * 0.625 * dpr);
        scale = canvas.width / W;
        compact = w < 560;
        LS = compact ? 1.75 : clamp(820 / w, 1.15, 2.1);
    }


    /* =========================================================
       DRAWING PRIMITIVES
       ========================================================= */

    const sprites = {};

    function sprite(color) {
        if (sprites[color]) return sprites[color];
        const s = document.createElement("canvas");
        s.width = s.height = 64;
        const g = s.getContext("2d");
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, hexA(color, 1));
        grd.addColorStop(0.12, hexA(color, 0.8));
        grd.addColorStop(0.38, hexA(color, 0.22));
        grd.addColorStop(1, hexA(color, 0));
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        sprites[color] = s;
        return s;
    }

    function glow(x, y, r, color, a) {
        if (a <= 0.004) return;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(sprite(color), x - r, y - r, 2 * r, 2 * r);
        ctx.globalAlpha = 1;
    }

    function circle(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
    }

    function ring(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
    }

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawAtom(x, y, sp, a = 1, size = 1, color) {
        if (a <= 0.01) return;
        const col = color || SP[sp];
        ctx.globalCompositeOperation = "lighter";
        glow(x, y, 13 * size, col, 0.7 * a);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = a;
        ctx.fillStyle = col;
        circle(x, y, 3.4 * size);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        circle(x - 0.8 * size, y - 0.8 * size, 1.3 * size);
        ctx.globalAlpha = 1;
    }

    function beam(x1, y1, x2, y2, color, w, a) {
        if (a <= 0.01) return;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        const pass = (lw, al) => {
            ctx.strokeStyle = hexA(color, al * a);
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        };
        pass(w * 2.4, 0.07);
        pass(w, 0.16);
        pass(Math.max(1, w * 0.25), 0.35);
        ctx.restore();
    }

    function text(str, x, y, o = {}) {
        const size = (o.size || 11) * LS;
        ctx.font = `${o.weight || 400} ${size}px ${o.font || MONO}`;
        ctx.fillStyle = o.color || C.dim;
        ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
        ctx.textAlign = o.align || "left";
        ctx.textBaseline = o.base || "middle";
        ctx.fillText(str, x, y);
        ctx.globalAlpha = 1;
    }

    function panel(x, y, w, h, title) {
        ctx.fillStyle = "rgba(18, 23, 34, 0.82)";
        ctx.strokeStyle = "rgba(201, 212, 227, 0.14)";
        ctx.lineWidth = 1;
        rr(x, y, w, h, 10);
        ctx.fill();
        ctx.stroke();
        if (title) text(title, x + 16, y + 20, { size: 10, color: C.dim });
    }

    function glassBox(x, y, w, h, r) {
        ctx.fillStyle = "#0c1017";
        rr(x, y, w, h, r);
        ctx.fill();
        const g = ctx.createLinearGradient(x, y, x + w, y);
        g.addColorStop(0, "rgba(150, 185, 230, 0.12)");
        g.addColorStop(0.5, "rgba(150, 185, 230, 0.03)");
        g.addColorStop(1, "rgba(150, 185, 230, 0.10)");
        ctx.fillStyle = g;
        rr(x, y, w, h, r);
        ctx.fill();
        ctx.strokeStyle = C.glassEdge;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 6);
        ctx.lineTo(x + 5, y + h - 6);
        ctx.stroke();
    }


    /* =========================================================
       SEQUENCER
       A step can play a list of timed actions, optionally looping.
       The list is rebuilt by a builder function on every loop so it
       can depend on the current state.
       ========================================================= */

    let seq = null;

    function play(builder, loop) {
        seq = { builder, loop, actions: builder(), i: -1, t: 0, done: false };
        nextAction();
    }

    function nextAction() {
        seq.i++;
        if (seq.i >= seq.actions.length) {
            if (!seq.loop) { seq.done = true; return; }
            seq.actions = seq.builder();
            seq.i = 0;
        }
        seq.t = 0;
        const a = seq.actions[seq.i];
        if (a.start) a.start();
    }

    function updateSeq(dt) {
        if (!seq || seq.done) return;
        const a = seq.actions[seq.i];
        seq.t += dt;
        const p = Math.min(1, seq.t / Math.max(a.dur, 1e-4));
        if (a.update) a.update(p, dt);
        if (p >= 1) {
            if (a.end) a.end();
            if (seq) nextAction();
        }
    }


    /* =========================================================
       MACHINE VIEW  (illustrative, not the real geometry)
       ovens in the middle -> atoms fall into the glass cell
       -> one 3D MOT per species -> conveyor up to the octagon
       ========================================================= */

    const M = {
        ax: 520,
        oct: { x: 520, y: 130, r: 62 },
        cross: { x: 496, y: 306, w: 48, h: 48 },
        oven: {
            yb: { x: 380, y: 314, w: 60, h: 32, nozzle: 442, dir: 1 },
            rb: { x: 600, y: 314, w: 60, h: 32, nozzle: 598, dir: -1 }
        },
        cell: { x: 490, y: 448, w: 60, h: 150 },
        mot: { yb: { x: 520, y: 500 }, rb: { x: 520, y: 552 } },
        zoom: { x: 520, y: 130 }
    };

    const MS = {
        p: [],
        cooling: false, beamA: 0,
        lattice: false, latA: 0,
        phase: 0, dnu: 1.0, vel: 0,
        spawn: 0,
        panel: "legend", status: "",
        /* conveyor cycle: load -> move -> stop -> grab -> release -> carry -> park */
        cv: { ph: "load", t: 0, sp: "yb", phase0: 0, D: 0, T: 1, ring: 0, x: 520 }
    };

    /* tiny storage tweezers inside the octagon */
    const MZ = {
        y: 128,                                      /* where the conveyor stops */
        rows: [116, 124, 132, 140], dx: 4,
        x: { load: 520, yb: 496, rb: 544 }
    };
    function mzSites(x0) {
        const s = [];
        for (const y of MZ.rows) for (const d of [-1, 1]) s.push([x0 + d * MZ.dx, y]);
        return s;
    }
    const CV_DUR = { load: 0.9, stop: 0.5, grab: 0.5, release: 0.4, carry: 0.8, park: 0.4 };
    const CV_MSG = {
        load: sp => `standing wave · load ${spName(sp)} from the MOT`,
        move: () => "Δν ramped up and down · the belt moves",
        stop: () => "Δν = 0 · stopped in the octagon",
        grab: () => "storage tweezers on",
        release: () => "lattice off",
        carry: sp => `${spName(sp)} atoms → storage`,
        park: () => "parked · next batch"
    };
    const spName = sp => (sp === "yb" ? "Yb" : "Rb");

    function cvPhase(ph) {
        MS.cv.ph = ph;
        MS.cv.t = 0;
        MS.status = CV_MSG[ph](MS.cv.sp);
    }

    function resetConveyor() {
        Object.assign(MS.cv, { ph: "load", t: 0, sp: "yb", ring: 0, x: MZ.x.load });
        MS.vel = 0;
        MS.status = "";
        for (const p of MS.p) if (p.m === "lat" || p.m === "cap") p.m = "fade";
    }

    function updateConveyor(dt) {
        const cv = MS.cv;
        if (!MS.lattice) { MS.vel = 0; return; }
        cv.t += dt;
        const p = cv.ph === "move" ? clamp(cv.t / cv.T, 0, 1) : clamp(cv.t / (CV_DUR[cv.ph] || 1), 0, 1);
        MS.vel = 0;

        switch (cv.ph) {
            case "load":
                MS.latA = Math.min(1, MS.latA + dt * 3);
                if (p >= 1 && MS.dnu > 0 && countMode("mot", cv.sp) > 10) {
                    /* the standing wave picks up a packet from the MOT */
                    const s = 7, off = (((-MS.phase) % s) + s) % s;
                    const pick = MS.p.filter(q => q.m === "mot" && q.sp === cv.sp)
                        .sort((a, b) => Math.abs(a.y - M.mot[cv.sp].y) - Math.abs(b.y - M.mot[cv.sp].y)).slice(0, 8);
                    for (const q of pick) {
                        q.m = "lat";
                        q.x0 = M.ax + rand(-2.5, 2.5);
                        q.y = off + Math.round((q.y - off) / s) * s;
                        q.yl = q.y;
                    }
                    cv.phase0 = MS.phase;
                    cv.D = M.mot[cv.sp].y - MZ.y;
                    cv.T = (Math.PI / 2) * cv.D / latticeSpeed();
                    cvPhase("move");
                }
                break;
            case "move": {
                const d = cv.D * (1 - Math.cos(Math.PI * p)) / 2;
                MS.vel = (Math.PI / 2) * (cv.D / cv.T) * Math.sin(Math.PI * p);
                MS.phase = cv.phase0 + d;
                if (p >= 1) cvPhase("stop");
                break;
            }
            case "stop":
                if (p >= 1) cvPhase("grab");
                break;
            case "grab":
                cv.ring = p;
                if (p >= 1) {
                    const sites = mzSites(MZ.x.load), used = new Array(sites.length).fill(0);
                    for (const q of MS.p) {
                        if (q.m !== "lat") continue;
                        let best = -1, bd = 9;
                        sites.forEach(([sx, sy], i) => {
                            const d = Math.hypot(q.x - sx, q.y - sy);
                            if (d < bd && used[i] < 1) { bd = d; best = i; }
                        });
                        if (best >= 0) { q.m = "cap"; q.site = best; used[best]++; }
                        else { q.m = "fade"; q.vx = randn() * 10; q.vy = 30; }
                    }
                    cvPhase("release");
                }
                break;
            case "release":
                MS.latA = 1 - p;
                if (p >= 1) cvPhase("carry");
                break;
            case "carry":
                cv.x = lerp(MZ.x.load, MZ.x[cv.sp], ease(p));
                if (p >= 1) {
                    /* the previous batch has been used up by now */
                    for (const q of MS.p) if (q.m === "park" && q.sp === cv.sp) q.m = "fade";
                    for (const q of MS.p) if (q.m === "cap") { q.m = "park"; q.age = 0; }
                    cvPhase("park");
                }
                break;
            case "park":
                cv.ring = 1 - p;
                if (p >= 1) {
                    cv.x = MZ.x.load;
                    cv.sp = cv.sp === "yb" ? "rb" : "yb";
                    cvPhase("load");
                }
                break;
        }
    }

    function cellBounce(p) {
        const c = M.cell;
        if (p.x < c.x + 4 || p.x > c.x + c.w - 4) { p.vx *= -1; p.x = clamp(p.x, c.x + 4, c.x + c.w - 4); }
        if (p.y < c.y + 4 || p.y > c.y + c.h - 4) { p.vy *= -1; p.y = clamp(p.y, c.y + 4, c.y + c.h - 4); }
    }

    function machineReset() {
        MS.p = [];
        const c = M.cell;
        for (const sp of ["yb", "rb"]) {
            for (let i = 0; i < 18; i++) {
                const ang = rand(0, TAU), v = rand(150, 260);
                MS.p.push({
                    sp, m: "cell", a: 1, age: rand(0, 2), seed: rand(0, TAU),
                    x: rand(c.x + 6, c.x + c.w - 6), y: rand(c.y + 6, c.y + c.h - 6),
                    vx: v * Math.cos(ang), vy: v * Math.sin(ang)
                });
            }
        }
        MS.phase = 0;
    }

    function latticeSpeed() { return 150 * MS.dnu; }         // peak speed, px/s on screen

    function motStep(p, cx, cy, dt, g, w2, D) {
        const s = Math.sqrt(2 * D * dt);
        p.vx += (-g * p.vx - w2 * (p.x - cx)) * dt + randn() * s;
        p.vy += (-g * p.vy - w2 * (p.y - cy)) * dt + randn() * s;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }

    function countMode(m, sp) {
        let n = 0;
        for (const p of MS.p) if (p.m === m && (!sp || p.sp === sp)) n++;
        return n;
    }

    function retireOldest(m, sp, keep) {
        let n = countMode(m, sp);
        while (n > keep) {
            let oldest = null;
            for (const p of MS.p) if (p.m === m && p.sp === sp && (!oldest || p.age > oldest.age)) oldest = p;
            oldest.m = "fade";
            n--;
        }
    }

    function updateMachine(dt) {
        MS.beamA += ((MS.cooling ? 1 : 0) - MS.beamA) * Math.min(1, dt * 3);
        if (!MS.lattice) MS.latA = Math.max(0, MS.latA - dt * 3);
        updateConveyor(dt);

        /* atoms leaving both ovens */
        MS.spawn -= dt;
        if (MS.spawn <= 0) {
            MS.spawn = 0.08;
            for (const sp of ["yb", "rb"]) {
                const busy = countMode("beam", sp) + countMode("fall", sp) + countMode("cell", sp);
                if (busy < 26) {
                    const o = M.oven[sp];
                    MS.p.push({
                        sp, m: "beam", a: 0, age: 0, seed: rand(0, TAU),
                        x: o.nozzle, y: 330 + randn() * 2,
                        vx: o.dir * rand(150, 240), vy: randn() * 10
                    });
                }
            }
        }

        const cvSites = mzSites(MS.cv.x);

        for (const p of MS.p) {
            p.age += dt;
            if (p.m !== "fade") p.a = Math.min(1, p.a + dt * 4);
            const mot = M.mot[p.sp];

            switch (p.m) {
                case "beam":            /* out of the oven, into the vertical tube */
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (Math.abs(p.x - M.ax) < 6) {
                        p.m = "fall";
                        p.vx = randn() * 8;
                        p.vy = rand(170, 250);
                    }
                    break;

                case "fall":            /* falling down into the glass cell */
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (Math.abs(p.x - M.ax) > 7) p.vx *= -1;
                    if (p.y > M.cell.y + 6) { p.m = "cell"; p.vx = randn() * 120; }
                    break;

                case "cell":            /* hot vapour in the glass cell */
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    cellBounce(p);
                    if (MS.cooling) p.m = "mot";
                    else if (p.age > 4) p.m = "fade";
                    break;

                case "mot":
                    motStep(p, mot.x, mot.y, dt, 5, 14, 3400);
                    break;

                case "lat":             /* riding the conveyor up to the octagon */
                    p.y = p.yl - (MS.phase - MS.cv.phase0);
                    p.x = p.x0 + Math.sin(p.age * 9 + p.seed) * 0.8;
                    break;

                case "cap": {           /* held by the small storage array */
                    const [sx, sy] = cvSites[p.site], f = Math.min(1, dt * 12);
                    p.x += (sx - p.x) * f;
                    p.y += (sy - p.y) * f;
                    break;
                }

                case "park": {          /* parked in the storage region */
                    const [sx, sy] = mzSites(MZ.x[p.sp])[p.site];
                    p.x = sx + Math.sin(p.age * 3 + p.seed) * 0.4;
                    p.y = sy + Math.cos(p.age * 2.6 + p.seed) * 0.4;
                    break;
                }

                case "fade":
                    p.a -= dt * 1.5;
                    p.x += (p.vx || 0) * dt * 0.3;
                    p.y += (p.vy || 0) * dt * 0.3;
                    break;
            }
        }

        for (const sp of ["yb", "rb"]) {
            retireOldest("mot", sp, 40);
        }

        MS.p = MS.p.filter(p => p.a > 0);
    }

    function warmMachine(seconds) {
        for (let i = 0; i < seconds * 30; i++) updateMachine(1 / 30);
    }

    function drawOctagon(cx, cy, r) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = Math.PI / 8 + i * TAU / 8;
            const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = C.steel;
        ctx.strokeStyle = C.steelEdge;
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
            const a = i * TAU / 8;
            ctx.fillStyle = "#11161f";
            circle(cx + 52 * Math.cos(a), cy + 52 * Math.sin(a), 5);
        }
        ctx.fillStyle = "#0c1017";
        circle(cx, cy, 40);
        ctx.strokeStyle = C.glassEdge;
        ring(cx, cy, 40);
    }

    function drawOven(o) {
        ctx.fillStyle = "#2f2a26";
        ctx.strokeStyle = "#6b5a4a";
        rr(o.x, o.y, o.w, o.h, 6);
        ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        glow(o.x + o.w / 2 - o.dir * 6, o.y + o.h / 2, 30, "#ff8a3d", 0.32 + 0.05 * Math.sin(simTime * 3 + o.dir));
        ctx.globalCompositeOperation = "source-over";
    }

    function drawHardware() {
        ctx.lineWidth = 1;
        ctx.fillStyle = C.steel;
        ctx.strokeStyle = C.steelEdge;

        /* oven arms */
        rr(438, 324, 60, 12, 2); ctx.fill(); ctx.stroke();
        rr(542, 324, 60, 12, 2); ctx.fill(); ctx.stroke();

        /* vertical tube, glass cell -> octagon */
        rr(506, 186, 28, 266, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.bore;
        ctx.fillRect(511, 186, 18, 266);

        /* oven cross */
        const x = M.cross;
        ctx.fillStyle = C.steel;
        rr(x.x, x.y, x.w, x.h, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.bore;
        ctx.fillRect(511, x.y, 18, x.h);
        ctx.fillRect(x.x, 324, x.w, 12);

        drawOven(M.oven.yb);
        drawOven(M.oven.rb);

        drawOctagon(M.oct.x, M.oct.y, M.oct.r);

        /* tiny cavity mirrors inside the octagon */
        ctx.strokeStyle = hexA(C.cavity, 0.55);
        ctx.lineWidth = 2;
        for (const [mx, d] of [[490, 1], [550, -1]]) {
            ctx.beginPath();
            ctx.moveTo(mx, 143);
            ctx.quadraticCurveTo(mx - d * 4, 150, mx, 157);
            ctx.stroke();
        }
        ctx.lineWidth = 1;

        const c = M.cell;
        glassBox(c.x, c.y, c.w, c.h, 3);
    }

    function drawMotBeams(m, color, a) {
        beam(474, m.y, 566, m.y, color, 7, a);
        beam(m.x - 24, m.y - 24, m.x + 24, m.y + 24, color, 6, a * 0.85);
        beam(m.x - 24, m.y + 24, m.x + 24, m.y - 24, color, 6, a * 0.85);
    }

    function drawMachineBeams() {
        const a = MS.beamA;
        if (a < 0.01) return;
        drawMotBeams(M.mot.yb, C.l556, a);
        drawMotBeams(M.mot.rb, C.l780, a);
    }

    function drawMachineLattice() {
        const a = MS.latA;
        if (a < 0.01) return;
        const x = M.ax, top = 72, bot = 580, s = 7;
        beam(x, top, x, bot, C.lattice, 10, a * 0.45);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = hexA(C.lattice, 0.5 * a);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const off = (((-MS.phase) % s) + s) % s;
        for (let y = off; y < bot; y += s) {
            if (y < top) continue;
            ctx.moveTo(x - 5, y);
            ctx.lineTo(x + 5, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawMachineLabels() {
        text("octagon", 596, 116, { color: C.text });
        text("glass cell", 562, 466, { color: C.text });
        text("Yb oven", 410, 300, { align: "center" });
        text("Rb oven", 630, 300, { align: "center" });
        if (!compact) {
            text("science chamber", 596, 132);
            text("Yb MOT · 556 nm", 572, 500);
            text("Rb MOT · 780 nm", 572, 552);
        }

        if (MS.panel === "lattice") {
            ctx.save();
            ctx.translate(486, 250);
            ctx.rotate(-Math.PI / 2);
            text("optical conveyor  →", 0, 0, { align: "center", color: C.lattice });
            ctx.restore();
        }
    }

    function legendRow(y, color, name, sub) {
        beam(718, y, 746, y, color, 6, 1);
        text(name, 760, y - 7, { color: C.text });
        text(sub, 760, y + 9, { size: 10 });
    }

    function drawMachinePanel() {
        if (compact) return;
        const x = 700, y = 196, w = 285, h = 236;

        if (MS.panel === "legend") {
            panel(x, y, w, h, "TWO SPECIES");
            drawAtom(732, 244, "yb", 1, 1.2);
            text("¹⁷¹Yb · ytterbium", 752, 237, { color: C.text });
            text("data qubits · nuclear spin ½", 752, 254, { size: 10 });
            drawAtom(732, 290, "rb", 1, 1.2);
            text("⁸⁷Rb · rubidium", 752, 283, { color: C.text });
            text("ancillas · cavity readout", 752, 300, { size: 10 });
            text("LIGHT", x + 16, 336, { size: 10 });
            [[786, C.l556, "556 nm Yb"], [896, C.l780, "780 nm Rb"]].forEach(([cx, col, name]) => {
                text(name, cx, 362, { size: 10, align: "center", color: C.text });
                beam(cx - 36, 384, cx + 36, 384, col, 6, 1);
            });
            text("far apart → no crosstalk", x + 16, 412, { size: 10 });
        }

        if (MS.panel === "cool") {
            panel(x, y, w, h, "LASER COOLING");
            legendRow(250, C.l556, "556 nm · Yb MOT", "narrow intercombination line");
            legendRow(296, C.l780, "780 nm · Rb MOT", "D2 line");

            let s = 0, n = 0;
            for (const p of MS.p) if (p.m === "cell" || p.m === "mot") { s += Math.hypot(p.vx, p.vy); n++; }
            const f = clamp(s / Math.max(1, n) / 200, 0, 1);
            text("atom speed", x + 16, 352, { size: 10 });
            ctx.fillStyle = "rgba(201, 212, 227, 0.10)";
            rr(x + 94, 346, 170, 10, 5);
            ctx.fill();
            ctx.fillStyle = mixHex(C.rydberg, C.rb, f);
            rr(x + 94, 346, Math.max(6, 170 * f), 10, 5);
            ctx.fill();
            text("cold", x + 94, 369, { size: 9 });
            text("hot", x + 264, 369, { size: 9, align: "right" });
            text(`atoms in the MOTs: ${countMode("mot")}`, x + 16, 404, { size: 10, color: C.text });
        }

        if (MS.panel === "lattice") {
            panel(x, y, w, h, "MOVING OPTICAL LATTICE");
            const x0 = 722, x1 = 964, base = 262, depth = 46, per = 34;
            const ph = latticePhaseInset;

            text("ν", 712, 236, { color: C.lattice, size: 12 });
            text("ν + Δν", 972, 236, { color: C.lattice, size: 12, align: "right" });
            beam(712, 248, 790, 248, C.lattice, 3, 0.8);
            beam(972, 248, 894, 248, C.lattice, 3, 0.8);
            ctx.fillStyle = hexA(C.lattice, 0.8);
            ctx.beginPath(); ctx.moveTo(796, 248); ctx.lineTo(788, 244); ctx.lineTo(788, 252); ctx.fill();
            ctx.beginPath(); ctx.moveTo(888, 248); ctx.lineTo(896, 244); ctx.lineTo(896, 252); ctx.fill();

            ctx.strokeStyle = hexA(C.lattice, 0.85);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let xx = x0; xx <= x1; xx += 2) {
                const I = Math.pow(Math.cos(Math.PI * (xx - x0 - ph) / per), 2);
                const yy = base + depth * I;
                if (xx === x0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
            }
            ctx.stroke();

            /* atoms of both species sitting in the wells */
            const first = x0 + (((ph % per) + per) % per);
            for (let k = -2; k < 9; k++) {
                const xx = first + k * per;
                if (xx < x0 + 4 || xx > x1 - 4) continue;
                const idx = Math.round((xx - x0 - ph) / per);
                const m = ((idx % 3) + 3) % 3;
                if (m < 2) drawAtom(xx, base + depth - 6, m ? "rb" : "yb", 1, 0.9);
            }

            /* lambda/2 bracket */
            const bx = first + per * 2;
            if (bx + per < x1) {
                ctx.strokeStyle = hexA(C.text, 0.5);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bx, 322); ctx.lineTo(bx, 328); ctx.lineTo(bx + per, 328); ctx.lineTo(bx + per, 322);
                ctx.stroke();
                text("λ/2", bx + per / 2, 340, { align: "center", size: 10 });
            }

            text("v = λ · Δν / 2", x + w / 2, 372, { align: "center", color: C.text, size: 15, weight: 600 });
            text(MS.vel < 1 ? "Δν = 0: standing wave, atoms stay" : "Δν > 0: the wells move  →",
                x + w / 2, 402, { align: "center", size: 10 });
        }
    }

    let latticePhaseInset = 0;

    function drawMiniStorage() {
        if (!MS.lattice) return;
        ctx.lineWidth = 0.8;
        for (const sp of ["yb", "rb"]) {
            ctx.strokeStyle = hexA(C.tweezer, 0.22);
            for (const [x, y] of mzSites(MZ.x[sp])) ring(x, y, 2.6);
        }
        const a = MS.cv.ring;
        if (a > 0.01) {
            for (const [x, y] of mzSites(MS.cv.x)) {
                ctx.globalCompositeOperation = "lighter";
                glow(x, y, 6, C.tweezer, 0.5 * a);
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = hexA(C.tweezer, 0.9 * a);
                ring(x, y, 2.6);
            }
        }
        ctx.lineWidth = 1;
    }

    function drawMachineView() {
        drawHardware();
        drawMachineBeams();
        drawMachineLattice();
        drawMiniStorage();

        for (const p of MS.p) drawAtom(p.x, p.y, p.sp, p.a, p.m === "park" || p.m === "cap" ? 0.45 : 0.75);

        drawMachineLabels();
        if (MS.lattice && MS.status) text(MS.status, compact ? 980 : 985, 24, { align: "right", color: C.accent, size: 11 });
        drawMachinePanel();
    }


    /* =========================================================
       ARRAY VIEW  (inside the glass cell)
       ========================================================= */

    const AG = {
        cols: 10, rows: 4,
        x0: 230, dx: 60, y0: 205, dy: 48,
        rowSp: ["yb", "rb", "yb", "rb"],
        cavY: 500, mirL: 110, mirR: 890,
        det: { x: 948, y: 500 },
        resMax: 32
    };

    /* storage tweezers: 8 rows x 4 columns, 0 or 1 atom each.
       The same pattern exists at the loading zone (moving AOD array)
       and in one static storage region per species. */
    const ST = {
        rows: [44, 56, 68, 80, 92, 104, 116, 128], cols: [-16.5, -5.5, 5.5, 16.5], cap: 1,
        x: { load: 500, yb: 290, rb: 710 }
    };

    function storeSites(x0) {
        const s = [];
        for (const y of ST.rows) for (const d of ST.cols) s.push([x0 + d, y]);
        return s;
    }

    const AS = {
        atoms: [], grid: [], tweens: [], fx: [],
        store: { yb: [], rb: [] }, storeA: 1,
        feeding: true,
        link: [[], []],
        band: -1, ryd: 0, image: 0,
        probe: -1, probeA: 0, cavA: 0.25,
        bits: new Array(10).fill(null), bitsA: 0,
        det: { flash: 0, clicks: 0 },
        status: "",
        chartOn: false, chart: [], chartT: 0,
        reload: true, reloaded: 0, cycles: 0,
        lossRate: 0, roRow: 3, firstRo: true
    };

    function setStore(n) {
        for (const sp of ["yb", "rb"]) AS.store[sp] = new Array(ST.rows.length * ST.cols.length).fill(n);
    }
    setStore(ST.cap);

    function storeCount(sp) { return AS.store[sp].reduce((s, n) => s + n, 0); }
    function storeFull(sp) { return storeCount(sp) >= AG.resMax * 0.5; }

    function siteXY(r, c) { return [AG.x0 + c * AG.dx, AG.y0 + r * AG.dy]; }

    function setLinks(v) {
        for (let i = 0; i < 2; i++) for (let c = 0; c < AG.cols; c++) AS.link[i][c] = v;
    }

    function clearArray() {
        AS.atoms = [];
        AS.tweens = [];
        AS.fx = [];
        AS.grid = Array.from({ length: AG.rows }, () => new Array(AG.cols).fill(null));
        AS.bits.fill(null);
        AS.bitsA = 0;
        AS.band = -1;
        AS.ryd = 0;
        AS.image = 0;
        AS.probe = -1;
        setLinks(0);
    }

    function arrayEnter() {
        AS.cavA = 0.25;
        AS.status = "";
        AS.chartOn = false;
        AS.lossRate = 0;
        AS.feeding = true;
        AS.storeA = 1;
        setStore(ST.cap);
        resetLoader();
        LD.status = false;
        AS.det.clicks = 0;
    }

    function makeAtom(sp, x, y) {
        const a = { sp, x, y, a: 1, r: -1, c: -1, state: "site", moving: false, carried: false, flash: 0 };
        AS.atoms.push(a);
        return a;
    }

    function placeAtom(r, c) {
        const [x, y] = siteXY(r, c);
        const a = makeAtom(AG.rowSp[r], x, y);
        a.r = r; a.c = c;
        AS.grid[r][c] = a;
        return a;
    }

    function fillAll() {
        for (let r = 0; r < AG.rows; r++)
            for (let c = 0; c < AG.cols; c++)
                if (!AS.grid[r][c]) placeAtom(r, c);
    }

    function countSites() {
        let n = 0;
        for (const row of AS.grid) for (const a of row) if (a) n++;
        return n;
    }

    function countSettled() {
        let n = 0;
        for (const row of AS.grid)
            for (const a of row)
                if (a && (a.state === "cav" || (a.state === "site" && !a.moving))) n++;
        return n;
    }

    /* pick the single atom out of a random filled storage site */
    function takeFromRes(sp) {
        const s = AS.store[sp], idx = [];
        s.forEach((n, i) => { if (n) idx.push(i); });
        if (!idx.length) return null;
        const k = idx[Math.floor(Math.random() * idx.length)];
        s[k] = 0;
        return storeSites(ST.x[sp])[k];
    }

    /* ---------- loading cycle: conveyor -> storage tweezers -> storage region ---------- */

    const LD = { sp: "yb", ph: "idle", t: 0, cloud: [], lat: 0, ring: 0, x: ST.x.load, disp: 0, status: false };
    const LD_DUR = { arrive: 1.6, hold: 0.6, overlap: 0.6, release: 0.7, move: 1.0, handoff: 0.5 };
    const LD_MSG = {
        arrive: sp => `conveyor brings a ${spName(sp)} cloud`,
        hold: () => "Δν → 0 · the conveyor stops and holds the cloud",
        overlap: () => "storage tweezers on, overlapping the cloud",
        release: () => "lattice off · pairs collide and leave · 0 or 1 atom per tweezer",
        move: sp => `storage array → ${spName(sp)} storage region`,
        handoff: sp => `${spName(sp)} atoms parked · conveyor free again`
    };

    function resetLoader() {
        LD.ph = "idle"; LD.t = 0; LD.cloud = [];
        LD.lat = 0; LD.ring = 0; LD.x = ST.x.load; LD.disp = 0;
    }

    function ldPhase(ph) {
        LD.ph = ph;
        LD.t = 0;
        if (LD.status && LD_MSG[ph]) AS.status = LD_MSG[ph](LD.sp);
    }

    function startBatch() {
        LD.cloud = [];
        for (let i = 0; i < 110; i++) {
            LD.cloud.push({
                sp: LD.sp, m: "lat", a: 1, ph: rand(0, TAU),
                tx: ST.x.load + randn() * 11, ty: 7 * Math.round(rand(38, 134) / 7), x: 0, y: -60
            });
        }
        LD.x = ST.x.load;
        LD.ring = 0;
        ldPhase("arrive");
    }

    function captureCloud() {
        const sites = storeSites(ST.x.load), filled = AS.store[LD.sp], cand = sites.map(() => []);
        for (const q of LD.cloud) {
            let best = -1, bd = 8;
            sites.forEach(([sx, sy], i) => {
                const d = Math.hypot(q.x - sx, q.y - sy);
                if (d < bd) { bd = d; best = i; }
            });
            if (best >= 0 && !filled[best]) cand[best].push(q);
            else { q.m = "lost"; q.vx = randn() * 15; q.vy = rand(10, 40); }
        }
        /* light-assisted collisions remove atoms in pairs:
           each tweezer ends up with either 0 or 1 atom */
        cand.forEach((list, i) => {
            const keep = list.length && Math.random() < 0.6 ? list[0] : null;
            for (const q of list) {
                if (q === keep) { q.m = "cap"; q.site = i; continue; }
                q.m = "lost";
                q.vx = (Math.random() < 0.5 ? -1 : 1) * rand(70, 130);
                q.vy = rand(-50, 10);
            }
        });
    }

    function handoff() {
        const s = AS.store[LD.sp];
        for (const q of LD.cloud) if (q.m === "cap") s[q.site] = 1;
        LD.cloud = LD.cloud.filter(q => q.m !== "cap");
    }

    function updateLoader(dt) {
        LD.t += dt;
        const p = LD.ph === "idle" ? 0 : clamp(LD.t / LD_DUR[LD.ph], 0, 1);
        const other = LD.sp === "yb" ? "rb" : "yb";

        switch (LD.ph) {
            case "idle":
                LD.lat = Math.max(0, LD.lat - dt * 2);
                if (AS.feeding && LD.t > 0.3) {
                    if (storeFull(LD.sp) && !storeFull(other)) LD.sp = other;
                    if (!storeFull(LD.sp)) startBatch();
                    else LD.t = 0;
                }
                break;
            case "arrive":              /* Δν ramped up and back down to zero */
                LD.lat = Math.min(1, LD.lat + dt * 3);
                LD.disp = (1 - ease(p)) * 170;
                if (p >= 1) { LD.disp = 0; ldPhase("hold"); }
                break;
            case "hold":
                if (p >= 1) ldPhase("overlap");
                break;
            case "overlap":
                LD.ring = p;
                if (p >= 1) { captureCloud(); ldPhase("release"); }
                break;
            case "release":
                LD.lat = 1 - p;
                if (p >= 1) ldPhase("move");
                break;
            case "move":
                LD.x = lerp(ST.x.load, ST.x[LD.sp], ease(p));
                if (p >= 1) { handoff(); ldPhase("handoff"); }
                break;
            case "handoff":
                LD.ring = 1 - p;
                if (p >= 1) { LD.x = ST.x.load; LD.sp = other; LD.ph = "idle"; LD.t = 0; }
                break;
        }

        const sites = storeSites(LD.x);
        for (const q of LD.cloud) {
            if (q.m === "lat") {
                q.x = q.tx + Math.sin(simTime * 7 + q.ph) * 0.6;
                q.y = q.ty - LD.disp;
            } else if (q.m === "cap") {
                const [sx, sy] = sites[q.site], f = Math.min(1, dt * 12);
                q.x += (sx - q.x) * f;
                q.y += (sy - q.y) * f;
            } else {
                q.vy += 260 * dt;
                q.x += q.vx * dt;
                q.y += q.vy * dt;
                q.a -= dt * 1.6;
            }
        }
        LD.cloud = LD.cloud.filter(q => q.a > 0);

        if (LD.status && LD.ph === "idle" && storeFull("yb") && storeFull("rb"))
            AS.status = "both storage regions loaded";
    }

    /* ---------- tweens (tweezer moves) ---------- */

    function move(atom, path, dur, opts = {}) {
        const pts = [[atom.x, atom.y], ...path];
        const seg = [];
        let L = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
            seg.push(d);
            L += d;
        }
        AS.tweens = AS.tweens.filter(t => t.atom !== atom);
        AS.tweens.push({ atom, pts, seg, L, t: -(opts.delay || 0), dur, onDone: opts.onDone, tw: opts.tweezer !== false });
        atom.moving = true;
    }

    function updateTweens(dt) {
        for (let i = AS.tweens.length - 1; i >= 0; i--) {
            const tw = AS.tweens[i];
            tw.t += dt;
            if (tw.t < 0) continue;
            const p = clamp(tw.t / tw.dur, 0, 1);
            let d = ease(p) * tw.L, k = 0;
            while (k < tw.seg.length - 1 && d > tw.seg[k]) { d -= tw.seg[k]; k++; }
            const f = tw.seg[k] ? Math.min(1, d / tw.seg[k]) : 1;
            const A = tw.pts[k], B = tw.pts[k + 1] || A;
            tw.atom.x = lerp(A[0], B[0], f);
            tw.atom.y = lerp(A[1], B[1], f);
            tw.atom.carried = tw.tw;
            if (p >= 1) {
                AS.tweens.splice(i, 1);
                tw.atom.moving = false;
                tw.atom.carried = false;
                if (tw.onDone) tw.onDone(tw.atom);
            }
        }
    }

    /* ---------- effects ---------- */

    function puff(x, y, color) {
        AS.fx.push({ type: "puff", x, y, color, t: 0, dur: 0.6 });
    }

    function pulse(x, y, color) {
        AS.fx.push({ type: "pulse", x, y, color, t: 0, dur: 0.9 });
    }

    function photon(x, y, delay) {
        const pts = [[x, y], [AG.mirR - 4, AG.cavY], [AG.det.x - 22, AG.cavY]];
        const seg = [Math.abs(pts[1][0] - x), pts[2][0] - pts[1][0]];
        AS.fx.push({
            type: "photon", pts, seg, L: seg[0] + seg[1], t: -delay, speed: 1100,
            yo: rand(-3, 3),
            onDone() { AS.det.flash = 1; AS.det.clicks++; }
        });
    }

    function updateFx(dt) {
        for (let i = AS.fx.length - 1; i >= 0; i--) {
            const f = AS.fx[i];
            f.t += dt;
            if (f.type === "photon") {
                if (f.t * f.speed >= f.L) { f.onDone(); AS.fx.splice(i, 1); }
            } else if (f.t >= f.dur) {
                AS.fx.splice(i, 1);
            }
        }
    }

    function lose(a) {
        if (a.r >= 0 && AS.grid[a.r][a.c] === a) AS.grid[a.r][a.c] = null;
        a.state = "lost";
        a.vx = rand(-30, 30);
        a.vy = rand(-40, -10);
        puff(a.x, a.y, "#ffffff");
    }

    /* ---------- composite moves ---------- */

    /* single atoms from storage into the empty science sites of row r;
       failP: chance that a transfer drops the atom */
    function fillRowFromRes(r, dur, failP) {
        let n = 0;
        for (let c = 0; c < AG.cols; c++) {
            if (AS.grid[r][c]) continue;
            const sp = AG.rowSp[r], p = takeFromRes(sp);
            if (!p) continue;
            const a = makeAtom(sp, p[0], p[1]);
            a.r = r; a.c = c;
            AS.grid[r][c] = a;
            const [x, y] = siteXY(r, c), gx = x - AG.dx / 2;
            move(a, [[gx, 165], [gx, y], [x, y]], dur,
                failP ? { onDone(at) { if (Math.random() < failP) lose(at); } } : {});
            n++;
        }
        return n;
    }

    function refillAll(dur) {
        let n = 0;
        for (let r = 0; r < AG.rows; r++) n += fillRowFromRes(r, dur, 0);
        AS.reloaded += n;
        return n;
    }

    function cavityPath(r, c, back) {
        const [x, y] = siteXY(r, c), cy = AG.cavY, gx = x + AG.dx / 2;
        if (r === AG.rows - 1) return back ? [[x, y]] : [[x, cy]];
        return back ? [[gx, cy], [gx, y], [x, y]] : [[gx, y], [gx, cy], [x, cy]];
    }

    function shuttleToCavity(r, dur) {
        for (let c = 0; c < AG.cols; c++) {
            const a = AS.grid[r][c];
            if (!a || a.state !== "site") continue;
            a.state = "cav";
            move(a, cavityPath(r, c, false), dur);
        }
    }

    function shuttleBack(r, dur, lossChance) {
        for (let c = 0; c < AG.cols; c++) {
            const a = AS.grid[r][c];
            if (!a || a.state !== "cav") continue;
            if (Math.random() < (lossChance || 0)) { lose(a); continue; }
            move(a, cavityPath(r, c, true), dur, { onDone(at) { if (at.state === "cav") at.state = "site"; } });
        }
    }

    function dumpCavity(r) {
        for (let c = 0; c < AG.cols; c++) {
            const a = AS.grid[r][c];
            if (!a || a.state !== "cav") continue;
            AS.grid[r][c] = null;
            a.state = "lost";
            a.vx = rand(-20, 20);
            a.vy = rand(40, 70);
        }
    }

    function probe(r, c) {
        AS.probe = c;
        const a = AS.grid[r][c];
        if (!a || a.state !== "cav") { AS.bits[c] = null; return; }
        const bright = Math.random() < 0.5;
        AS.bits[c] = bright ? 1 : 0;
        AS.bitsA = 1;
        if (bright) {
            a.flash = 1;
            for (let k = 0; k < 5; k++) photon(a.x, a.y, k * 0.035);
        }
    }

    function feedForward(r) {
        const ones = [];
        for (let c = 0; c < AG.cols; c++) if (AS.bits[c] === 1) ones.push(c);
        ones.sort(() => Math.random() - 0.5);
        for (const c of ones.slice(0, 2)) {
            const d = AS.grid[r - 1][c];
            if (d && d.state === "site") { d.flash = 1; pulse(d.x, d.y, C.accent); }
        }
    }

    function pairIndex(r) { return r === 1 ? 0 : 1; }

    function gateAction(dur) {
        return {
            dur,
            start() { AS.status = "Rydberg CZ gates · data ↔ ancilla"; },
            update(p) {
                AS.ryd = Math.sin(Math.PI * p);
                if (p > 0.5) setLinks(Math.max(AS.link[0][0] || 0, (p - 0.5) * 2));
            },
            end() { AS.ryd = 0; setLinks(1); }
        };
    }

    /* ---------- update ---------- */

    function updateArray(dt) {
        updateTweens(dt);
        updateFx(dt);

        for (const a of AS.atoms) {
            if (a.state === "lost") {
                a.a -= dt * 1.4;
                a.x += a.vx * dt;
                a.y += a.vy * dt;
            } else if (a.state === "fade") {
                a.a -= dt * 2;
            } else {
                a.a = Math.min(1, a.a + dt * 3);
            }
            a.flash = Math.max(0, a.flash - dt * 1.8);
        }
        AS.atoms = AS.atoms.filter(a => a.a > 0 || (a.state !== "lost" && a.state !== "fade"));

        /* random losses (background gas) */
        if (AS.lossRate > 0) {
            for (const a of AS.atoms) {
                if (a.state === "site" && !a.moving && Math.random() < AS.lossRate * dt) lose(a);
            }
        }

        /* the conveyor keeps delivering clouds that get parked in storage */
        updateLoader(dt);

        AS.det.flash = Math.max(0, AS.det.flash - dt * 6);

        if (AS.chartOn) {
            AS.chartT -= dt;
            if (AS.chartT <= 0) {
                AS.chartT = 0.25;
                AS.chart.push(countSettled() / (AG.rows * AG.cols));
                if (AS.chart.length > 160) AS.chart.shift();
            }
        }
    }

    /* ---------- draw ---------- */

    function drawMirror(x, y, dir) {
        const h = 34;
        ctx.fillStyle = "#333c4a";
        ctx.strokeStyle = "#7d8aa0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - dir * 18, y - h);
        ctx.lineTo(x, y - h);
        ctx.quadraticCurveTo(x - dir * 12, y, x, y + h);
        ctx.lineTo(x - dir * 18, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = hexA(C.cavity, 0.75);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.quadraticCurveTo(x - dir * 12, y, x, y + h);
        ctx.stroke();
        ctx.lineWidth = 1;
    }

    function drawCavity() {
        const y = AG.cavY, L = AG.mirL, R = AG.mirR, a = AS.cavA;

        const g = ctx.createLinearGradient(0, y - 16, 0, y + 16);
        g.addColorStop(0, hexA(C.cavity, 0));
        g.addColorStop(0.5, hexA(C.cavity, 0.05 + 0.2 * a));
        g.addColorStop(1, hexA(C.cavity, 0));
        ctx.fillStyle = g;
        ctx.fillRect(L - 6, y - 16, R - L + 12, 32);

        ctx.strokeStyle = hexA(C.cavity, 0.08 + 0.18 * a);
        ctx.beginPath();
        for (let x = L + 4; x < R - 2; x += 6) {
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x, y + 5);
        }
        ctx.stroke();

        drawMirror(L, y, 1);
        drawMirror(R, y, -1);

        /* output to detector */
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = hexA(C.cavity, 0.35);
        ctx.beginPath();
        ctx.moveTo(R + 2, y);
        ctx.lineTo(AG.det.x - 22, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const d = AG.det;
        ctx.fillStyle = "#1a202b";
        ctx.strokeStyle = C.steelEdge;
        rr(d.x - 22, y - 16, 44, 32, 5);
        ctx.fill();
        ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        glow(d.x, y, 30, C.photon, AS.det.flash * 0.9);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = AS.det.flash > 0.1 ? C.photon : "#3a4454";
        circle(d.x, y, 5);
        text("SPCM", d.x, y + 30, { align: "center", size: 10 });
        if (AS.det.clicks) text(`${AS.det.clicks} clicks`, d.x, y + 45, { align: "center", size: 9 });
    }

    function drawStorage() {
        const t = simTime, cx = ST.x.load, bot = 150;

        /* conveyor from the glass cell: moves, stops, then is switched off */
        beam(cx, -10, cx, bot, C.lattice, 9, 0.06 + 0.34 * LD.lat);
        if (LD.lat > 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = hexA(C.lattice, 0.45 * LD.lat);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            const off = ((-LD.disp % 7) + 7) % 7;
            for (let y = off - 14; y < bot - 4; y += 7) {
                if (y < -10) continue;
                ctx.moveTo(cx - 5, y);
                ctx.lineTo(cx + 5, y);
            }
            ctx.stroke();
            ctx.restore();
        }

        /* static storage tweezers, one region per species */
        ctx.lineWidth = 1;
        for (const sp of ["yb", "rb"]) {
            storeSites(ST.x[sp]).forEach(([x, y], i) => {
                ctx.strokeStyle = hexA(C.tweezer, 0.18);
                ring(x, y, 4.5);
                if (AS.store[sp][i])
                    drawAtom(x + Math.sin(t * 3 + i) * 0.4, y + Math.cos(t * 2.6 + i) * 0.4, sp, 0.9 * AS.storeA, 0.5);
            });
        }

        /* moving storage array (AOD), at the loading zone or in transit */
        if (LD.ring > 0.01) {
            for (const [x, y] of storeSites(LD.x)) {
                ctx.globalCompositeOperation = "lighter";
                glow(x, y, 10, C.tweezer, 0.35 * LD.ring);
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = hexA(C.tweezer, 0.8 * LD.ring);
                ring(x, y, 4.5);
            }
        }
        for (const q of LD.cloud) drawAtom(q.x, q.y, q.sp, clamp(q.a, 0, 1), 0.5);
    }

    function drawSites() {
        for (let r = 0; r < AG.rows; r++) {
            for (let c = 0; c < AG.cols; c++) {
                const [x, y] = siteXY(r, c), a = AS.grid[r][c];
                const occ = a && !a.moving && a.state === "site";
                ctx.strokeStyle = hexA(C.tweezer, occ ? 0.32 : 0.14);
                ctx.lineWidth = 1;
                ring(x, y, 9);
            }
        }
    }

    function drawLinks() {
        for (let i = 0; i < 2; i++) {
            const r0 = i * 2, r1 = r0 + 1;
            for (let c = 0; c < AG.cols; c++) {
                const v = AS.link[i][c];
                const a = AS.grid[r0][c], b = AS.grid[r1][c];
                if (!v || !a || !b) continue;
                const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                g.addColorStop(0, hexA(C.yb, 0.8 * v));
                g.addColorStop(1, hexA(C.rb, 0.8 * v));
                ctx.strokeStyle = g;
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
    }

    function drawRydberg() {
        if (AS.ryd <= 0.01) return;
        const v = AS.ryd;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = hexA(C.rydberg, 0.55 * v);
        ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++) {
            for (let c = 0; c < AG.cols; c++) {
                const a = AS.grid[i * 2][c], b = AS.grid[i * 2 + 1][c];
                if (!a || !b) continue;
                ring((a.x + b.x) / 2, (a.y + b.y) / 2, 20 + 12 * v);
            }
        }
        ctx.setLineDash([]);
        beam(150, 186, 850, 186, C.rydberg, 6, 0.25 * v);
        beam(150, 370, 850, 370, C.rydberg, 6, 0.25 * v);
    }

    function drawBand() {
        if (AS.band < 0) return;
        const x = AS.band;
        const g = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
        g.addColorStop(0, "rgba(226, 232, 240, 0)");
        g.addColorStop(0.5, "rgba(226, 232, 240, 0.12)");
        g.addColorStop(1, "rgba(226, 232, 240, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 50, 180, 100, 195);
    }

    function drawArrayAtoms() {
        for (const a of AS.atoms) {
            if (a.carried) {
                ctx.globalCompositeOperation = "lighter";
                glow(a.x, a.y, 22, C.tweezer, 0.55 * a.a);
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = hexA(C.tweezer, 0.9 * a.a);
                ctx.lineWidth = 1.2;
                ring(a.x, a.y, 10);
            }
            let color = SP[a.sp];
            if (AS.ryd > 0.01 && a.state === "site") color = mixHex(color, C.rydberg, AS.ryd);
            if (AS.band >= 0 && Math.abs(a.x - AS.band) < 45) {
                ctx.globalCompositeOperation = "lighter";
                glow(a.x, a.y, 20, "#e2e8f0", 0.6 * (1 - Math.abs(a.x - AS.band) / 45));
                ctx.globalCompositeOperation = "source-over";
            }
            if (a.flash > 0) {
                ctx.globalCompositeOperation = "lighter";
                glow(a.x, a.y, 30, a.state === "cav" ? C.photon : C.accent, a.flash);
                ctx.globalCompositeOperation = "source-over";
            }
            drawAtom(a.x, a.y, a.sp, clamp(a.a, 0, 1), 1, color);
        }
    }

    function drawFx() {
        for (const f of AS.fx) {
            if (f.type === "photon") {
                if (f.t < 0) continue;
                let d = f.t * f.speed, x, y;
                if (d < f.seg[0]) { x = f.pts[0][0] + Math.sign(f.pts[1][0] - f.pts[0][0]) * d; y = AG.cavY + f.yo; }
                else { x = f.pts[1][0] + (d - f.seg[0]); y = AG.cavY + f.yo * 0.3; }
                ctx.globalCompositeOperation = "lighter";
                glow(x, y, 9, C.photon, 0.95);
                beam(x - 16, y, x, y, C.photon, 2, 0.6);
                ctx.globalCompositeOperation = "source-over";
            } else {
                const p = f.t / f.dur;
                ctx.strokeStyle = hexA(f.color, (1 - p) * (f.type === "pulse" ? 0.9 : 0.6));
                ctx.lineWidth = f.type === "pulse" ? 2 : 1;
                ring(f.x, f.y, (f.type === "pulse" ? 8 : 4) + p * 22);
            }
        }
    }

    function drawImage() {
        if (AS.image <= 0.01) return;
        const a = AS.image;
        ctx.fillStyle = `rgba(5, 7, 10, ${0.82 * a})`;
        rr(196, 180, 608, 195, 8);
        ctx.fill();
        for (let r = 0; r < AG.rows; r++) {
            for (let c = 0; c < AG.cols; c++) {
                const [x, y] = siteXY(r, c), at = AS.grid[r][c];
                const on = at && !at.moving && at.state === "site";
                ctx.fillStyle = on ? `rgba(235, 240, 248, ${0.85 * a})` : `rgba(60, 68, 80, ${0.5 * a})`;
                ctx.fillRect(x - 9, y - 9, 18, 18);
                if (on) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
                    ctx.fillRect(x - 4, y - 4, 8, 8);
                }
            }
        }
        text("FLUORESCENCE IMAGE", 204, 192, { size: 9, color: C.text, alpha: a });
    }

    function drawProbe() {
        if (AS.probe < 0 || AS.probeA <= 0.01) return;
        const x = AG.x0 + AS.probe * AG.dx;
        beam(x, 448, x, AG.cavY, C.l780, 6, AS.probeA);
    }

    function drawBits() {
        if (AS.bitsA <= 0.01) return;
        for (let c = 0; c < AG.cols; c++) {
            const b = AS.bits[c];
            if (b === null) continue;
            text(String(b), AG.x0 + c * AG.dx, AG.cavY + 30, {
                align: "center", size: 12, weight: 700,
                color: b ? C.photon : C.faint, alpha: AS.bitsA
            });
        }
    }

    function drawChart() {
        if (!AS.chartOn) return;
        const x = 30, y = 556, w = 260, h = 50;
        text("ARRAY FILLING", x, y - 8, { size: 9 });
        ctx.strokeStyle = "rgba(201, 212, 227, 0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y + 4); ctx.lineTo(x + w, y + 4);
        ctx.stroke();
        ctx.setLineDash([]);
        const n = AS.chart.length;
        if (n > 1) {
            ctx.strokeStyle = AS.reload ? C.accent : C.rb;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const xx = x + w - (n - 1 - i) * (w / 159);
                const yy = y + 4 + (1 - AS.chart[i]) * (h - 6);
                if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
            }
            ctx.stroke();
        }
        const last = n ? AS.chart[n - 1] : 1;
        text(`${Math.round(last * 100)} %`, x + w + 10, y + 14, { size: 13, color: C.text, weight: 600 });
        text(`cycles ${AS.cycles}`, x + w + 10, y + 32, { size: 9 });
        text(`reloaded ${AS.reloaded}`, x + w + 10, y + 46, { size: 9 });
    }

    function drawArrayLabels() {
        text("conveyor from the glass cell", ST.x.load + 16, 14);
        text("loading zone", ST.x.load, 154, { align: "center" });
        text("Yb storage", ST.x.yb, 154, { align: "center" });
        text("Rb storage", ST.x.rb, 154, { align: "center" });

        for (let r = 0; r < AG.rows; r++) {
            const sp = AG.rowSp[r];
            text(sp === "yb" ? "Yb data" : "Rb ancilla", AG.x0 - 34, AG.y0 + r * AG.dy, {
                align: "right", size: 10, color: hexA(SP[sp], 0.9)
            });
        }

        text("optical cavity · 780 nm", 500, AG.cavY - 46, { align: "center" });

        /* scale bar: site pitch ~ 5 µm */
        const sx = 812, sy = AG.y0 + 3 * AG.dy;
        ctx.strokeStyle = hexA(C.text, 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx + AG.dx, sy);
        ctx.stroke();
        text("~5 µm", sx + AG.dx / 2, sy - 12, { align: "center", size: 9 });

        if (AS.status) text(AS.status, compact ? 855 : 935, 24, { align: "right", color: C.accent, size: 11 });
    }

    function drawArrayView() {
        drawStorage();
        drawCavity();
        drawSites();
        drawBand();
        drawLinks();
        drawRydberg();
        drawProbe();
        drawArrayAtoms();
        drawFx();
        drawImage();
        drawBits();
        drawChart();
        drawArrayLabels();
    }


    /* =========================================================
       CODE VIEW  (distance-3 rotated surface code)
       ========================================================= */

    const SC = { x0: 300, y0: 190, P: 120 };
    const dq = (i, j) => [SC.x0 + i * SC.P, SC.y0 + j * SC.P];

    /* plaquette (a, b) covers data (a..a+1, b..b+1); type by checkerboard,
       weight-2 plaquettes only on the matching boundaries */
    const PLAQ = [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [1, 2], [-1, 1], [2, 0]].map(([a, b]) => {
        const data = [[a, b], [a + 1, b], [a, b + 1], [a + 1, b + 1]]
            .map(d => (d[0] >= 0 && d[0] <= 2 && d[1] >= 0 && d[1] <= 2 ? d : null));
        const type = (a + b) % 2 === 0 ? "Z" : "X";
        let [ax, ay] = dq(a + 0.5, b + 0.5);
        if (b < 0) ay += 0.22 * SC.P;
        if (b > 1) ay -= 0.22 * SC.P;
        if (a < 0) ax += 0.22 * SC.P;
        if (a > 1) ax -= 0.22 * SC.P;
        return { a, b, data, type, ax, ay, flag: 0 };
    });
    const typeCol = t => (t === "X" ? C.rydberg : C.l556);

    const CS = { err: null, errA: 0, layer: -1, linkA: 0, syndA: 0, decA: 0, fix: 0, rounds: 0, fixed: 0, readout: 0 };

    function codeReset() {
        Object.assign(CS, { err: null, errA: 0, layer: -1, linkA: 0, syndA: 0, decA: 0, fix: 0, readout: 0 });
        for (const q of PLAQ) q.flag = 0;
    }

    function hits(q, e) {
        if (!e) return false;
        const on = q.data.some(d => d && d[0] === e.i && d[1] === e.j);
        if (!on) return false;
        return q.type === "Z" ? e.type !== "Z" : e.type !== "X";
    }

    function codeRound() {
        const acts = [];
        acts.push({
            dur: 1.3,
            start() {
                codeReset();
                if (Math.random() < 0.85) {
                    CS.err = { i: Math.floor(rand(0, 3)), j: Math.floor(rand(0, 3)), type: ["X", "Z", "X", "Z", "Y"][Math.floor(rand(0, 5))] };
                    AS.status = "an error strikes · we can't see it directly";
                } else {
                    AS.status = "a quiet round · maybe no error";
                }
            },
            update(p) { CS.errA = CS.err ? Math.min(1, p * 3) : 0; }
        });
        for (let k = 0; k < 4; k++) {
            acts.push({
                dur: 0.5,
                start() { CS.layer = k; AS.status = `stabilizer round · CZ layer ${k + 1}/4`; },
                update(p) { CS.linkA = Math.sin(Math.PI * p); }
            });
        }
        acts.push({
            dur: 1.4,
            start() {
                CS.layer = -1;
                for (const q of PLAQ) q.flag = hits(q, CS.err) ? 1 : 0;
                const n = PLAQ.filter(q => q.flag).length;
                AS.status = `cavity readout of the ancillas · ${n} stabilizer${n === 1 ? "" : "s"} flipped`;
            },
            update(p) { CS.readout = Math.sin(Math.PI * Math.min(1, p * 2)); CS.syndA = Math.min(1, p * 2.5); }
        });
        acts.push({
            dur: 1.4,
            start() {
                const e = CS.err;
                AS.status = e ? `decoder: ${e.type} error on data qubit ${e.j * 3 + e.i + 1}` : "all stabilizers +1 · nothing to correct";
            },
            update(p) { CS.decA = CS.err ? Math.min(1, p * 2) : 0; }
        });
        acts.push({
            dur: 1.1,
            start() {
                CS.rounds++;
                if (!CS.err) return;
                CS.fixed++;
                AS.status = `apply ${CS.err.type} correction · logical qubit intact`;
            },
            update(p) { CS.fix = CS.err ? Math.sin(Math.PI * p) : 0; CS.errA = CS.err ? 1 - p : 0; },
            end() { CS.err = null; }
        });
        acts.push({ dur: 1.0, update(p) { CS.syndA = CS.decA = 1 - p; } });
        return acts;
    }

    function drawCodeView() {
        const t = simTime;

        /* plaquettes */
        for (const q of PLAQ) {
            const col = typeCol(q.type), pts = q.data.filter(Boolean).map(d => dq(d[0], d[1]));
            ctx.fillStyle = hexA(col, 0.10 + 0.18 * q.flag * CS.syndA);
            ctx.strokeStyle = hexA(col, 0.45);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            if (pts.length === 4) {
                ctx.moveTo(pts[0][0], pts[0][1]);
                ctx.lineTo(pts[1][0], pts[1][1]);
                ctx.lineTo(pts[3][0], pts[3][1]);
                ctx.lineTo(pts[2][0], pts[2][1]);
                ctx.closePath();
            } else {
                const [A, B] = pts, cx = (A[0] + B[0]) / 2, cy = (A[1] + B[1]) / 2;
                const r = Math.hypot(B[0] - A[0], B[1] - A[1]) / 2;
                const out = Math.atan2(q.ay - cy, q.ax - cx);
                ctx.arc(cx, cy, r, out - Math.PI / 2, out + Math.PI / 2);
                ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();
            text(q.type, q.ax + 16, q.ay - 14, { size: 10, color: hexA(col, 0.9) });
        }

        /* CZ links of the current layer */
        if (CS.layer >= 0 && CS.linkA > 0.01) {
            for (const q of PLAQ) {
                const d = q.data[CS.layer];
                if (!d) continue;
                const [x, y] = dq(d[0], d[1]);
                beam(q.ax, q.ay, x, y, C.rydberg, 5, 0.9 * CS.linkA);
            }
        }

        /* decoder lines from flipped stabilizers to the faulty qubit */
        if (CS.err && CS.decA > 0.01) {
            const [ex, ey] = dq(CS.err.i, CS.err.j);
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = hexA(C.accent, 0.8 * CS.decA);
            ctx.lineWidth = 1.5;
            for (const q of PLAQ) {
                if (!q.flag) continue;
                ctx.beginPath();
                ctx.moveTo(q.ax, q.ay);
                ctx.lineTo(ex, ey);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        /* data qubits (Yb) */
        for (let j = 0; j < 3; j++) {
            for (let i = 0; i < 3; i++) {
                const [x, y] = dq(i, j), hit = CS.err && CS.err.i === i && CS.err.j === j;
                if (hit && CS.errA > 0.01) {
                    ctx.globalCompositeOperation = "lighter";
                    glow(x, y, 34, "#ef4444", 0.55 * CS.errA * (0.8 + 0.2 * Math.sin(t * 10)));
                    ctx.globalCompositeOperation = "source-over";
                    text(CS.err.type, x + 14, y - 16, { size: 13, weight: 700, color: "#f87171", alpha: CS.errA });
                }
                if (hit && CS.fix > 0.01) {
                    ctx.strokeStyle = hexA(C.accent, CS.fix);
                    ctx.lineWidth = 2;
                    ring(x, y, 12 + 14 * CS.fix);
                }
                let col = C.yb;
                if (CS.linkA > 0.01 && CS.layer >= 0) col = mixHex(C.yb, C.rydberg, 0.5 * CS.linkA);
                drawAtom(x, y, "yb", 1, 1.25, col);
                text(String(j * 3 + i + 1), x - 14, y + 16, { size: 9, color: C.faint });
            }
        }

        /* ancillas (Rb) with their syndrome bit */
        for (const q of PLAQ) {
            if (CS.readout > 0.01) {
                ctx.globalCompositeOperation = "lighter";
                glow(q.ax, q.ay, 26, q.flag ? C.photon : C.rb, 0.6 * CS.readout * (q.flag ? 1 : 0.4));
                ctx.globalCompositeOperation = "source-over";
            }
            drawAtom(q.ax, q.ay, "rb", 1, 1.05);
            if (CS.syndA > 0.01) {
                text(q.flag ? "−1" : "+1", q.ax, q.ay + 20, {
                    align: "center", size: 10, weight: 700,
                    color: q.flag ? C.accent : C.faint, alpha: CS.syndA
                });
            }
        }

        /* side panel */
        if (!compact) {
            const x = 700, y = 170, w = 285, h = 300;
            panel(x, y, w, h, "SURFACE CODE · d = 3");
            drawAtom(732, 216, "yb", 1, 1.1);
            text("9 Yb data qubits", 752, 216, { color: C.text });
            drawAtom(732, 248, "rb", 1, 1.1);
            text("8 Rb ancillas · measure", 752, 248, { color: C.text });
            ctx.fillStyle = hexA(C.rydberg, 0.25);
            ctx.fillRect(724, 272, 16, 16);
            text("X stabilizer · finds Z errors", 752, 280, { size: 10 });
            ctx.fillStyle = hexA(C.l556, 0.25);
            ctx.fillRect(724, 300, 16, 16);
            text("Z stabilizer · finds X errors", 752, 308, { size: 10 });
            text("1 logical qubit", x + 16, 352, { color: C.text, size: 12, weight: 600 });
            text("corrects any single-qubit error", x + 16, 372, { size: 10 });
            text(`rounds ${CS.rounds}`, x + 16, 410, { size: 10, color: C.text });
            text(`errors corrected ${CS.fixed}`, x + 16, 430, { size: 10, color: C.text });
        }

        if (AS.status) text(AS.status, compact ? 980 : 985, 24, { align: "right", color: C.accent, size: 11 });
    }


    /* =========================================================
       CIRCUIT VIEW  (4-qubit GHZ, compiled to H + CZ, with a
       small state-vector simulator so the amplitudes are real)
       ========================================================= */

    const CQ = {
        n: 4, wx0: 70, wx1: 900, wy0: 82, dy: 52, cx0: 190, cdx: 92,
        ay: 470, ax0: 120, adx: 95, bx0: 540, bx1: 960, by: 492, bh: 70
    };
    /* CNOT(c, t) = H(t) · CZ(c, t) · H(t); neighbouring H gates share a column */
    const CIRC = [
        [["H", 0], ["H", 1]],
        [["CZ", 0, 1]],
        [["H", 1], ["H", 2]],
        [["CZ", 1, 2]],
        [["H", 2], ["H", 3]],
        [["CZ", 2, 3]],
        [["H", 3]],
        [["M"]]
    ];
    const colX = k => CQ.cx0 + k * CQ.cdx;
    const bitsOf = i => i.toString(2).padStart(4, "0");      /* q0 is the leftmost bit */

    const CV = {
        v: new Float64Array(16), disp: new Float64Array(16),
        col: -1, head: CQ.cx0 - 60,
        pulse: [0, 0, 0, 0], off: [0, 0, 0, 0], carried: [false, false, false, false],
        cz: null, czA: 0, result: null, measA: 0,
        shots: 0, ghz0: 0, ghz1: 0, other: 0
    };

    function circuitReset() {
        CV.v.fill(0);
        CV.v[0] = 1;
        CV.col = -1;
        CV.head = CQ.cx0 - 60;
        CV.pulse.fill(0);
        CV.off.fill(0);
        CV.carried.fill(false);
        CV.cz = null;
        CV.czA = 0;
        CV.result = null;
        CV.measA = 0;
    }

    function applyH(k) {
        const m = 1 << (3 - k), r = Math.SQRT1_2;
        for (let i = 0; i < 16; i++) {
            if (i & m) continue;
            const a = CV.v[i], b = CV.v[i | m];
            CV.v[i] = (a + b) * r;
            CV.v[i | m] = (a - b) * r;
        }
    }

    function applyCZ(c, t) {
        const m = (1 << (3 - c)) | (1 << (3 - t));
        for (let i = 0; i < 16; i++) if ((i & m) === m) CV.v[i] = -CV.v[i];
    }

    function measureState() {
        let u = Math.random(), i = 0;
        for (; i < 15; i++) { u -= CV.v[i] * CV.v[i]; if (u <= 0) break; }
        CV.result = bitsOf(i);
        CV.shots++;
        if (i === 0) CV.ghz0++;
        else if (i === 15) CV.ghz1++;
        else CV.other++;
        CV.v.fill(0);
        CV.v[i] = 1;
    }

    function circuitRound() {
        const acts = [{ dur: 0.6, start() { circuitReset(); AS.status = "start in |0000⟩"; } }];
        CIRC.forEach((col, k) => {
            acts.push({
                dur: 0.35,
                start() { CV.col = k; this.h0 = CV.head; },
                update(p) { CV.head = lerp(this.h0, colX(k), ease(p)); }
            });
            const g = col[0][0];
            if (g === "H") {
                const qs = col.map(x => x[1]);
                acts.push({
                    dur: 0.7,
                    start() { AS.status = `single-qubit gates · H on ${qs.map(q => "q" + q).join(", ")}`; },
                    update(p) { for (const q of qs) CV.pulse[q] = Math.sin(Math.PI * p); },
                    end() { for (const q of qs) { CV.pulse[q] = 0; applyH(q); } }
                });
            } else if (g === "CZ") {
                const [, c, t] = col[0], d = CQ.adx - 34;
                acts.push({
                    dur: 0.6,
                    start() { AS.status = `tweezer brings q${t} next to q${c}`; CV.carried[t] = true; },
                    update(p) { CV.off[t] = -d * ease(p); }
                });
                acts.push({
                    dur: 0.7,
                    start() { CV.cz = [c, t]; AS.status = `Rydberg pulse · CZ on q${c}, q${t}`; },
                    update(p) { CV.czA = Math.sin(Math.PI * p); },
                    end() { CV.czA = 0; CV.cz = null; applyCZ(c, t); }
                });
                acts.push({
                    dur: 0.6,
                    start() { AS.status = `q${t} back to its site`; },
                    update(p) { CV.off[t] = -d * (1 - ease(p)); },
                    end() { CV.carried[t] = false; }
                });
            } else {
                acts.push({
                    dur: 1.0,
                    start() { measureState(); AS.status = `measure all · result ${CV.result}`; },
                    update(p) { CV.measA = Math.min(1, p * 3); }
                });
                acts.push({ dur: 1.6 });
            }
        });
        return acts;
    }

    function updateCircuit(dt) {
        const f = Math.min(1, dt * 8);
        for (let i = 0; i < 16; i++) CV.disp[i] += (CV.v[i] - CV.disp[i]) * f;
    }

    function drawCircuitView() {
        const done = k => k < CV.col, now = k => k === CV.col;

        /* wires */
        for (let q = 0; q < 4; q++) {
            const y = CQ.wy0 + q * CQ.dy;
            ctx.strokeStyle = hexA(C.text, 0.25);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(CQ.wx0 + 46, y);
            ctx.lineTo(CQ.wx1, y);
            ctx.stroke();
            text(`q${q} |0⟩`, CQ.wx0, y, { color: C.text, size: 11 });
        }

        /* gates */
        CIRC.forEach((col, k) => {
            const x = colX(k), a = now(k) ? 1 : done(k) ? 0.75 : 0.4;
            const stroke = now(k) ? C.accent : C.yb;
            for (const g of col) {
                if (g[0] === "H") {
                    const y = CQ.wy0 + g[1] * CQ.dy;
                    ctx.fillStyle = "#121722";
                    ctx.strokeStyle = hexA(stroke, a);
                    ctx.lineWidth = 1.4;
                    rr(x - 14, y - 14, 28, 28, 5);
                    ctx.fill();
                    ctx.stroke();
                    text("H", x, y + 1, { align: "center", size: 12, weight: 700, color: hexA(stroke, a) });
                } else if (g[0] === "CZ") {
                    const y1 = CQ.wy0 + g[1] * CQ.dy, y2 = CQ.wy0 + g[2] * CQ.dy;
                    ctx.strokeStyle = hexA(now(k) ? C.accent : C.rydberg, a);
                    ctx.fillStyle = hexA(now(k) ? C.accent : C.rydberg, a);
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(x, y1);
                    ctx.lineTo(x, y2);
                    ctx.stroke();
                    circle(x, y1, 5);
                    circle(x, y2, 5);
                } else {
                    for (let q = 0; q < 4; q++) {
                        const y = CQ.wy0 + q * CQ.dy;
                        ctx.fillStyle = "#121722";
                        ctx.strokeStyle = hexA(stroke, a);
                        ctx.lineWidth = 1.4;
                        rr(x - 14, y - 14, 28, 28, 5);
                        ctx.fill();
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.arc(x, y + 6, 9, Math.PI * 1.15, Math.PI * 1.85);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(x, y + 6);
                        ctx.lineTo(x + 6, y - 6);
                        ctx.stroke();
                    }
                }
            }
        });

        /* CNOT brackets: each H · CZ · H group */
        if (!compact) {
            for (let k = 0; k < 3; k++) {
                const x1 = colX(2 * k) - 18, x2 = colX(2 * k + 2) + 18, y = CQ.wy0 + 3 * CQ.dy + 34;
                ctx.strokeStyle = hexA(C.dim, 0.5);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y); ctx.lineTo(x2, y); ctx.lineTo(x2, y - 5);
                ctx.stroke();
                text(`CNOT q${k}→q${k + 1} = H · CZ · H`, (x1 + x2) / 2, y + 14, { align: "center", size: 9 });
            }
        }

        /* playhead */
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = hexA(C.accent, 0.7);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(CV.head, CQ.wy0 - 30);
        ctx.lineTo(CV.head, CQ.wy0 + 3 * CQ.dy + 22);
        ctx.stroke();
        ctx.setLineDash([]);

        /* the atoms executing it */
        text("THE ATOMS", CQ.ax0 - 30, CQ.ay - 74, { size: 9 });
        const pos = q => [CQ.ax0 + q * CQ.adx + CV.off[q], CQ.ay];
        if (CV.cz && CV.czA > 0.01) {
            const [c, t] = CV.cz, [x1, y1] = pos(c), [x2] = pos(t);
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = hexA(C.rydberg, 0.7 * CV.czA);
            ctx.lineWidth = 1.2;
            ring((x1 + x2) / 2, y1, 30 + 6 * CV.czA);
            ctx.setLineDash([]);
            beam(CQ.ax0 - 50, CQ.ay, CQ.ax0 + 3 * CQ.adx + 50, CQ.ay, C.rydberg, 6, 0.3 * CV.czA);
        }
        for (let q = 0; q < 4; q++) {
            const [x, y] = pos(q);
            ctx.strokeStyle = hexA(C.tweezer, 0.16);
            ctx.lineWidth = 1;
            ring(CQ.ax0 + q * CQ.adx, y, 11);
            if (CV.pulse[q] > 0.01) beam(x, y - 70, x, y, "#c4b5fd", 7, 0.9 * CV.pulse[q]);
            if (CV.carried[q]) {
                ctx.globalCompositeOperation = "lighter";
                glow(x, y, 22, C.tweezer, 0.5);
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = hexA(C.tweezer, 0.9);
                ring(x, y, 11);
            }
            let col = C.yb;
            if (CV.cz && CV.cz.includes(q)) col = mixHex(C.yb, C.rydberg, CV.czA);
            const bright = CV.result && CV.result[q] === "1";
            if (CV.measA > 0.01 && bright) {
                ctx.globalCompositeOperation = "lighter";
                glow(x, y, 30, "#e2e8f0", 0.7 * CV.measA);
                ctx.globalCompositeOperation = "source-over";
            }
            drawAtom(x, y, "yb", 1, 1.3, col);
            text(`q${q}`, CQ.ax0 + q * CQ.adx, y + 26, { align: "center", size: 10 });
            if (CV.result && CV.measA > 0.01) {
                text(CV.result[q], CQ.ax0 + q * CQ.adx, y - 34, {
                    align: "center", size: 15, weight: 700, alpha: CV.measA,
                    color: bright ? C.text : C.faint
                });
            }
        }

        /* amplitudes */
        const w = (CQ.bx1 - CQ.bx0) / 16;
        text("STATE · AMPLITUDES", CQ.bx0, CQ.by - CQ.bh - 22, { size: 9 });
        ctx.strokeStyle = hexA(C.text, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CQ.bx0, CQ.by);
        ctx.lineTo(CQ.bx1, CQ.by);
        ctx.stroke();
        for (let i = 0; i < 16; i++) {
            const a = CV.disp[i], x = CQ.bx0 + i * w + 3, h = a * CQ.bh;
            if (Math.abs(h) > 0.5) {
                ctx.fillStyle = hexA(a >= 0 ? C.yb : C.rb, 0.85);
                ctx.fillRect(x, h > 0 ? CQ.by - h : CQ.by, w - 6, Math.abs(h));
            }
            if (!compact || i === 0 || i === 15) {
                ctx.save();
                ctx.translate(x + (w - 6) / 2, CQ.by + CQ.bh + 8);
                ctx.rotate(-Math.PI / 2);
                text(bitsOf(i), 0, 0, { align: "right", size: 8, color: i === 0 || i === 15 ? C.text : C.faint });
                ctx.restore();
            }
        }
        text("+", CQ.bx0 - 12, CQ.by - CQ.bh / 2, { size: 10, color: C.yb });
        text("−", CQ.bx0 - 12, CQ.by + CQ.bh / 2, { size: 10, color: C.rb });
        text(`shots ${CV.shots} · 0000: ${CV.ghz0} · 1111: ${CV.ghz1} · other: ${CV.other}`,
            CQ.bx0, 608, { size: 10, color: C.text });

        if (AS.status) text(AS.status, compact ? 980 : 985, 24, { align: "right", color: C.accent, size: 11 });
    }


    /* =========================================================
       APPLICATIONS VIEW  (maximum independent set on a unit-disk
       graph: the Rydberg blockade forbids neighbours natively)
       ========================================================= */

    const MIS = (() => {
        const jit = [[8, -6], [-10, 12], [14, 4], [-6, -12], [10, 10], [-14, -4], [4, 14], [12, -10],
            [-8, 6], [6, -14], [-12, 10], [14, 8], [-4, -8], [10, -4], [-10, -12], [6, 12]];
        const nodes = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if ((r === 0 && c === 3) || (r === 3 && c === 0)) continue;
                const j = jit[r * 4 + c];
                nodes.push({ x: 110 + c * 120 + j[0], y: 150 + r * 112 + j[1], p: 0, show: 0 });
            }
        }
        const R = 150, edges = [];
        for (let i = 0; i < nodes.length; i++)
            for (let k = i + 1; k < nodes.length; k++)
                if (Math.hypot(nodes[i].x - nodes[k].x, nodes[i].y - nodes[k].y) < R) edges.push([i, k]);
        /* brute force: the largest set with no edge inside */
        const n = nodes.length;
        let best = 0, bestN = 0;
        for (let m = 1; m < (1 << n); m++) {
            let ok = true;
            for (const [i, k] of edges) if ((m >> i) & (m >> k) & 1) { ok = false; break; }
            if (!ok) continue;
            let c = 0;
            for (let x = m; x; x &= x - 1) c++;
            if (c > bestN) { bestN = c; best = m; }
        }
        nodes.forEach((nd, i) => { nd.mis = !!((best >> i) & 1); nd.ph = rand(0, TAU); });
        return { nodes, edges, R, size: bestN, edgeA: 0, sweep: 0, found: 0, phase: "" };
    })();

    function misRound() {
        return [
            {
                dur: 1.6,
                start() {
                    MIS.found = 0; MIS.sweep = 0;
                    for (const nd of MIS.nodes) { nd.p = 0; nd.show = 0; }
                    AS.status = "problem → atoms: neighbours closer than the blockade radius are linked";
                },
                update(p) { MIS.edgeA = p; }
            },
            {
                dur: 4.0,
                start() { AS.status = "sweep the laser detuning slowly · blockade forbids excited neighbours"; },
                update(p) {
                    MIS.sweep = p;
                    for (const nd of MIS.nodes) {
                        const ramp = clamp((p - 0.15) / 0.75, 0, 1);
                        nd.p = nd.mis ? ease(ramp) : 0.45 * Math.sin(Math.PI * ramp);
                    }
                }
            },
            {
                dur: 1.2,
                start() {
                    /* mostly the optimum; sometimes one short, as in real runs */
                    const miss = Math.random() < 0.2 ? MIS.nodes.filter(nd => nd.mis)[Math.floor(rand(0, MIS.size))] : null;
                    let k = 0;
                    for (const nd of MIS.nodes) { nd.show = nd.mis && nd !== miss ? 1 : 0; k += nd.show; }
                    MIS.found = k;
                    AS.status = k === MIS.size
                        ? `measured: ${k} atoms excited · a maximum independent set`
                        : `measured: ${k} atoms · one short of the optimum (${MIS.size}) · run again`;
                },
                update(p) { for (const nd of MIS.nodes) nd.p = lerp(nd.p, nd.show, p); }
            },
            { dur: 2.4 },
            { dur: 0.8, update(p) { MIS.edgeA = 1 - p; for (const nd of MIS.nodes) nd.p *= 1 - p; } }
        ];
    }

    const APPS = [
        {
            title: "OPTIMIZATION", tag: "explored today", col: C.rydberg,
            lines: ["scheduling, logistics, network design", "maps natively onto Rydberg arrays", "(left) · advantage still an open question"]
        },
        {
            title: "CHEMISTRY & MATERIALS", tag: "needs error correction", col: C.l556,
            lines: ["catalysts, batteries, drug molecules", "simulate electrons the way nature does", "needs hundreds of logical qubits"]
        },
        {
            title: "CRYPTOGRAPHY", tag: "far future", col: C.rb,
            lines: ["Shor's algorithm breaks RSA", "RSA-2048: < 1 million noisy qubits", "(2025 estimate) · drives post-quantum crypto"]
        }
    ];

    function drawAppsView() {
        const t = simTime;

        text("EXAMPLE · MAXIMUM INDEPENDENT SET", 60, 72, { size: 9 });
        text("e.g. place radio towers so no two neighbours interfere", 60, 90, { size: 10, color: C.text });

        ctx.lineWidth = 1.2;
        for (const [i, k] of MIS.edges) {
            const a = MIS.nodes[i], b = MIS.nodes[k];
            ctx.strokeStyle = hexA(C.text, 0.22 * MIS.edgeA);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        for (const nd of MIS.nodes) {
            if (nd.p > 0.6) {
                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = hexA(C.rydberg, 0.35 * (nd.p - 0.6) / 0.4);
                ctx.lineWidth = 1;
                ring(nd.x, nd.y, MIS.R / 2);
                ctx.setLineDash([]);
            }
        }
        for (const nd of MIS.nodes) {
            const flick = MIS.sweep > 0 && MIS.sweep < 1 && !nd.show ? 0.15 * Math.sin(t * 9 + nd.ph) : 0;
            const p = clamp(nd.p + flick, 0, 1);
            if (p > 0.05) {
                ctx.globalCompositeOperation = "lighter";
                glow(nd.x, nd.y, 30, C.rydberg, 0.7 * p);
                ctx.globalCompositeOperation = "source-over";
            }
            drawAtom(nd.x, nd.y, "rb", 1, 1.2, mixHex(C.rb, C.rydberg, p));
        }

        /* blockade radius scale */
        ctx.strokeStyle = hexA(C.text, 0.45);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(60, 600); ctx.lineTo(60 + MIS.R, 600);
        ctx.stroke();
        text("blockade radius", 60 + MIS.R + 10, 600, { size: 9 });
        if (MIS.found) text(`${MIS.found} / ${MIS.size}`, 560, 600, { size: 13, weight: 600, color: C.text, align: "right" });

        if (!compact) {
            APPS.forEach((a, i) => {
                const x = 640, y = 70 + i * 178, w = 345, h = 158;
                panel(x, y, w, h, a.title);
                ctx.fillStyle = hexA(a.col, 0.9);
                circle(x + w - 20, y + 20, 4);
                text(a.tag, x + w - 32, y + 20, { size: 9, align: "right", color: a.col });
                a.lines.forEach((ln, k) => text(ln, x + 16, y + 56 + k * 24, { size: 10, color: k === 0 ? C.text : C.dim }));
            });
        }

        if (AS.status) text(AS.status, compact ? 980 : 985, 24, { align: "right", color: C.accent, size: 11 });
    }


    /* =========================================================
       STEPS
       ========================================================= */

    const dot = c => `<span class="dot" style="background:${c}"></span>`;

    const steps = [

        {
            nav: "Machine",
            view: "machine",
            label: "THE MACHINE · SCHEMATIC",
            title: "Two species, one machine.",
            text:
                `<p>This machine works with two elements side by side: <span class="yb">ytterbium-171</span> and <span class="rb">rubidium-87</span>. Both start in ovens in the middle of the apparatus and fall down into a rectangular glass cell, where they are laser-cooled. From there they are carried up into the octagon, the science chamber where the actual quantum computing happens.</p>
                 <p>Why two species? Their optical transitions are hundreds of nanometres apart, so light meant for one barely touches the other. Yb stores the quantum information. Rb is the messenger that gets measured.</p>`,
            chips: [`${dot(C.yb)}¹⁷¹Yb · data qubits`, `${dot(C.rb)}⁸⁷Rb · ancilla qubits`, "ultra-high vacuum"],
            papers: [["Saffman, Walker & Mølmer", "Rev. Mod. Phys. 82, 2313 (2010)", "https://doi.org/10.1103/RevModPhys.82.2313", "The standard review: Rydberg blockade as the basis of neutral-atom quantum computing."], ["Singh et al.", "Phys. Rev. X 12, 011040 (2022)", "https://doi.org/10.1103/PhysRevX.12.011040", "First dual-element (Rb + Cs) tweezer array, 512 sites, negligible crosstalk."], ["Anand et al.", "Nat. Phys. 20, 1744 (2024)", "https://doi.org/10.1038/s41567-024-02638-2", "Rb–Cs interspecies Rydberg gate and Bell state; readout via the other species."], ["Ma et al.", "Phys. Rev. X 12, 021028 (2022)", "https://doi.org/10.1103/PhysRevX.12.021028", "Universal gate operations on ¹⁷¹Yb nuclear-spin qubits in tweezers."]],
            enter() {
                machineReset();
                MS.cooling = false;
                MS.lattice = false;
                MS.beamA = MS.latA = 0;
                MS.panel = "legend";
            }
        },

        {
            nav: "Cooling",
            view: "machine",
            label: "LASER COOLING · MAGNETO-OPTICAL TRAPS",
            title: "Catch them with light.",
            text:
                `<p>Leaving the ovens, atoms move at hundreds of metres per second. Laser beams tuned slightly below an atomic resonance are scattered mostly by atoms moving towards them, thanks to the Doppler shift. Every scattered photon kicks the atom backwards, so the atoms slow down from all directions. Add a magnetic field gradient and the same light also pushes them towards the centre: a <em>magneto-optical trap</em> (MOT).</p>
                 <p>In the glass cell we form one 3D MOT per species: <span class="yb">Yb</span> on its narrow 556&nbsp;nm line and <span class="rb">Rb</span> on its 780&nbsp;nm D2 line. Both end up at tens of microkelvin.</p>`,
            chips: [`${dot(C.l556)}556 nm · Yb MOT`, `${dot(C.l780)}780 nm · Rb MOT`, "→ tens of µK"],
            papers: [["Chu et al.", "Phys. Rev. Lett. 55, 48 (1985)", "https://doi.org/10.1103/PhysRevLett.55.48", "First 3D optical molasses: viscous laser cooling of atoms."], ["Raab et al.", "Phys. Rev. Lett. 59, 2631 (1987)", "https://doi.org/10.1103/PhysRevLett.59.2631", "The first magneto-optical trap."], ["Kuwamoto et al.", "Phys. Rev. A 60, R745 (1999)", "https://doi.org/10.1103/PhysRevA.60.R745", "Yb MOT on the narrow 556 nm intercombination line."]],
            enter() {
                machineReset();
                MS.cooling = false;
                MS.lattice = false;
                MS.beamA = MS.latA = 0;
                MS.panel = "cool";
                play(() => [
                    { dur: 1.2 },
                    { dur: 0.05, start() { MS.cooling = true; } },
                    { dur: 10 },
                    { dur: 0.05, start() { machineReset(); MS.cooling = false; } }
                ], true);
            }
        },

        {
            nav: "Conveyor",
            view: "machine",
            label: "OPTICAL CONVEYOR BELT",
            title: "Ride the conveyor belt.",
            text:
                `<p>The glass cell is a noisy place: hot atoms from the ovens, background gas, scattered MOT light. The qubits need somewhere quieter, so the cold <span class="yb">Yb</span> and <span class="rb">Rb</span> atoms are carried up into the octagon.</p>
                 <p>The vehicle is a <em>moving optical lattice</em>. Two counter-propagating beams form a standing wave with a trap every λ/2. Shift one beam by Δν and the pattern slides along at <em>v&nbsp;=&nbsp;λΔν/2</em>, carrying the atoms with it.</p>
                 <p>The belt runs in batches. It loads a packet from the MOT, Δν is ramped up and smoothly back down to zero, and the belt stops in the octagon. Small storage tweezers take the atoms off, the lattice is switched off, and the atoms are parked. Then the next batch starts, alternating between the species.</p>`,
            chips: ["glass cell → octagon", "batches · stop and go", "v = λΔν/2"],
            papers: [["Kuhr et al.", "Science 293, 278 (2001)", "https://doi.org/10.1126/science.1062725", "On-demand delivery of single atoms with a moving standing wave."], ["Schrader et al.", "Appl. Phys. B 73, 819 (2001)", "https://doi.org/10.1007/s003400100722", "The optical conveyor belt for single neutral atoms."], ["Matthies et al.", "Phys. Rev. A 109, 023321 (2024)", "https://doi.org/10.1103/PhysRevA.109.023321", "Cs and Rb transported ~37 cm in under 25 ms."], ["Chiu et al.", "Nature 646, 1075 (2025)", "https://doi.org/10.1038/s41586-025-09596-6", "Lattice conveyor belts feed atom reservoirs into the science region."]],
            enter() {
                MS.panel = "lattice";
                MS.cooling = true;
                if (countMode("mot", "yb") < 20 || countMode("mot", "rb") < 20) {
                    machineReset();
                    MS.lattice = false;
                    warmMachine(5);
                }
                MS.lattice = true;
                resetConveyor();
            },
            control(box) {
                box.innerHTML =
                    `<label for="nap-dnu">Peak frequency difference Δν <b id="nap-dnu-v"></b></label>
                     <input type="range" id="nap-dnu" min="0" max="3" step="0.05" value="${MS.dnu}">
                     <div class="readout" id="nap-dnu-r"></div>`;
                const inp = box.querySelector("#nap-dnu");
                const update = () => {
                    MS.dnu = parseFloat(inp.value);
                    const v = 1064e-9 * MS.dnu * 1e6 / 2;
                    box.querySelector("#nap-dnu-v").textContent =
                        MS.dnu < 1 ? `${Math.round(MS.dnu * 1000)} kHz` : `${MS.dnu.toFixed(2)} MHz`;
                    box.querySelector("#nap-dnu-r").innerHTML = MS.dnu === 0
                        ? `v = 0: a standing wave, the atoms stay put.<br><small>example: λ = 1064 nm</small>`
                        : `peak speed v = λΔν/2 = <b>${v.toFixed(2)} m/s</b><br><small>example: λ = 1064 nm</small>`;
                };
                inp.addEventListener("input", update);
                update();
            }
        },

        {
            nav: "Storage",
            view: "array",
            label: "OCTAGON · STORAGE",
            title: "Stop, catch, park.",
            text:
                `<p>Now we zoom into the octagon. Here the conveyor belt stops: Δν is ramped to zero and the lattice holds a cloud of cold atoms in place. A <em>storage tweezer array</em> is switched on right on top of the cloud, and then the lattice is switched off. Atoms outside the tweezers fall away. Where several atoms share a tweezer, light-assisted collisions kick them out in pairs, so every tweezer ends up with either zero or one atom, a bit more than half of them filled.</p>
                 <p>The storage array is then moved over into the storage region. The conveyor is free again and brings the next cloud. Batches alternate between <span class="yb">Yb</span> and <span class="rb">Rb</span>, each parked on its own side.</p>`,
            chips: ["conveyor stops · Δν → 0", "storage tweezers overlap the cloud", "0 or 1 atom per tweezer", "lattice off → move to storage"],
            papers: [["Norcia et al.", "PRX Quantum 5, 030316 (2024)", "https://doi.org/10.1103/PRXQuantum.5.030316", "¹⁷¹Yb reservoir refills a 1225-site array to 99 % occupancy, repeatedly."], ["Pause et al.", "Optica 11, 222 (2024)", "https://doi.org/10.1364/OPTICA.513551", "Tiled tweezer arrays with >1000 atoms; one array resupplies the other."], ["Gyger et al.", "Phys. Rev. Research 6, 033104 (2024)", "https://doi.org/10.1103/PhysRevResearch.6.033104", "Continuously operated >1000-atom arrays with atoms recycled from a lattice."]],
            enter() {
                arrayEnter();
                clearArray();
                setStore(0);
                LD.status = true;
                play(() => [
                    { dur: 0.05, start() { setStore(0); AS.storeA = 1; resetLoader(); AS.feeding = true; } },
                    { dur: 11 },
                    { dur: 1.6, start() { AS.feeding = false; } },
                    { dur: 0.6, update(p) { AS.storeA = 1 - p; } }
                ], true);
            }
        },

        {
            nav: "Picking",
            view: "array",
            label: "SINGLE-ATOM PICK-UP",
            title: "One atom per tweezer.",
            text:
                `<p>Below the storage sits the <em>science array</em>: a static pattern of optical tweezers, each a trap about a micrometre across, shaped by a <em>spatial light modulator</em> (SLM). Moving tweezers steered by <em>acousto-optic deflectors</em> (AODs) pull single atoms out of the storage sites and drop them into the science tweezers. Many atoms move at once, one row at a time.</p>
                 <p>Not every transfer works. A fluorescence image shows the holes, and a second pass fills them. The result is a defect-free register: rows of <span class="yb">Yb</span> data qubits interleaved with <span class="rb">Rb</span> ancillas. Meanwhile the conveyor keeps topping up the storage.</p>`,
            chips: ["single-atom pick-up", "AOD · moving tweezers", "SLM · science array", "defect-free 40/40"],
            papers: [["Schlosser et al.", "Nature 411, 1024 (2001)", "https://doi.org/10.1038/35082512", "Single atoms in a microscopic tweezer via collisional blockade."], ["Barredo et al.", "Science 354, 1021 (2016)", "https://doi.org/10.1126/science.aah3778", "Atom-by-atom assembly of defect-free 2D arrays."], ["Endres et al.", "Science 354, 1024 (2016)", "https://doi.org/10.1126/science.aah3752", "Real-time rearrangement into defect-free 1D arrays."], ["Manetsch et al.", "Nature 647, 60 (2025)", "https://doi.org/10.1038/s41586-025-09641-4", "6100 atoms in ~12,000 tweezers, 12.6 s coherence."]],
            enter() {
                arrayEnter();
                clearArray();
                play(() => {
                    const acts = [];
                    for (let r = 0; r < AG.rows; r++) {
                        acts.push({
                            dur: 1.25,
                            start() {
                                const n = fillRowFromRes(r, 1.1, 0.12);
                                AS.status = `row ${r + 1}: ${n} atom${n === 1 ? "" : "s"} picked in parallel`;
                            }
                        });
                    }
                    acts.push({
                        dur: 1.2,
                        start() { AS.status = `fluorescence image · ${countSites()}/40 · find the holes`; },
                        update(p) { AS.image = p < 0.5 ? p * 2 : 2 - 2 * p; }
                    });
                    acts.push({
                        dur: 1.25,
                        start() {
                            let n = 0;
                            for (let r = 0; r < AG.rows; r++) n += fillRowFromRes(r, 1.1, 0);
                            AS.status = n ? `filling ${n} hole${n === 1 ? "" : "s"}` : "no holes";
                        }
                    });
                    acts.push({
                        dur: 1.0,
                        start() { AS.status = `defect-free · ${countSites()}/40`; },
                        update(p) { AS.image = p < 0.5 ? p * 2 : 2 - 2 * p; }
                    });
                    acts.push({ dur: 1.6 });
                    acts.push({
                        dur: 0.6,
                        start() { AS.status = "reset and repeat"; for (const a of AS.atoms) a.state = "fade"; },
                        end() { clearArray(); setStore(ST.cap); }
                    });
                    return acts;
                }, true);
            }
        },

        {
            nav: "Gates",
            view: "array",
            label: "RYDBERG GATES",
            title: "Entangle data and ancilla.",
            text:
                `<p>Each atom stores a qubit in two long-lived ground states. For <span class="yb">¹⁷¹Yb</span> that is the nuclear spin, which barely notices its environment. Single-qubit rotations are laser or RF pulses.</p>
                 <p>For entanglement, atoms are briefly excited to a <em>Rydberg state</em>: a giant atom whose strong interaction stops its neighbour from being excited too (the Rydberg blockade). That gives a controlled-Z gate, even between Yb and Rb. Afterwards each ancilla carries information about its data partner, for example a parity check for error correction.</p>`,
            chips: [`${dot(C.rydberg)}Rydberg blockade`, "CZ gate · sub-µs", "Yb ↔ Rb"],
            papers: [["Jaksch et al.", "Phys. Rev. Lett. 85, 2208 (2000)", "https://doi.org/10.1103/PhysRevLett.85.2208", "The original Rydberg-blockade gate proposal."], ["Evered et al.", "Nature 622, 268 (2023)", "https://doi.org/10.1038/s41586-023-06481-y", "99.5 % CZ gates on up to 60 atoms in parallel."], ["Peper et al.", "Phys. Rev. X 15, 011009 (2025)", "https://doi.org/10.1103/PhysRevX.15.011009", "¹⁷¹Yb Rydberg spectroscopy and modelling; CZ fidelity 0.994."], ["Muniz et al.", "PRX Quantum 6, 020334 (2025)", "https://doi.org/10.1103/PRXQuantum.6.020334", "¹⁷¹Yb nuclear-spin CZ: 99.40 % raw, 99.72 % post-selected."]],
            enter() {
                arrayEnter();
                clearArray();
                fillAll();
                play(() => [
                    {
                        dur: 1.5,
                        start() { AS.status = "single-qubit rotation · global"; },
                        update(p) { AS.band = lerp(150, 850, p); },
                        end() { AS.band = -1; }
                    },
                    { dur: 0.4 },
                    gateAction(1.8),
                    { dur: 1.8, start() { AS.status = "entangled pairs"; } },
                    { dur: 0.8, update(p) { setLinks(1 - p); } }
                ], true);
            }
        },

        {
            nav: "Readout",
            view: "array",
            label: "CAVITY-ASSISTED MID-CIRCUIT READOUT",
            title: "Ask the cavity, fast.",
            text:
                `<p>To catch errors mid-computation, the ancillas have to be measured without disturbing the data. A camera image takes milliseconds and scatters light all over the array.</p>
                 <p>Instead, the <span class="rb">Rb</span> ancillas are shuttled into the mode of an <em>optical cavity</em>, two mirrors facing each other. An ancilla in the bright state scatters photons into the cavity, which funnels them onto a single-photon detector, so the state is read out in microseconds. The <span class="yb">Yb</span> data qubits have no transition anywhere near 780&nbsp;nm and stay coherent. The result feeds forward into the next operation.</p>`,
            chips: ["µs instead of ms", "site-selective", "data qubits untouched", "feed-forward"],
            papers: [["Bochmann et al.", "Phys. Rev. Lett. 104, 203601 (2010)", "https://doi.org/10.1103/PhysRevLett.104.203601", "Cavity-based state detection that keeps the atom."], ["Deist et al.", "Phys. Rev. Lett. 129, 203602 (2022)", "https://doi.org/10.1103/PhysRevLett.129.203602", "Mid-circuit cavity measurement in an array, tens of µs."], ["Hu et al.", "Phys. Rev. Lett. 134, 120801 (2025)", "https://doi.org/10.1103/PhysRevLett.134.120801", "Site-selective cavity readout of an atomic register, repeated error correction."], ["Grinkemeyer et al.", "Science 387, 1301 (2025)", "https://doi.org/10.1126/science.adr7075", "99.96 % fiber-cavity readout; error-detected cavity-mediated entanglement."]],
            enter() {
                arrayEnter();
                clearArray();
                fillAll();
                setLinks(1);
                AS.roRow = 3;
                AS.firstRo = true;
                play(() => {
                    const r = AS.roRow, acts = [];
                    if (!AS.firstRo) acts.push(gateAction(1.2));
                    AS.firstRo = false;
                    acts.push({ dur: 1.4, start() { AS.status = "shuttle Rb ancillas into the cavity mode"; shuttleToCavity(r, 1.3); } });
                    acts.push({ dur: 0.4, start() { AS.status = "cavity probe on"; }, update(p) { AS.cavA = lerp(0.25, 1, p); } });
                    for (let c = 0; c < AG.cols; c++) {
                        acts.push({
                            dur: 0.3,
                            start() { AS.status = `site-selective readout · ancilla ${c + 1}/10`; probe(r, c); },
                            update(p) { AS.probeA = Math.sin(Math.PI * p); }
                        });
                    }
                    acts.push({
                        dur: 1.2,
                        start() {
                            AS.probe = -1;
                            AS.status = "decode → feed-forward correction";
                            for (let c = 0; c < AG.cols; c++) AS.link[pairIndex(r)][c] = 0;
                            feedForward(r);
                        },
                        update(p) { AS.cavA = lerp(1, 0.25, p); }
                    });
                    acts.push({ dur: 1.4, start() { AS.status = "ancillas back into the array"; shuttleBack(r, 1.3, 0); } });
                    acts.push({
                        dur: 0.6,
                        update(p) { AS.bitsA = 1 - p; },
                        end() { AS.bits.fill(null); AS.roRow = r === 3 ? 1 : 3; }
                    });
                    return acts;
                }, true);
            }
        },

        {
            nav: "Continuous",
            view: "array",
            label: "CONTINUOUS OPERATION",
            title: "Never stop.",
            text:
                `<p>Atoms don't last forever. Background-gas collisions knock them out, and a measured ancilla is heated and best thrown away. A conventional machine has to stop, reload everything and start over.</p>
                 <p>This one keeps going. The MOTs keep producing cold atoms, the conveyor keeps delivering clouds of <span class="yb">Yb</span> and <span class="rb">Rb</span> that are parked in storage, and fresh atoms are moved into every hole while the computation continues. Toggle reloading to compare.</p>`,
            chips: ["lost atom → replaced", "used ancillas recycled", "hours, not seconds"],
            papers: [["Singh et al.", "Phys. Rev. X 12, 011040 (2022)", "https://doi.org/10.1103/PhysRevX.12.011040", "Continuous mode: one species reloaded while the other is held."], ["Chiu et al.", "Nature 646, 1075 (2025)", "https://doi.org/10.1038/s41586-025-09596-6", "300,000 atoms/s reloaded; >3000 qubits kept for over 2 hours."], ["Li et al.", "Science 393, 1213 (2026)", "https://doi.org/10.1126/science.adz9952", "Fast, continuous and coherent reloading of a ¹⁷¹Yb qubit array."]],
            enter() {
                arrayEnter();
                clearArray();
                fillAll();
                AS.chart = [];
                AS.chartOn = true;
                AS.lossRate = 0.015;
                AS.roRow = 3;
                AS.reloaded = 0;
                AS.cycles = 0;
                AS.feeding = AS.reload;
                play(() => {
                    const r = AS.roRow;
                    const acts = [
                        gateAction(0.9),
                        { dur: 1.0, start() { AS.status = "ancillas → cavity"; shuttleToCavity(r, 0.9); } },
                        { dur: 0.25, start() { AS.status = "cavity readout"; }, update(p) { AS.cavA = lerp(0.25, 1, p); } }
                    ];
                    for (let c = 0; c < AG.cols; c++) {
                        acts.push({ dur: 0.12, start() { probe(r, c); }, update(p) { AS.probeA = Math.sin(Math.PI * p); } });
                    }
                    acts.push({
                        dur: 0.7,
                        start() {
                            AS.probe = -1;
                            for (let c = 0; c < AG.cols; c++) AS.link[pairIndex(r)][c] = 0;
                            if (AS.reload) { AS.status = "measured ancillas discarded"; dumpCavity(r); }
                            else { AS.status = "ancillas reused · some lost to heating"; shuttleBack(r, 0.65, 0.2); }
                        },
                        update(p) { AS.cavA = lerp(1, 0.25, p); AS.bitsA = 1 - p; }
                    });
                    if (AS.reload) {
                        acts.push({
                            dur: 1.2,
                            start() {
                                const n = refillAll(1.1);
                                AS.status = n ? `reloading ${n} atom${n > 1 ? "s" : ""} from storage` : "array full";
                            }
                        });
                    }
                    acts.push({ dur: 0.3, end() { AS.roRow = r === 3 ? 1 : 3; AS.cycles++; AS.bits.fill(null); } });
                    return acts;
                }, true);
            },
            control(box) {
                box.innerHTML =
                    `<label>Reloading</label>
                     <div class="nap-toggle"><button type="button" data-v="1">On</button><button type="button" data-v="0">Off</button></div>
                     <div class="readout"><small>Switch it off and watch the filling decay: every loss and every measured ancilla leaves a hole.</small></div>`;
                const btns = box.querySelectorAll("button");
                const sync = () => btns.forEach(b => b.classList.toggle("on", (b.dataset.v === "1") === AS.reload));
                btns.forEach(b => b.addEventListener("click", () => {
                    AS.reload = b.dataset.v === "1";
                    AS.feeding = AS.reload;
                    sync();
                }));
                sync();
            }
        },

        {
            nav: "Error correction",
            view: "code",
            label: "SURFACE CODE · DISTANCE 3",
            title: "Catch errors before they spread.",
            text:
                `<p>All of this is there to run <em>quantum error correction</em>. In the surface code, nine <span class="yb">Yb</span> data qubits share one logical qubit. Eight <span class="rb">Rb</span> ancillas sit on the plaquettes between them and repeatedly check their neighbours: X stabilizers detect Z errors, Z stabilizers detect X errors.</p>
                 <p>Each round, every ancilla is entangled with its 2 or 4 data neighbours (four layers of CZ gates) and then read out through the cavity. An error flips the neighbouring stabilizers from +1 to −1, the decoder locates it, and a correction is applied, all without ever measuring the data qubits themselves.</p>`,
            chips: ["9 data + 8 ancillas", "1 logical qubit", "fixes any single error", "repeated every round"],
            papers: [["Fowler et al.", "Phys. Rev. A 86, 032324 (2012)", "https://doi.org/10.1103/PhysRevA.86.032324", "The standard surface-code reference: ~1 % threshold, resource estimates."], ["Bluvstein et al.", "Nature 626, 58 (2024)", "https://doi.org/10.1038/s41586-023-06927-3", "Logical processor with up to 48 logical qubits on reconfigurable atom arrays."], ["Google Quantum AI", "Nature 638, 920 (2025)", "https://doi.org/10.1038/s41586-024-08449-y", "Distance-7 surface code below threshold, Λ ≈ 2.14."], ["Bluvstein et al.", "Nature 649, 39 (2026)", "https://doi.org/10.1038/s41586-025-09848-5", "Fault-tolerant neutral-atom architecture: surface code below threshold with atom reuse."]],
            enter() {
                codeReset();
                CS.rounds = CS.fixed = 0;
                AS.status = "";
                play(codeRound, true);
            }
        },

        {
            nav: "Circuits",
            view: "circuit",
            label: "QUANTUM CIRCUITS · COMPILED TO NATIVE GATES",
            title: "From circuits to laser pulses.",
            text:
                `<p>An algorithm is written as a <em>quantum circuit</em>: qubits as lines, gates as boxes. The machine itself only knows a few <em>native gates</em>: single-qubit rotations (laser or RF pulses, on all atoms or on selected ones) and the Rydberg CZ gate. A compiler translates everything else, for example a CNOT becomes H&nbsp;·&nbsp;CZ&nbsp;·&nbsp;H.</p>
                 <p>Atoms that need to interact are brought next to each other by moving tweezers, so any qubit can talk to any other. This example creates a four-qubit GHZ state. The bars show the actual quantum amplitudes after each gate, including the sign flips from the CZ gates. An ideal machine then measures only 0000 or 1111, each half of the time.</p>`,
            chips: ["native gates: rotations + CZ", "CNOT = H · CZ · H", "atoms moved to interact", "GHZ: 0000 or 1111"],
            papers: [["Barenco et al.", "Phys. Rev. A 52, 3457 (1995)", "https://doi.org/10.1103/PhysRevA.52.3457", "Any circuit can be built from single-qubit gates plus one two-qubit gate."], ["Levine et al.", "Phys. Rev. Lett. 123, 170503 (2019)", "https://doi.org/10.1103/PhysRevLett.123.170503", "Parallel high-fidelity CZ and three-qubit gates with Rydberg atoms."], ["Graham et al.", "Nature 604, 457 (2022)", "https://doi.org/10.1038/s41586-022-04603-6", "Multi-qubit entanglement and first algorithms on a neutral-atom computer."], ["Bluvstein et al.", "Nature 604, 451 (2022)", "https://doi.org/10.1038/s41586-022-04592-6", "Moving entangled atoms mid-circuit to connect any qubits."]],
            enter() {
                circuitReset();
                CV.disp.fill(0);
                CV.disp[0] = 1;
                CV.shots = CV.ghz0 = CV.ghz1 = CV.other = 0;
                AS.status = "";
                play(circuitRound, true);
            }
        },

        {
            nav: "Applications",
            view: "apps",
            label: "APPLICATIONS",
            title: "Why build all this?",
            text:
                `<p>To solve a real problem, it has to be translated into qubits and gates. Some problems fit neutral atoms almost natively. In the <em>maximum independent set</em> problem you pick as many points of a network as possible, with no two neighbours. Place one atom per point: the Rydberg blockade already forbids neighbouring excitations, and a slow laser sweep drives the atoms towards the best answer.</p>
                 <p>The big promises are further away. Simulating molecules for catalysts, batteries or drugs, and factoring numbers with Shor's algorithm, need error-corrected logical qubits (step 09) in large numbers. Today's machines are research devices, and a clear industrial advantage has not been shown yet. Getting there is exactly what labs like ours are working on.</p>`,
            chips: ["optimization · explored today", "chemistry · needs error correction", "cryptography · far future"],
            papers: [["Ebadi et al.", "Science 376, 1209 (2022)", "https://doi.org/10.1126/science.abo6587", "Maximum independent set solved natively on up to 289 Rydberg atoms."], ["Reiher et al.", "PNAS 114, 7555 (2017)", "https://doi.org/10.1073/pnas.1619152114", "Resource estimate for simulating nitrogen fixation (FeMoco) on a quantum computer."], ["Shor", "SIAM J. Comput. 26, 1484 (1997)", "https://doi.org/10.1137/S0097539795293172", "Polynomial-time factoring: the algorithm that threatens RSA."], ["Gidney", "arXiv:2505.15917 (2025)", "https://arxiv.org/abs/2505.15917", "RSA-2048 with fewer than a million noisy qubits."]],
            enter() {
                AS.status = "";
                play(misRound, true);
            }
        }
    ];


    /* =========================================================
       NAVIGATION & PANEL
       ========================================================= */

    let cur = 0, trans = null, simTime = 0;

    el.total.textContent = String(steps.length).padStart(2, "0");
    el.steps.innerHTML = steps.map((s, i) =>
        `<button class="nap-step" type="button" data-i="${i}"><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t">${s.nav}</span></button>`
    ).join("");
    const navButtons = el.steps.querySelectorAll(".nap-step");

    function renderPanel() {
        const s = steps[cur];
        el.label.textContent = s.label;
        el.current.textContent = String(cur + 1).padStart(2, "0");
        el.title.textContent = s.title;
        el.text.innerHTML = s.text;
        el.chips.innerHTML = s.chips.map(c => `<li>${c}</li>`).join("");
        el.papers.innerHTML = (s.papers || []).map(([who, ref, url, note]) =>
            `<li><a href="${url}" target="_blank" rel="noopener">${who}</a> <span class="ref">${ref}</span><br><span class="note">${note}</span></li>`
        ).join("");
        el.papersBox.hidden = !(s.papers && s.papers.length);
        el.next.innerHTML = cur === steps.length - 1 ? "Restart &#8635;" : "Next &rarr;";
        el.prev.disabled = cur === 0;
        navButtons.forEach((b, i) => {
            b.classList.toggle("active", i === cur);
            b.classList.toggle("done", i < cur);
        });
        el.control.innerHTML = "";
        if (s.control) s.control(el.control);
    }

    function goTo(i) {
        const prevView = steps[cur].view;
        cur = (i + steps.length) % steps.length;
        const s = steps[cur];
        trans = s.view !== prevView ? { from: prevView, to: s.view, t: 0, dur: 1.1 } : null;
        seq = null;
        s.enter();
        renderPanel();
        if (paused) draw();
    }

    el.next.addEventListener("click", () => goTo(cur + 1));
    el.prev.addEventListener("click", () => { if (cur > 0) goTo(cur - 1); });
    navButtons.forEach(b => b.addEventListener("click", () => goTo(+b.dataset.i)));

    root.addEventListener("keydown", e => {
        if (e.target.tagName === "INPUT") return;
        if (e.key === "ArrowRight") goTo(cur + 1);
        if (e.key === "ArrowLeft" && cur > 0) goTo(cur - 1);
    });


    /* =========================================================
       MAIN LOOP
       ========================================================= */

    let paused = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true, last = performance.now();

    function setPaused(p) {
        paused = p;
        el.pause.innerHTML = paused ? "&#9654;" : "&#10074;&#10074;";
        el.pause.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
    }
    el.pause.addEventListener("click", () => setPaused(!paused));
    setPaused(paused);

    function update(dt) {
        simTime += dt;
        if (trans) {
            trans.t += dt;
            if (trans.t >= trans.dur) trans = null;
        }
        const v = steps[cur].view;
        if (v === "machine") updateMachine(dt);
        else if (v === "array") updateArray(dt);
        else if (v === "circuit") updateCircuit(dt);
        if (MS.panel === "lattice") latticePhaseInset += 0.3 * MS.vel * dt;
        updateSeq(dt);
    }

    function drawView(v) {
        if (v === "machine") drawMachineView();
        else if (v === "code") drawCodeView();
        else if (v === "circuit") drawCircuitView();
        else if (v === "apps") drawAppsView();
        else drawArrayView();
    }

    function drawLayer(v, k, ox, oy, alpha) {
        ctx = bufCtx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, buf.width, buf.height);
        ctx.setTransform(scale * k, 0, 0, scale * k, scale * ox, scale * oy);
        drawView(v);
        ctx = mainCtx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.drawImage(buf, 0, 0);
        ctx.globalAlpha = 1;
    }

    function draw() {
        ctx = mainCtx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!trans) {
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            drawView(steps[cur].view);
            return;
        }

        const p = ease(clamp(trans.t / trans.dur, 0, 1));

        /* views other than machine <-> array simply cross-fade */
        if (trans.from !== "machine" && trans.to !== "machine") {
            drawLayer(trans.from, 1, 0, 0, 1 - p);
            drawLayer(trans.to, 1, 0, 0, p);
            return;
        }

        /* zoom between machine and octagon; q = 0 machine, q = 1 array */
        const q = trans.from === "machine" ? p : 1 - p;
        const Z = 8, cx = M.zoom.x, cy = M.zoom.y;
        const km = 1 + (Z - 1) * q;
        drawLayer("machine", km, q * (W / 2 - Z * cx), q * (H / 2 - Z * cy), 1 - q);
        const ka = lerp(0.3, 1, q);
        drawLayer("array", ka, (W / 2) * (1 - ka), (H / 2) * (1 - ka), q);
    }

    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!paused && visible) {
            update(dt);
            draw();
        }
        requestAnimationFrame(frame);
    }

    if (window.IntersectionObserver) {
        new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(canvas);
    }

    window.addEventListener("resize", () => { resize(); draw(); });

    resize();
    goTo(0);
    draw();
    requestAnimationFrame(frame);
})();
