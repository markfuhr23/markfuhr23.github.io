/* =========================================================
   NEUTRAL ATOM PLAYGROUND
   Dual-species (171Yb + 87Rb), continuously reloaded,
   cavity-assisted mid-circuit readout.

   One <canvas>, two "views":
     machine : the vacuum system (octagon -> conveyor -> glass cell)
     array   : zoom into the glass cell (reservoirs, tweezers, cavity)
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
        sci: { yb: { x: 512, y: 126 }, rb: { x: 528, y: 136 } },
        zoom: { x: 520, y: 130 }
    };

    const MS = {
        p: [],
        cooling: false, beamA: 0,
        lattice: false, latA: 0,
        phase: 0, dnu: 1.0,
        spawn: 0, packet: 0, nextSp: "yb",
        panel: "legend"
    };

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

    function latticeSpeed() { return 90 * MS.dnu; }          // px/s on screen

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
        MS.latA += ((MS.lattice ? 1 : 0) - MS.latA) * Math.min(1, dt * 3);

        const v = latticeSpeed();
        if (MS.lattice) MS.phase += v * dt;

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

        /* load packets from the MOTs into the moving lattice, alternating species */
        if (MS.lattice && v > 2) {
            MS.packet -= dt;
            const sp = MS.nextSp;
            if (MS.packet <= 0 && countMode("mot", sp) > 12) {
                MS.packet = 0.5;
                MS.nextSp = sp === "yb" ? "rb" : "yb";
                const s = 7, off = (((-MS.phase) % s) + s) % s;
                const pick = MS.p.filter(p => p.m === "mot" && p.sp === sp).sort(() => Math.random() - 0.5).slice(0, 6);
                for (const p of pick) {
                    p.m = "lat";
                    p.x0 = M.ax + rand(-2.5, 2.5);
                    p.y = off + Math.round((p.y - off) / s) * s;
                }
            }
        }

        for (const p of MS.p) {
            p.age += dt;
            if (p.m !== "fade") p.a = Math.min(1, p.a + dt * 4);
            const mot = M.mot[p.sp], sci = M.sci[p.sp];

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
                    p.y -= v * dt;
                    p.x = p.x0 + Math.sin(p.age * 9 + p.seed) * 0.8;
                    if (p.y <= sci.y + 2) {
                        p.m = "sci";
                        p.vx = randn() * 10;
                        p.vy = -v * 0.4;
                    }
                    break;

                case "sci":
                    motStep(p, sci.x, sci.y, dt, 5, 14, 3000);
                    break;

                case "fade":
                    p.a -= dt * 1.5;
                    p.x += (p.vx || 0) * dt * 0.3;
                    p.y += (p.vy || 0) * dt * 0.3;
                    break;
            }
        }

        for (const sp of ["yb", "rb"]) {
            retireOldest("mot", sp, 40);
            retireOldest("sci", sp, 28);
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
            text(MS.dnu === 0 ? "Δν = 0: standing wave, atoms stay" : "Δν > 0: the wells move  →",
                x + w / 2, 402, { align: "center", size: 10 });
        }
    }

    let latticePhaseInset = 0;

    function drawMachineView() {
        drawHardware();
        drawMachineBeams();
        drawMachineLattice();

        for (const p of MS.p) drawAtom(p.x, p.y, p.sp, p.a, 0.75);

        drawMachineLabels();
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
        resY: 108,
        res: { yb: { x: 300, rx: 140, ry: 22 }, rb: { x: 700, rx: 140, ry: 22 } },
        resMax: 48,
        convX: 500
    };

    const AS = {
        atoms: [], grid: [], tweens: [], fx: [],
        res: { yb: AG.resMax, rb: AG.resMax },
        resPts: { yb: [], rb: [] },
        conv: [],
        convPhase: 0, feedT: 0, feeding: true,
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

    for (const sp of ["yb", "rb"]) {
        const R = AG.res[sp];
        for (let i = 0; i < 40; i++) {
            const a = rand(0, TAU), r = Math.sqrt(Math.random());
            AS.resPts[sp].push({ ox: R.rx * 0.92 * r * Math.cos(a), oy: R.ry * 0.8 * r * Math.sin(a), ph: rand(0, TAU) });
        }
    }

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
        AS.res.yb = AS.res.rb = AG.resMax;
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

    function randomFill(p) {
        for (let r = 0; r < AG.rows; r++)
            for (let c = 0; c < AG.cols; c++)
                if (Math.random() < p) placeAtom(r, c);
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

    function resPoint(sp) {
        const R = AG.res[sp], pts = AS.resPts[sp];
        const q = pts[Math.floor(Math.random() * pts.length)];
        return [R.x + q.ox, AG.resY + q.oy];
    }

    function takeFromRes(sp, strict) {
        if (AS.res[sp] > 0) AS.res[sp]--;
        else if (strict) return null;
        return resPoint(sp);
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

    function stochasticLoad() {
        for (let r = 0; r < AG.rows; r++) {
            for (let c = 0; c < AG.cols; c++) {
                const sp = AG.rowSp[r], [x, y] = siteXY(r, c), u = Math.random();
                if (u < 0.5) {
                    const p = resPoint(sp), a = makeAtom(sp, p[0], p[1]);
                    a.r = r; a.c = c; a.a = 0;
                    AS.grid[r][c] = a;
                    move(a, [[x, y]], 0.7, { delay: rand(0, 0.8), tweezer: false });
                } else if (u < 0.78) {
                    /* two atoms in one tweezer: light-assisted collision ejects both */
                    const d = rand(0, 0.5);
                    for (let k = 0; k < 2; k++) {
                        const p = resPoint(sp), a = makeAtom(sp, p[0], p[1]);
                        a.a = 0;
                        move(a, [[x + (k ? 3 : -3), y]], 0.7, {
                            delay: d, tweezer: false,
                            onDone(at) {
                                at.state = "lost";
                                at.vx = (k ? 1 : -1) * rand(60, 110);
                                at.vy = rand(-60, 60);
                                if (k === 0) puff(x, y, "#ffffff");
                            }
                        });
                    }
                }
            }
        }
    }

    function fillRowFromRes(r, dur, strict) {
        let n = 0;
        for (let c = 0; c < AG.cols; c++) {
            if (AS.grid[r][c]) continue;
            const sp = AG.rowSp[r], p = takeFromRes(sp, strict);
            if (!p) continue;
            const a = makeAtom(sp, p[0], p[1]);
            a.r = r; a.c = c;
            AS.grid[r][c] = a;
            const [x, y] = siteXY(r, c), gx = x - AG.dx / 2;
            move(a, [[gx, 165], [gx, y], [x, y]], dur);
            n++;
        }
        return n;
    }

    function refillAll(dur) {
        let n = 0;
        for (let r = 0; r < AG.rows; r++) n += fillRowFromRes(r, dur, true);
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

        /* the conveyor delivers both species; each goes to its own reservoir */
        if (AS.feeding) {
            AS.convPhase += 60 * dt;
            AS.feedT -= dt;
            if (AS.feedT <= 0) {
                AS.feedT = 0.2;
                const inc = { yb: AS.res.yb, rb: AS.res.rb };
                for (const p of AS.conv) inc[p.sp]++;
                const sp = inc.yb <= inc.rb ? "yb" : "rb";
                if (inc[sp] < AG.resMax) AS.conv.push({ sp, m: "down", x: AG.convX + rand(-2, 2), y: -6 });
            }
        }
        AS.conv = AS.conv.filter(p => {
            if (p.m === "down") {
                p.y += 60 * dt;
                if (p.y >= AG.resY) { p.m = "side"; p.ty = AG.resY + rand(-8, 8); }
                return true;
            }
            const R = AG.res[p.sp], dir = p.sp === "yb" ? -1 : 1;
            p.x += dir * 90 * dt;
            p.y += (p.ty - p.y) * Math.min(1, dt * 5);
            if (dir * (p.x - R.x) >= -R.rx * 0.75) {
                AS.res[p.sp] = Math.min(AG.resMax, AS.res[p.sp] + 1);
                return false;
            }
            return true;
        });

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

    function drawReservoirs() {
        const t = simTime;

        /* conveyor from the octagon */
        const cx = AG.convX, fa = AS.feeding ? 1 : 0.35;
        beam(cx, -10, cx, AG.resY, C.lattice, 9, 0.4 * fa);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = hexA(C.lattice, 0.45 * fa);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const off = AS.convPhase % 7;
        for (let y = -10 + off; y < AG.resY - 8; y += 7) {
            ctx.moveTo(cx - 4, y);
            ctx.lineTo(cx + 4, y);
        }
        ctx.stroke();
        ctx.restore();
        for (const p of AS.conv) drawAtom(p.x, p.y, p.sp, 1, 0.6);

        for (const sp of ["yb", "rb"]) {
            const R = AG.res[sp], col = SP[sp];
            ctx.fillStyle = hexA(col, 0.05);
            ctx.strokeStyle = hexA(col, 0.22);
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.ellipse(R.x, AG.resY, R.rx, R.ry, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            const n = Math.round(clamp(AS.res[sp] / AG.resMax, 0, 1) * AS.resPts[sp].length);
            for (let i = 0; i < n; i++) {
                const q = AS.resPts[sp][i];
                drawAtom(R.x + q.ox + Math.sin(t * 2 + q.ph) * 2, AG.resY + q.oy + Math.cos(t * 1.7 + q.ph) * 1.5, sp, 0.85, 0.55);
            }
        }
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
        text("conveyor from the glass cell", AG.convX + 14, 58);
        text("Yb reservoir", AG.res.yb.x, AG.resY + 38, { align: "center" });
        text("Rb reservoir", AG.res.rb.x, AG.resY + 38, { align: "center" });

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
        drawReservoirs();
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
                 <p>Speed is free; acceleration costs trap depth, so Δν is ramped smoothly.</p>`,
            chips: ["glass cell → octagon", "both species", "v = λΔν/2"],
            enter() {
                MS.panel = "lattice";
                MS.cooling = true;
                if (countMode("mot", "yb") < 20 || countMode("mot", "rb") < 20) {
                    machineReset();
                    MS.lattice = false;
                    warmMachine(5);
                }
                MS.lattice = true;
            },
            control(box) {
                box.innerHTML =
                    `<label for="nap-dnu">Frequency difference Δν <b id="nap-dnu-v"></b></label>
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
                        : `v = λΔν/2 = <b>${v.toFixed(2)} m/s</b><br><small>example: λ = 1064 nm</small>`;
                };
                inp.addEventListener("input", update);
                update();
            }
        },

        {
            nav: "Loading",
            view: "array",
            label: "OCTAGON · TWEEZER LOADING",
            title: "One atom per tweezer.",
            text:
                `<p>Now we zoom into the octagon. The conveyor keeps delivering atoms, and each species is collected in its own reservoir: <span class="yb">Yb</span> on one side, <span class="rb">Rb</span> on the other. Below them sits an array of <em>optical tweezers</em>: tightly focused laser beams, each a trap about a micrometre across.</p>
                 <p>Loading is a coin toss. When two atoms land in the same tweezer, light-assisted collisions kick both out. Each site ends up with exactly zero or one atom, about half the time. A fluorescence image tells us which.</p>`,
            chips: ["~50 % per site", "0 or 1 atom, never 2", "fluorescence imaging"],
            enter() {
                arrayEnter();
                clearArray();
                play(() => [
                    { dur: 0.5, start() { clearArray(); AS.status = "tweezers on"; } },
                    { dur: 2.0, start() { AS.status = "loading from the reservoirs"; stochasticLoad(); } },
                    {
                        dur: 1.8,
                        start() { AS.status = `fluorescence image · ${countSites()}/40 filled`; },
                        update(p) { AS.image = Math.min(1, p * 4); }
                    },
                    { dur: 1.0, update(p) { AS.image = 1 - p; } },
                    { dur: 1.2 }
                ], true);
            }
        },

        {
            nav: "Sorting",
            view: "array",
            label: "REARRANGEMENT",
            title: "Build a perfect array.",
            text:
                `<p>A random pattern isn't useful. The static tweezer array is shaped by a <em>spatial light modulator</em> (SLM), which turns one laser beam into a whole pattern of traps. On top of that, moving tweezers steered by <em>acousto-optic deflectors</em> (AODs) pick atoms out of the reservoirs and drop them into the holes. Many atoms move at once, one row at a time.</p>
                 <p>The random pattern becomes a defect-free register: rows of <span class="yb">Yb</span> data qubits interleaved with <span class="rb">Rb</span> ancillas.</p>`,
            chips: ["SLM · static array", "AOD · moving tweezers", "defect-free 40/40"],
            enter() {
                arrayEnter();
                clearArray();
                randomFill(0.5);
                play(() => {
                    const acts = [{
                        dur: 1.0,
                        start() { AS.status = `image · ${countSites()}/40 · find the holes`; },
                        update(p) { AS.image = p < 0.5 ? p * 2 : 2 - 2 * p; }
                    }];
                    for (let r = 0; r < AG.rows; r++) {
                        acts.push({
                            dur: 1.25,
                            start() {
                                const n = fillRowFromRes(r, 1.1, false);
                                AS.status = n ? `row ${r + 1}: ${n} atom${n > 1 ? "s" : ""} in parallel` : `row ${r + 1}: already full`;
                            }
                        });
                    }
                    acts.push({
                        dur: 1.0,
                        start() { AS.status = "defect-free · 40/40"; },
                        update(p) { AS.image = p < 0.5 ? p * 2 : 2 - 2 * p; }
                    });
                    acts.push({ dur: 1.6 });
                    acts.push({
                        dur: 0.6,
                        start() { AS.status = "reset and repeat"; for (const a of AS.atoms) a.state = "fade"; },
                        end() { clearArray(); randomFill(0.5); }
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
                 <p>This one keeps going. The MOTs keep producing cold atoms, the conveyor keeps delivering <span class="yb">Yb</span> and <span class="rb">Rb</span> into the reservoirs, and fresh atoms are moved into every hole while the computation continues. Toggle reloading to compare.</p>`,
            chips: ["lost atom → replaced", "used ancillas recycled", "hours, not seconds"],
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
                                AS.status = n ? `reloading ${n} atom${n > 1 ? "s" : ""} from the reservoirs` : "array full";
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
        if (steps[cur].view === "machine") updateMachine(dt);
        else updateArray(dt);
        if (MS.panel === "lattice") latticePhaseInset += 30 * MS.dnu * dt;
        updateSeq(dt);
    }

    function drawView(v) {
        if (v === "machine") drawMachineView();
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

        /* zoom between machine and glass cell; q = 0 machine, q = 1 array */
        const p = ease(clamp(trans.t / trans.dur, 0, 1));
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
