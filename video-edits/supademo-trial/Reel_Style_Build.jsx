/*
 * Supademo footage - "viral Instagram talking head" style (Reels / Shorts).
 * Style reference: https://www.youtube.com/watch?v=Qbntd8yud0o
 *
 * Look: one text layer per word popping in on its spoken word, white heavy captions with one
 * keyword in big red italic caps, hook title with glow + light sweep and a glass UI pill bar,
 * frosted "glass" icon cards popping beside the head, big glowing single-word hits with
 * sparkles, camera-shake hits, punch-in zooms on every cut, dark moody grade.
 *
 * HOW TO USE
 *   1. Put this .jsx next to "Halva Editor Trial - Raw footage.mp4" (or pick it when asked).
 *   2. Install Montserrat (ExtraBold + Black Italic) - free on Google Fonts.
 *   3. After Effects > File > Scripts > Run Script File... > this file.
 *   4. Open REEL_30s_A. Set CFG.VERTICAL = false below for a 16:9 version.
 *
 * Built comps: REEL_30s_A (0:00-0:30), REEL_30s_B (0:10-0:40), REEL_MASTER (0:00-0:49).
 * REEL_MASTER > CONTROLS holds Accent / Accent 2 / Card Icon colours and Shake strength.
 *
 * ExtendScript is ES3: no let/const, arrow functions or Array.forEach in this file.
 */
(function () {

    // ------------------------------------------------------------------ CONFIG
    var CFG = {
        VERTICAL: true,
        FPS: 30,
        MASTER_DUR: 49.5,
        FOOTAGE_NAME: "Halva Editor Trial - Raw footage.mp4",
        FONT: "Montserrat-ExtraBold",
        FONT_ACCENT: "Montserrat-BlackItalic",
        WHITE: "#FFFFFF",
        ACCENT: "#FF2A2A",       // the reference's red keyword colour
        ACCENT_2: "#3D7BFF",     // the reference's blue keyword colour (used on "big" hits)
        CARD_ICON: "#3BD16F",    // green user icon in the glass card
        SHAKE: 16                // px, peak of a shake hit
    };
    CFG.W = CFG.VERTICAL ? 1080 : 1920;
    CFG.H = CFG.VERTICAL ? 1920 : 1080;
    var U = CFG.W / 1080;                       // layout unit (sizes are authored for 1080 wide)
    if (!CFG.VERTICAL) U = 0.9;
    CFG.CAP_SIZE = Math.round(84 * U);
    CFG.ACC_SIZE = Math.round(112 * U);
    CFG.BIG_SIZE = Math.round(190 * U);
    CFG.CAP_Y = CFG.VERTICAL ? Math.round(CFG.H * 0.66) : Math.round(CFG.H * 0.76);
    CFG.MAX_LINE = CFG.W * (CFG.VERTICAL ? 0.86 : 0.7);

    // Face position in the 4K raw; the A-roll is framed and zoomed around it.
    var FACE = [1760, 900];
    var BASE = (CFG.H / 2160) * 100 * 1.05;     // fills the frame with 5% margin for shake
    if (!CFG.VERTICAL) BASE = 50 * 1.05;

    // Same takes and cuts as the Supademo trial edit. zoom = framing multiplier for the cut.
    var SEGMENTS = [
        { name: "A01 We studied a thousand demos",  rawIn: 13.60, rawOut: 25.62, t: 0.00,  zoom: 1.00 },
        { name: "A02 Are product demos profitable", rawIn: 25.62, rawOut: 30.40, t: 12.02, zoom: 1.14 },
        { name: "A03 One thing / prettiest",        rawIn: 30.92, rawOut: 42.55, t: 16.80, zoom: 1.00 },
        { name: "A04 In fact",                      rawIn: 64.10, rawOut: 64.62, t: 28.43, zoom: 1.16 },
        { name: "A05 Worst performing demos",       rawIn: 64.98, rawOut: 74.98, t: 28.95, zoom: 1.06 },
        { name: "A06 So in this video",             rawIn: 74.98, rawOut: 85.10, t: 38.95, zoom: 1.00 }
    ];

    // Hook title (first words of the video). w = raw time of each word.
    var HOOK = { lines: [["WE", "STUDIED"], ["1,000", "DEMOS"]], w: [13.72, 14.28, 14.76, 15.64], out: 16.30 };

    // Captions. Tokens split on spaces, "|" = line break, *word* = red italic keyword.
    // w = raw start time of each (non-"|") token. style "big" = single glowing hit word(s).
    // A chunk stays up until the next one starts (or until "out").
    var CHUNKS = [
        { s: "the *biggest*", w: [16.34, 16.54] },
        { s: "SaaS | *companies*", w: [16.88, 17.26] },
        { s: "like *Beehive*", w: [17.58, 17.84] },
        { s: "*Lightspeed*", w: [18.74] },
        { s: "and *Lovable*", w: [19.30, 19.44] },
        { s: "all the way | *down*", w: [20.00, 20.28, 20.40, 20.50] },
        { s: "to *tiny* | bootstrap tools", w: [20.72, 20.96, 21.48, 22.06] },
        { s: "you've never | *heard* *of*", w: [22.38, 22.58, 22.76, 22.98] },
        { s: "and we did it | to *answer*", w: [23.34, 23.60, 23.74, 23.94, 24.08, 24.24] },
        { s: "*two* simple | questions", w: [24.48, 24.86, 25.24] },
        { s: "are product | *demos*", w: [25.66, 26.30, 26.64] },
        { s: "really that | *profitable?*", w: [26.88, 27.26, 27.56] },
        { s: "and do they | need to be", w: [28.56, 28.58, 28.74, 28.92, 29.30, 29.54] },
        { s: "a *video?*", w: [29.82, 30.04] },
        { s: "and we actually | *found*", w: [30.98, 31.14, 31.28, 31.66] },
        { s: "ONE THING", w: [31.92, 32.30], style: "big" },
        { s: "that goes | *against*", w: [32.58, 32.80, 32.98] },
        { s: "*everything*", w: [33.32] },
        { s: "most *founders* | still believe", w: [34.18, 35.02, 35.46, 35.86] },
        { s: "because the | demos that", w: [36.82, 37.36, 37.62, 37.98] },
        { s: "*convert* | the best", w: [38.24, 38.76, 39.08] },
        { s: "are not the | *prettiest*", w: [39.52, 39.86, 40.18, 40.42] },
        { s: "or most | *impressive* ones", w: [40.94, 41.34, 41.74, 42.14], out: 42.55 },
        { s: "in fact, | some of the", w: [64.18, 64.32, 65.00, 65.26, 65.42] },
        { s: "*worst* | performing demos", w: [65.50, 65.96, 66.56] },
        { s: "we studied | were", w: [66.94, 67.18, 67.52] },
        { s: "BEAUTIFUL", w: [67.96], style: "big" },
        { s: "EXPENSIVE", w: [69.12], style: "big" },
        { s: "and | completely", w: [70.06, 70.18] },
        { s: "USELESS", w: [70.82], style: "big", red: true },
        { s: "because they | were *built*", w: [71.96, 72.24, 72.40, 72.52] },
        { s: "to be | *watched*", w: [72.70, 72.86, 72.98] },
        { s: "instead | of *used*", w: [73.52, 74.36, 74.56] },
        { s: "so in this | *video*", w: [74.96, 75.56, 75.74, 76.12] },
        { s: "I'm going to | show you", w: [76.52, 76.72, 76.80, 76.90, 77.06] },
        { s: "*seven* things", w: [77.24, 77.74] },
        { s: "the highest | *converting*", w: [78.22, 78.62, 78.98] },
        { s: "SaaS demos | have in *common*", w: [79.40, 79.80, 80.00, 80.22, 80.36] },
        { s: "backed by | *data*", w: [80.96, 81.28, 81.56] },
        { s: "from over", w: [81.82, 82.10] },
        { s: "200,000", w: [82.38], style: "big" },
        { s: "*companies*", w: [83.56] },
        { s: "building | *demos*", w: [84.06, 84.50], out: 85.10 }
    ];

    // Glass icon cards that pop beside the head. side: 1 right, -1 left.
    // kind: "user" (green person icon) or "label" (big glyph). Replace labels with real logos later.
    var CARDS = [
        { kind: "user", at: 14.90, out: 16.30, side: 1 },
        { kind: "label", label: "B", color: "#F5A524", at: 17.84, out: 18.70, side: 1 },
        { kind: "label", label: "LS", color: "#3D7BFF", at: 18.74, out: 19.40, side: -1 },
        { kind: "label", label: "LV", color: "#FF4F79", at: 19.44, out: 20.40, side: 1 },
        { kind: "label", label: "?", color: CFG.ACCENT, at: 29.82, out: 30.90, side: 1 },
        { kind: "label", label: "7", color: CFG.CARD_ICON, at: 77.24, out: 78.70, side: -1 },
        { kind: "user", at: 83.56, out: 85.00, side: 1 }
    ];

    // ------------------------------------------------------------------ HELPERS
    function rgb(h) {
        h = h.replace("#", "");
        return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    }
    function rgba(h) { var c = rgb(h); c.push(1); return c; }

    function M(raw) {
        for (var i = SEGMENTS.length - 1; i >= 0; i--) {
            if (raw >= SEGMENTS[i].rawIn - 0.001) return SEGMENTS[i].t + (raw - SEGMENTS[i].rawIn);
        }
        return 0;
    }

    function ctrlExpr(name) { return 'comp("REEL_MASTER").layer("CONTROLS").effect("' + name + '")(1)'; }

    function tr(L, n) {
        var map = { pos: "ADBE Position", scale: "ADBE Scale", op: "ADBE Opacity", rot: "ADBE Rotate Z", anchor: "ADBE Anchor Point" };
        return L.property("ADBE Transform Group").property(map[n]);
    }

    function easeAll(prop, infl) {
        var n = 1, t = prop.propertyValueType;
        if (t === PropertyValueType.TwoD) n = 2;
        else if (t === PropertyValueType.ThreeD) n = 3;
        var e = [];
        for (var i = 0; i < n; i++) e.push(new KeyframeEase(0, infl));
        for (var k = 1; k <= prop.numKeys; k++) {
            try { prop.setTemporalEaseAtKey(k, e, e); } catch (err) {}
        }
    }

    function kf(prop, keys, mode) {
        for (var i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
        if (mode !== "linear") easeAll(prop, typeof mode === "number" ? mode : 75);
        return prop;
    }

    function setSpan(L, tIn, tOut) { L.inPoint = tIn; L.outPoint = tOut; }

    function fx(L, matchName) { return L.property("ADBE Effect Parade").addProperty(matchName); }

    function dropShadow(L, opacityPct, softness, distance) {
        try {
            var e = fx(L, "ADBE Drop Shadow");
            var op = e.property("ADBE Drop Shadow-0002");
            op.setValue(op.maxValue > 100 ? opacityPct * 2.55 : opacityPct);
            e.property("ADBE Drop Shadow-0004").setValue(distance);
            e.property("ADBE Drop Shadow-0005").setValue(softness);
        } catch (e2) {}
    }

    // Built-in Glow (swap for Deep Glow if you have it).
    function glow(L, radius, intensity) {
        try {
            var g = fx(L, "ADBE Glo2");
            g.property("Glow Radius").setValue(radius);
            g.property("Glow Intensity").setValue(intensity);
        } catch (e) {}
    }

    // CC Light Sweep across a text layer's box, starting at time t (layer time).
    function lightSweep(L, t, dur) {
        try {
            var r = L.sourceRectAtTime(0, false);
            var s = fx(L, "CC Light Sweep");
            s.property("Width").setValue(Math.max(40, r.height * 0.45));
            s.property("Sweep Intensity").setValue(70);
            kf(s.property("Center"), [[t, [r.left - r.width * 0.3, r.top + r.height / 2]],
                                       [t + dur, [r.left + r.width * 1.3, r.top + r.height / 2]]], "linear");
        } catch (e) {}
    }

    function fillFx(L, hex, ctrl) {
        try {
            var f = fx(L, "ADBE Fill");
            f.property("ADBE Fill-0002").setValue(rgba(hex));
            if (ctrl) f.property("ADBE Fill-0002").expression = ctrlExpr(ctrl);
        } catch (e) {}
    }

    function addText(comp, name, str, size, font, hex) {
        var L = comp.layers.addText(str);
        L.name = name;
        var sp = L.property("ADBE Text Properties").property("ADBE Text Document");
        var td = sp.value;
        try { td.resetCharStyle(); } catch (e) {}
        td.fontSize = size;
        td.applyFill = true;
        td.fillColor = rgb(hex || CFG.WHITE);
        td.applyStroke = false;
        try { td.font = font; } catch (e2) {}
        td.justification = ParagraphJustification.CENTER_JUSTIFY;
        sp.setValue(td);
        var r = L.sourceRectAtTime(0, false);
        tr(L, "anchor").setValue([r.left + r.width / 2, r.top + r.height / 2]);
        return L;
    }
    function textWidth(L) { return L.sourceRectAtTime(0, false).width; }

    // Shape layer from a list of primitives, one group each:
    // { k: "rect"|"ellipse", size, r, pos, rot, fill, fop, fctrl, stroke, sw, sop }
    function shp(comp, name, items, pos) {
        var L = comp.layers.addShape();
        L.name = name;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
            var gi = L.property("ADBE Root Vectors Group").numProperties;
            var V = L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vectors Group");
            if (it.k === "ellipse") {
                V.addProperty("ADBE Vector Shape - Ellipse");
                V = L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vectors Group");
                V.property(1).property("ADBE Vector Ellipse Size").setValue(it.size);
            } else {
                V.addProperty("ADBE Vector Shape - Rect");
                V = L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vectors Group");
                V.property(1).property("ADBE Vector Rect Size").setValue(it.size);
                V.property(1).property("ADBE Vector Rect Roundness").setValue(it.r || 0);
            }
            var n = 1;
            if (it.fill) {
                L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
                n++;
                var f = L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vectors Group").property(n);
                f.property("ADBE Vector Fill Color").setValue(rgba(it.fill));
                if (it.fop !== undefined) f.property("ADBE Vector Fill Opacity").setValue(it.fop);
                if (it.fctrl) { try { f.property("ADBE Vector Fill Color").expression = ctrlExpr(it.fctrl); } catch (e) {} }
            }
            if (it.stroke) {
                L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
                n++;
                var s = L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vectors Group").property(n);
                s.property("ADBE Vector Stroke Color").setValue(rgba(it.stroke));
                s.property("ADBE Vector Stroke Width").setValue(it.sw || 4);
                if (it.sop !== undefined) s.property("ADBE Vector Stroke Opacity").setValue(it.sop);
            }
            var tg = L.property("ADBE Root Vectors Group").property(gi).property("ADBE Vector Transform Group");
            if (it.pos) tg.property("ADBE Vector Position").setValue(it.pos);
            if (it.rot) tg.property("ADBE Vector Rotation").setValue(it.rot);
        }
        if (pos) tr(L, "pos").setValue(pos);
        return L;
    }

    // Position is relative to the parent's anchor (nulls have theirs at [50,50]).
    function parentTo(child, parent, localPos) {
        child.parent = parent;
        var a = tr(parent, "anchor").value;
        tr(child, "pos").setValue([localPos[0] + a[0], localPos[1] + a[1]]);
    }

    // The reference's word pop: scale overshoot + rise + quick fade, accents also twist in.
    function wordPop(L, t, accent) {
        var p = tr(L, "pos").value, peak = accent ? 128 : 116;
        kf(tr(L, "scale"), [[t, [0, 0, 100]], [t + 0.1, [peak, peak, 100]], [t + 0.22, [100, 100, 100]]], 65);
        kf(tr(L, "pos"), [[t, [p[0], p[1] + 40 * U]], [t + 0.18, [p[0], p[1]]]], 80);
        kf(tr(L, "op"), [[t, 0], [t + 0.05, 100]], "linear");
        if (accent) kf(tr(L, "rot"), [[t, -9], [t + 0.25, 0]], 70);
    }

    function popIn(L, t, peak) {
        kf(tr(L, "scale"), [[t, [0, 0, 100]], [t + 0.15, [peak, peak, 100]], [t + 0.28, [100, 100, 100]]], 65);
    }
    function popOut(L, t) {
        kf(tr(L, "scale"), [[t - 0.2, [100, 100, 100]], [t - 0.13, [110, 110, 100]], [t, [0, 0, 100]]], 65);
    }

    var hits = [];   // shake hit times (master)
    function marker(comp, t, label) {
        try { comp.markerProperty.setValueAtTime(t, new MarkerValue(label)); } catch (e) {}
    }

    var seed = 11;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

    // ------------------------------------------------------------------ FOOTAGE
    function findFootage() {
        var here = new File($.fileName).parent;
        var cands = [here.fsName + "/" + CFG.FOOTAGE_NAME,
                     here.fsName + "/footage/" + CFG.FOOTAGE_NAME,
                     here.fsName + "/Halva Editor Trial/" + CFG.FOOTAGE_NAME];
        for (var i = 0; i < cands.length; i++) {
            var f = new File(cands[i]);
            if (f.exists) return f;
        }
        return File.openDialog("Select the raw footage (" + CFG.FOOTAGE_NAME + ")");
    }

    // ------------------------------------------------------------------ BUILD
    if (!app.project) app.newProject();
    var footFile = findFootage();
    if (!footFile) { alert("No footage selected - build cancelled."); return; }

    app.beginUndoGroup("Build reel-style edit");

    var root = app.project.items.addFolder("REEL STYLE EDIT");
    var fFoot = app.project.items.addFolder("01 Footage"); fFoot.parentFolder = root;
    var fSolids = app.project.items.addFolder("02 Solids"); fSolids.parentFolder = root;

    var footage = app.project.importFile(new ImportOptions(footFile));
    footage.parentFolder = fFoot;

    var master = app.project.items.addComp("REEL_MASTER", CFG.W, CFG.H, 1, CFG.MASTER_DUR, CFG.FPS);
    master.parentFolder = root;
    master.motionBlur = true;

    var i, j, L, seg;

    // ---- A-roll: framed on the face, punch on every cut, slow push while talking
    for (i = 0; i < SEGMENTS.length; i++) {
        seg = SEGMENTS[i];
        L = master.layers.add(footage);
        L.name = seg.name;
        L.startTime = seg.t - seg.rawIn;
        var tIn = seg.t, tOut = seg.t + (seg.rawOut - seg.rawIn);
        setSpan(L, tIn, tOut);
        L.motionBlur = true;
        tr(L, "anchor").setValue(FACE);
        tr(L, "pos").setValue(CFG.VERTICAL ? [CFG.W / 2, FACE[1] * BASE / 100] : [CFG.W / 2 - 80, FACE[1] * BASE / 100]);
        var z = BASE * seg.zoom;
        kf(tr(L, "scale"), [[tIn, [z * 1.09, z * 1.09, 100]], [tIn + 0.25, [z, z, 100]], [tOut, [z * 1.04, z * 1.04, 100]]], 70);
        try {
            var lv = L.property("ADBE Audio Group").property("ADBE Audio Levels");
            kf(lv, [[tIn, [-30, -30]], [tIn + 0.06, [0, 0]], [tOut - 0.06, [0, 0]], [tOut, [-30, -30]]], "linear");
        } catch (e) {}
        if (i > 0) { hits.push(tIn); marker(master, tIn, "SFX whoosh / impact (cut)"); }
    }

    // ---- look: moody grade, heavy vignette, bottom shade for caption contrast
    var grade = master.layers.addSolid([1, 1, 1], "LOOK grade (adjustment)", CFG.W, CFG.H, 1);
    grade.adjustmentLayer = true;
    try { fx(grade, "ADBE Exposure2").property("Exposure").setValue(-0.25); } catch (e) {}
    try { fx(grade, "ADBE Lumetri"); } catch (e) {}
    var vig = master.layers.addSolid([0, 0, 0], "LOOK vignette", CFG.W, CFG.H, 1);
    (function () {
        var m = vig.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        var s = new Shape(), cx = CFG.W / 2, cy = CFG.H / 2, rx = CFG.W / 2 + 120, ry = CFG.H / 2 + 120, k = 0.5523;
        s.vertices = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
        s.inTangents = [[-rx * k, 0], [0, -ry * k], [rx * k, 0], [0, ry * k]];
        s.outTangents = [[rx * k, 0], [0, ry * k], [-rx * k, 0], [0, -ry * k]];
        s.closed = true;
        m.property("ADBE Mask Shape").setValue(s);
        m.property("ADBE Mask Feather").setValue([CFG.W * 0.45, CFG.W * 0.45]);
        m.inverted = true;
    })();
    tr(vig, "op").setValue(60);
    var shade = master.layers.addSolid([0, 0, 0], "LOOK caption shade", CFG.W, CFG.H, 1);
    (function () {
        var m = shade.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        var s = new Shape(), top = CFG.CAP_Y - 260 * U;
        s.vertices = [[-50, top], [CFG.W + 50, top], [CFG.W + 50, CFG.H + 50], [-50, CFG.H + 50]];
        s.closed = true;
        m.property("ADBE Mask Shape").setValue(s);
        m.property("ADBE Mask Feather").setValue([0, 320 * U]);
    })();
    tr(shade, "op").setValue(45);

    // ---- CONTROLS
    var ctrl = master.layers.addNull();
    ctrl.name = "CONTROLS";
    ctrl.enabled = false;
    var colors = [["Accent", CFG.ACCENT], ["Accent 2", CFG.ACCENT_2], ["Card Icon", CFG.CARD_ICON]];
    for (i = 0; i < colors.length; i++) {
        var cc = fx(ctrl, "ADBE Color Control");
        cc.name = colors[i][0];
        cc.property(1).setValue(rgba(colors[i][1]));
    }
    var shakeCtl = fx(ctrl, "ADBE Slider Control");
    shakeCtl.name = "Shake Amount";
    shakeCtl.property(1).setValue(CFG.SHAKE);

    // ---- HOOK title + glass UI pill bar
    (function () {
        var t0 = M(HOOK.w[0]) - 0.03, t1 = M(HOOK.out);
        var holder = master.layers.addNull();
        holder.name = "HOOK (move me)";
        tr(holder, "pos").setValue([CFG.W / 2, CFG.CAP_Y - 40 * U]);
        setSpan(holder, t0, t1);
        var sizes = [Math.round(96 * U), Math.round(170 * U)], ys = [-110 * U, 40 * U], wi = 0;
        for (var ln = 0; ln < HOOK.lines.length; ln++) {
            var accent = ln === 1, words = HOOK.lines[ln], Ls = [], total = 0, gap = 26 * U, k;
            for (k = 0; k < words.length; k++) {
                var w = addText(master, "HOOK " + words[k], words[k], sizes[ln], accent ? CFG.FONT_ACCENT : CFG.FONT, accent ? CFG.ACCENT : CFG.WHITE);
                Ls.push(w); total += textWidth(w);
            }
            total += gap * (words.length - 1);
            var scale = total > CFG.MAX_LINE ? CFG.MAX_LINE / total : 1, x = -total / 2;
            for (k = 0; k < Ls.length; k++) {
                var wdt = textWidth(Ls[k]);
                parentTo(Ls[k], holder, [(x + wdt / 2) * scale, ys[ln]]);
                if (scale < 1) tr(Ls[k], "scale").setValue([scale * 100, scale * 100, 100]);
                x += wdt + gap;
                setSpan(Ls[k], t0, t1);
                if (accent) { fillFx(Ls[k], CFG.ACCENT, "Accent"); glow(Ls[k], 35, 1.1); }
                dropShadow(Ls[k], 85, 16, 7);
                var at = M(HOOK.w[wi++]);
                wordPop(Ls[k], at, accent);
                if (accent) { lightSweep(Ls[k], at + 0.3, 0.55); hits.push(at); }
            }
        }
        // glass pill bar with UI icons, like the reference's "record / search / chat / user" bar
        var pill = shp(master, "HOOK pill bar", [
            { k: "rect", size: [600 * U, 112 * U], r: 56 * U, fill: "#0A0A0A", fop: 45, stroke: "#FFFFFF", sw: 2.5 * U, sop: 35 }
        ], null);
        parentTo(pill, holder, [0, 220 * U]);
        setSpan(pill, t0, t1);
        var icons = [
            ["icon record", [{ k: "ellipse", size: [40 * U, 40 * U], fill: "#FF3B30" }], -225],
            ["icon search", [{ k: "ellipse", size: [44 * U, 44 * U], stroke: "#FFFFFF", sw: 6 * U, pos: [-4 * U, -4 * U] },
                             { k: "rect", size: [8 * U, 24 * U], r: 4 * U, fill: "#FFFFFF", pos: [16 * U, 16 * U], rot: -45 }], -110],
            ["icon divider", [{ k: "rect", size: [3 * U, 64 * U], fill: "#FFFFFF", fop: 40 }], -20],
            ["icon chat", [{ k: "rect", size: [64 * U, 46 * U], r: 12 * U, stroke: "#FFFFFF", sw: 6 * U },
                           { k: "rect", size: [14 * U, 14 * U], fill: "#FFFFFF", pos: [-14 * U, 26 * U], rot: 45 }], 80],
            ["icon user", [{ k: "ellipse", size: [30 * U, 30 * U], fill: "#FFFFFF", pos: [0, -16 * U] },
                           { k: "rect", size: [56 * U, 28 * U], r: 14 * U, fill: "#FFFFFF", pos: [0, 18 * U] }], 200]
        ];
        var barAt = M(15.90);
        kf(tr(pill, "scale"), [[barAt, [0, 100, 100]], [barAt + 0.22, [108, 100, 100]], [barAt + 0.34, [100, 100, 100]]], 70);
        kf(tr(pill, "op"), [[barAt, 0], [barAt + 0.08, 100]], "linear");
        for (var q = 0; q < icons.length; q++) {
            var ic = shp(master, "HOOK " + icons[q][0], icons[q][1], null);
            parentTo(ic, pill, [icons[q][2] * U, 0]);
            setSpan(ic, t0, t1);
            popIn(ic, barAt + 0.12 + q * 0.05, 125);
        }
        marker(master, M(HOOK.w[0]), "SFX pop x4 (hook words)");
        marker(master, barAt, "SFX UI swipe");
    })();

    // ---- glass icon cards
    for (i = 0; i < CARDS.length; i++) {
        (function (cd, idx) {
            var at = M(cd.at), out = M(cd.out);
            var x = CFG.VERTICAL ? CFG.W / 2 + cd.side * 290 : CFG.W / 2 + cd.side * 520 - 80;
            var y = CFG.VERTICAL ? CFG.H * 0.30 : CFG.H * 0.34;
            var card = shp(master, "CARD " + (idx + 1) + " glass", [
                { k: "rect", size: [230 * U, 230 * U], r: 44 * U, fill: "#FFFFFF", fop: 12, stroke: "#FFFFFF", sw: 3 * U, sop: 45 }
            ], [x, y]);
            setSpan(card, at - 0.03, out);
            dropShadow(card, 50, 30, 10);
            var icon;
            if (cd.kind === "user") {
                icon = shp(master, "CARD " + (idx + 1) + " user icon", [
                    { k: "ellipse", size: [78 * U, 78 * U], fill: CFG.CARD_ICON, fctrl: "Card Icon", pos: [0, -34 * U] },
                    { k: "rect", size: [132 * U, 74 * U], r: 37 * U, fill: CFG.CARD_ICON, fctrl: "Card Icon", pos: [0, 52 * U] }
                ], null);
            } else {
                icon = addText(master, "CARD " + (idx + 1) + " label (swap for logo)", cd.label, Math.round((cd.label.length > 1 ? 96 : 130) * U), CFG.FONT_ACCENT, cd.color);
            }
            parentTo(icon, card, [0, 0]);
            setSpan(icon, at - 0.03, out);
            glow(icon, 28, 0.9);
            popIn(card, at, 118);
            kf(tr(card, "rot"), [[at, cd.side * 14], [at + 0.3, 0]], 70);
            popOut(card, out);
            tr(card, "pos").expression = "value + [0, Math.sin(time*2.4 + " + idx + ")*8]";
            marker(master, at, "SFX pop (card)");
        })(CARDS[i], i);
    }

    // ---- captions: one layer per word
    function parseChunk(c) {
        var raw = c.s.split(" "), lines = [[]], toks = [];
        for (var k = 0; k < raw.length; k++) {
            if (raw[k] === "|") { lines.push([]); continue; }
            var acc = raw[k].charAt(0) === "*";
            var txt = raw[k].replace(/\*/g, "");
            var tok = { text: acc ? txt.toUpperCase() : txt, accent: acc };
            lines[lines.length - 1].push(tok);
            toks.push(tok);
        }
        for (k = 0; k < toks.length; k++) toks[k].t = M(c.w[k]);
        return lines;
    }

    for (i = 0; i < CHUNKS.length; i++) {
        var c = CHUNKS[i];
        var tStart = M(c.w[0]) - 0.03;
        var tEnd = c.out ? M(c.out) : M(CHUNKS[i + 1].w[0]) - 0.03;
        var big = c.style === "big";
        var lines = parseChunk(c);
        var holder = master.layers.addNull();
        holder.name = (big ? "BIG " : "CAP ") + (i + 1) + " - " + c.s.replace(/\*/g, "").replace(/ \| /g, " ");
        tr(holder, "pos").setValue(big ? [CFG.W / 2, CFG.CAP_Y - 120 * U] : [CFG.W / 2, CFG.CAP_Y]);
        setSpan(holder, tStart, tEnd);

        var built = [], lineHeights = [], widest = 0, ln, k;
        for (ln = 0; ln < lines.length; ln++) {
            var row = [], total = 0, h = 0, gap = (big ? 34 : 22) * U;
            for (k = 0; k < lines[ln].length; k++) {
                var tk = lines[ln][k];
                var size = big ? CFG.BIG_SIZE : (tk.accent ? CFG.ACC_SIZE : CFG.CAP_SIZE);
                var font = (big || tk.accent) ? CFG.FONT_ACCENT : CFG.FONT;
                var col = big ? (c.red ? CFG.ACCENT : CFG.ACCENT_2) : (tk.accent ? CFG.ACCENT : CFG.WHITE);
                var W1 = addText(master, holder.name + " / " + tk.text, tk.text, size, font, col);
                row.push({ L: W1, tok: tk, w: textWidth(W1) });
                total += textWidth(W1);
                if (size > h) h = size;
            }
            total += gap * (row.length - 1);
            if (total > widest) widest = total;
            built.push({ row: row, total: total, gap: gap });
            lineHeights.push(h * 1.02);
        }
        var fit = widest > CFG.MAX_LINE ? CFG.MAX_LINE / widest : 1;
        var allH = 0;
        for (ln = 0; ln < lineHeights.length; ln++) allH += lineHeights[ln];
        var y = -allH / 2;
        for (ln = 0; ln < built.length; ln++) {
            var x = -built[ln].total / 2, yc = y + lineHeights[ln] / 2;
            for (k = 0; k < built[ln].row.length; k++) {
                var it = built[ln].row[k], Lw = it.L, acc = big || it.tok.accent;
                parentTo(Lw, holder, [(x + it.w / 2) * fit, yc * fit]);
                if (fit < 1) tr(Lw, "scale").setValue([fit * 100, fit * 100, 100]);
                x += it.w + built[ln].gap;
                setSpan(Lw, tStart, tEnd);
                if (acc) {
                    fillFx(Lw, big ? (c.red ? CFG.ACCENT : CFG.ACCENT_2) : CFG.ACCENT, big ? (c.red ? "Accent" : "Accent 2") : "Accent");
                    glow(Lw, big ? 55 : 30, big ? 1.4 : 1.0);
                }
                dropShadow(Lw, 85, 16, 7);
                wordPop(Lw, it.tok.t, acc);
                if (big) lightSweep(Lw, it.tok.t + 0.25, 0.5);
            }
            y += lineHeights[ln];
        }
        if (big) {
            hits.push(M(c.w[0]));
            marker(master, M(c.w[0]), "SFX impact + riser (big word)");
            // sparkles around the word
            for (k = 0; k < 12; k++) {
                var sz = (6 + rnd() * 12) * U;
                var sp = shp(master, holder.name + " sparkle " + (k + 1), [{ k: "ellipse", size: [sz, sz], fill: "#FFFFFF" }], null);
                parentTo(sp, holder, [(rnd() - 0.5) * widest * fit * 1.15, (rnd() - 0.5) * allH * 1.6]);
                setSpan(sp, tStart, tEnd);
                glow(sp, 12, 1.5);
                popIn(sp, M(c.w[0]) + 0.05 + rnd() * 0.35, 160);
                tr(sp, "op").expression = "Math.abs(Math.sin(time*7 + index))*100";
            }
        }
    }

    // ---- camera shake (adjustment on top, shakes everything, with motion blur)
    var cam = master.layers.addSolid([1, 1, 1], "CAMERA shake (adjustment)", CFG.W, CFG.H, 1);
    cam.adjustmentLayer = true;
    var amt = fx(cam, "ADBE Slider Control");
    amt.name = "Shake";
    var keys = [];
    hits.sort(function (a, b) { return a - b; });
    for (i = 0; i < hits.length; i++) {
        keys.push([hits[i] - 0.001, 0]);
        keys.push([hits[i] + 0.03, 1]);
        keys.push([hits[i] + 0.32, 0]);
    }
    kf(cam.property("ADBE Effect Parade").property("Shake").property(1), keys, 60);
    // Transform effect params by match name: -0002 Position, -0007 Rotation,
    // -0009 Use Composition's Shutter Angle, -0010 Shutter Angle.
    fx(cam, "ADBE Geometry2");
    var sh = 'var a = effect("Shake")(1) * thisComp.layer("CONTROLS").effect("Shake Amount")(1);\n';
    var tfx = function () { return cam.property("ADBE Effect Parade").property("ADBE Geometry2"); };
    try { tfx().property("ADBE Geometry2-0002").expression = sh + "value + [Math.sin(time*73)*a, Math.cos(time*61)*a*0.7];"; } catch (e) {}
    try { tfx().property("ADBE Geometry2-0007").expression = sh + "value + Math.sin(time*47)*a*0.05;"; } catch (e) {}
    try { tfx().property("ADBE Geometry2-0009").setValue(0); } catch (e) {}
    try { tfx().property("ADBE Geometry2-0010").setValue(180); } catch (e) {}
    ctrl.moveToBeginning();

    // ---- 30s comps
    function reel(name, offset) {
        var t = app.project.items.addComp(name, CFG.W, CFG.H, 1, 30, CFG.FPS);
        t.parentFolder = root;
        var Lm = t.layers.add(master);
        Lm.startTime = -offset;
        return t;
    }
    var reelA = reel("REEL_30s_A (0-00 to 0-30)", 0);
    reel("REEL_30s_B (0-10 to 0-40)", 10);

    for (i = app.project.numItems; i >= 1; i--) {
        var itm = app.project.item(i);
        if (itm instanceof FootageItem && itm.mainSource instanceof SolidSource && itm.parentFolder !== fSolids) {
            var nm = itm.name;
            if (nm.indexOf("LOOK") === 0 || nm.indexOf("CAMERA") === 0) itm.parentFolder = fSolids;
        }
    }

    try { app.project.renderQueue.items.add(reelA); } catch (e) {}
    reelA.openInViewer();
    app.endUndoGroup();

    if (!app.project.file) {
        try { app.project.save(new File(new File($.fileName).parent.fsName + "/Reel_Style_Edit.aep")); } catch (e) {}
    }
    alert("Reel-style edit built.\n\nOpen REEL_30s_A. Colours + shake strength: REEL_MASTER > CONTROLS.\n" +
          "Comp markers show where to drop SFX.");
})();
