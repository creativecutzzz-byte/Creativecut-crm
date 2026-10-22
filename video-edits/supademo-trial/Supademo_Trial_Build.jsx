/*
 * Supademo - "I Studied 1000 SaaS Demo Videos, Here's Why Most Fail"
 * Editor trial: 30-second recreation, fully editable After Effects project.
 *
 * HOW TO USE
 *   1. Put this .jsx next to "Halva Editor Trial - Raw footage.mp4" (or you will be asked to pick it).
 *   2. Install the Inter font (Inter-Bold / Inter-SemiBold) - supademo.com uses Inter.
 *   3. After Effects > File > Scripts > Run Script File... > pick this file.
 *   4. The script builds every comp, saves "Supademo_Trial_Edit.aep" next to itself (if the project
 *      was untitled) and queues the 30s trial comp in the Render Queue.
 *
 * WHAT GETS BUILT
 *   00_TRIAL_30s_A (ref 0-10 to 0-40)   <- the brief: reference video from 0:10, 30 seconds
 *   00_TRIAL_30s_B (ref 0-00 to 0-30)   <- same edit from 0:00, in case the client meant that
 *   01_MASTER                          <- the whole 0:00-0:48 edit (A-roll cuts, captions, graphics)
 *   GFX_* precomps                     <- one per graphic, all native shape/text layers
 *   CONTROLS null (in 01_MASTER)       <- brand colours; every magenta / dark fill is linked to it
 *
 * All raw-footage times below come from a word-level transcript of the raw file, so cuts and
 * captions land on the spoken words. Edit SEGMENTS / CAPTIONS to re-time anything.
 *
 * ExtendScript is ES3: no let/const, arrow functions or Array.forEach in this file.
 */
(function () {

    // ------------------------------------------------------------------ CONFIG
    var CFG = {
        W: 1920, H: 1080, FPS: 30,
        MASTER_DUR: 49.5,
        FOOTAGE_NAME: "Halva Editor Trial - Raw footage.mp4",
        FONT_BOLD: "Inter-Bold",
        FONT_SEMI: "Inter-SemiBold",
        // Sampled from the reference video + supademo.com
        MAGENTA: "#D6248F",     // number badges, highlight words
        INK: "#0C111D",         // supademo.com primary text
        INK_DOT: "#252B37",
        INDIGO: "#444CE7",      // supademo.com brand indigo
        INDIGO_LIGHT: "#818CF8",
        DARK_BG: "#18222B",     // dark panels in the reference
        DARK_EDGE: "#0B1117",
        GRID: "#ECECF1",
        WHITE: "#FFFFFF",
        CAPTION_SIZE: 62,
        CAPTION_Y: 870
    };

    // A-roll selects. rawIn/rawOut = seconds in the raw file, t = start in 01_MASTER.
    // Same takes as the reference: intro take 2 (13.6s) runs straight into take 1 of
    // "we found one thing" (30.9s); the 0.5s breath between them is cut.
    var SEGMENTS = [
        { name: "A01 We studied a thousand demos", rawIn: 13.60, rawOut: 25.62, t: 0.00,  scale: 50 },
        { name: "A02 Are product demos profitable", rawIn: 25.62, rawOut: 30.40, t: 12.02, scale: 56 },
        { name: "A03 One thing / prettiest",       rawIn: 30.92, rawOut: 42.55, t: 16.80, scale: 50 },
        { name: "A04 In fact",                     rawIn: 64.10, rawOut: 64.62, t: 28.43, scale: 57 },
        { name: "A05 Worst performing demos",      rawIn: 64.98, rawOut: 74.98, t: 28.95, scale: 52 },
        { name: "A06 So in this video",            rawIn: 74.98, rawOut: 85.10, t: 38.95, scale: 50 }
    ];
    // Face position in the 4K raw - punch-ins scale around this point.
    var FACE = [1760, 900];

    // Captions: whole-phrase captions like the reference (no caption on "In fact..." - the ref has none).
    // words = raw start time of each word (first one = caption in), out = raw time it leaves.
    // hl = [firstWord, lastWord] (0-based, inclusive) painted magenta.
    var CAPTIONS = [
        { text: "We studied a thousand product demos",
          words: [13.72, 14.28, 14.62, 14.76, 15.24, 15.64], out: 16.50, hl: [[2, 3]] },
        { text: "and we did it to answer two simple questions",
          words: [23.34, 23.60, 23.74, 23.94, 24.08, 24.24, 24.48, 24.86, 25.24], out: 25.62, hl: [[6, 8]] },
        { text: "Because the demos that convert",
          words: [36.82, 37.36, 37.62, 37.98, 38.24], out: 38.70, hl: [] },
        { text: "the best are not the prettiest",
          words: [38.76, 39.08, 39.52, 39.86, 40.18, 40.42], out: 40.88, hl: [[5, 5]] },
        { text: "or most impressive ones",
          words: [40.94, 41.34, 41.74, 42.14], out: 42.55, hl: [[1, 2]] }
    ];

    // ------------------------------------------------------------------ HELPERS
    function rgb(h) {
        h = h.replace("#", "");
        return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    }
    function rgba(h) { var c = rgb(h); c.push(1); return c; }

    // raw-file time -> 01_MASTER time
    function M(raw) {
        for (var i = SEGMENTS.length - 1; i >= 0; i--) {
            if (raw >= SEGMENTS[i].rawIn - 0.001) return SEGMENTS[i].t + (raw - SEGMENTS[i].rawIn);
        }
        return 0;
    }

    function ctrlExpr(name) { return 'comp("01_MASTER").layer("CONTROLS").effect("' + name + '")(1)'; }

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

    // keys: [[time, value], ...]  mode: "linear" or an ease influence (default 75)
    function kf(prop, keys, mode) {
        for (var i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
        if (mode !== "linear") easeAll(prop, typeof mode === "number" ? mode : 75);
        return prop;
    }

    function pop(L, t, peak) {
        peak = peak || 112;
        kf(tr(L, "scale"), [[t, [0, 0, 100]], [t + 0.17, [peak, peak, 100]], [t + 0.3, [100, 100, 100]]], 60);
    }
    function popOut(L, t) {
        kf(tr(L, "scale"), [[t, [100, 100, 100]], [t + 0.07, [108, 108, 100]], [t + 0.22, [0, 0, 100]]], 60);
    }
    function fadeIn(L, t, d) { kf(tr(L, "op"), [[t, 0], [t + (d || 0.25), 100]]); }
    function fadeOut(L, t, d) { kf(tr(L, "op"), [[t, 100], [t + (d || 0.2), 0]]); }

    function newComp(name, dur, folder) {
        var c = app.project.items.addComp(name, CFG.W, CFG.H, 1, dur, CFG.FPS);
        if (folder) c.parentFolder = folder;
        c.bgColor = [0, 0, 0];
        return c;
    }

    function setSpan(L, tIn, tOut) {
        L.inPoint = tIn;
        L.outPoint = tOut;
    }

    // ---- shapes
    function addShape(comp, name, kind, size, radius, hex, pos, ctrl) {
        var L = comp.layers.addShape();
        L.name = name;
        var root = L.property("ADBE Root Vectors Group");
        root.addProperty("ADBE Vector Group");
        var vecs = root.property(1).property("ADBE Vectors Group");
        if (kind === "ellipse") {
            vecs.addProperty("ADBE Vector Shape - Ellipse");
            vecs.property(1).property("ADBE Vector Ellipse Size").setValue(size);
        } else {
            vecs.addProperty("ADBE Vector Shape - Rect");
            vecs.property(1).property("ADBE Vector Rect Size").setValue(size);
            vecs.property(1).property("ADBE Vector Rect Roundness").setValue(radius || 0);
        }
        vecs = L.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vecs.addProperty("ADBE Vector Graphic - Fill");
        var col = vecs.property(2).property("ADBE Vector Fill Color");
        col.setValue(rgba(hex));
        if (ctrl) { try { col.expression = ctrlExpr(ctrl); } catch (e) {} }
        if (pos) tr(L, "pos").setValue(pos);
        return L;
    }
    function rectSize(L) { return L.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(1).property("ADBE Vector Rect Size"); }
    function rectRound(L) { return L.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(1).property("ADBE Vector Rect Roundness"); }

    function blur(L, amount) {
        var fx = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
        fx.property(1).setValue(amount);
        try { fx.property(3).setValue(1); } catch (e) {} // repeat edge pixels
        return fx;
    }

    function dropShadow(L, opacityPct, softness, distance) {
        try {
            var fx = L.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
            var op = fx.property("ADBE Drop Shadow-0002");
            op.setValue(op.maxValue > 100 ? opacityPct * 2.55 : opacityPct);
            fx.property("ADBE Drop Shadow-0004").setValue(distance === undefined ? 4 : distance);
            fx.property("ADBE Drop Shadow-0005").setValue(softness || 18);
        } catch (e) {}
    }

    function solid(comp, name, hex) {
        return comp.layers.addSolid(rgb(hex), name, CFG.W, CFG.H, 1);
    }

    function ellipseMask(L, grow, feather, inverted) {
        var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        var s = new Shape(), cx = CFG.W / 2, cy = CFG.H / 2, rx = CFG.W / 2 + grow, ry = CFG.H / 2 + grow, k = 0.5523;
        s.vertices = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
        s.inTangents = [[-rx * k, 0], [0, -ry * k], [rx * k, 0], [0, ry * k]];
        s.outTangents = [[rx * k, 0], [0, ry * k], [-rx * k, 0], [0, -ry * k]];
        s.closed = true;
        m.property("ADBE Mask Shape").setValue(s);
        m.property("ADBE Mask Feather").setValue([feather, feather]);
        m.inverted = inverted;
        return m;
    }

    // White "graph paper" background used by the reference's light cards.
    function lightBackground(comp) {
        solid(comp, "BG white", CFG.WHITE);
        var g = comp.layers.addShape();
        g.name = "BG grid lines";
        var spacing = 96, i, axes = [
            { n: "Vertical", size: [2, CFG.H + 40], start: [-CFG.W / 2, 0], step: [spacing, 0], copies: Math.ceil(CFG.W / spacing) + 1 },
            { n: "Horizontal", size: [CFG.W + 40, 2], start: [0, -CFG.H / 2], step: [0, spacing], copies: Math.ceil(CFG.H / spacing) + 1 }
        ];
        for (i = 0; i < axes.length; i++) {
            var root = g.property("ADBE Root Vectors Group");
            root.addProperty("ADBE Vector Group");
            var grp = root.property(root.numProperties);
            grp.name = axes[i].n;
            var v = grp.property("ADBE Vectors Group");
            v.addProperty("ADBE Vector Shape - Rect");
            v.property(1).property("ADBE Vector Rect Size").setValue(axes[i].size);
            v.property(1).property("ADBE Vector Rect Position").setValue(axes[i].start);
            v = g.property("ADBE Root Vectors Group").property(i + 1).property("ADBE Vectors Group");
            v.addProperty("ADBE Vector Graphic - Fill");
            var c = v.property(2).property("ADBE Vector Fill Color");
            c.setValue(rgba(CFG.GRID));
            try { c.expression = ctrlExpr("Grid Lines"); } catch (e) {}
            v = g.property("ADBE Root Vectors Group").property(i + 1).property("ADBE Vectors Group");
            v.addProperty("ADBE Vector Filter - Repeater");
            var rep = v.property(3);
            rep.property("ADBE Vector Repeater Copies").setValue(axes[i].copies);
            rep.property("ADBE Vector Repeater Transform").property("ADBE Vector Repeater Position").setValue(axes[i].step);
        }
        var vig = solid(comp, "BG soft edge", "#E4E4EA");
        ellipseMask(vig, 140, 520, true);
        tr(vig, "op").setValue(70);
    }

    // Dark navy panel background (Beautiful/Expensive/Useless, In this video).
    function darkBackground(comp) {
        var bg = solid(comp, "BG dark", CFG.DARK_BG);
        try {
            var fill = bg.property("ADBE Effect Parade").addProperty("ADBE Fill");
            fill.property("ADBE Fill-0002").expression = ctrlExpr("Dark BG");
        } catch (e) {}
        var vig = solid(comp, "BG dark edge", CFG.DARK_EDGE);
        ellipseMask(vig, 160, 560, true);
        tr(vig, "op").setValue(85);
    }

    // ---- text
    function addText(comp, name, str, o) {
        var L = comp.layers.addText(str);
        L.name = name;
        var sp = L.property("ADBE Text Properties").property("ADBE Text Document");
        var td = sp.value;
        try { td.resetCharStyle(); } catch (e) {}
        td.fontSize = o.size || 60;
        td.applyFill = true;
        td.fillColor = rgb(o.color || CFG.WHITE);
        td.applyStroke = false;
        try { td.font = o.font || CFG.FONT_BOLD; } catch (e2) {}
        td.justification = o.left ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.CENTER_JUSTIFY;
        if (o.track !== undefined) td.tracking = o.track;
        sp.setValue(td);
        var r = L.sourceRectAtTime(0, false);
        if (o.left) tr(L, "anchor").setValue([r.left, r.top + r.height / 2]);
        else tr(L, "anchor").setValue([r.left + r.width / 2, r.top + r.height / 2]);
        if (o.pos) tr(L, "pos").setValue(o.pos);
        return L;
    }

    // Adds a text animator with the given [matchName, value] properties and one range selector.
    // Returns the animator index so callers can re-fetch it (AE invalidates references on add).
    function textAnimator(L, name, props) {
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        anims.addProperty("ADBE Text Animator");
        var idx = anims.numProperties;
        anims.property(idx).name = name;
        for (var i = 0; i < props.length; i++) {
            var ap = L.property("ADBE Text Properties").property("ADBE Text Animators").property(idx).property("ADBE Text Animator Properties");
            ap.addProperty(props[i][0]);
            ap = L.property("ADBE Text Properties").property("ADBE Text Animators").property(idx).property("ADBE Text Animator Properties");
            var p = ap.property(props[i][0]);
            p.setValue(props[i][1]);
            if (props[i][2]) { try { p.expression = props[i][2]; } catch (e) {} }
        }
        var sels = L.property("ADBE Text Properties").property("ADBE Text Animators").property(idx).property("ADBE Text Selectors");
        if (sels.numProperties === 0) sels.addProperty("ADBE Text Selector");
        return idx;
    }
    function selector(L, idx) {
        return L.property("ADBE Text Properties").property("ADBE Text Animators").property(idx).property("ADBE Text Selectors").property(1);
    }
    // basedOn: 1 characters, 3 words. units: 1 percent, 2 index.
    function selectorMode(L, idx, basedOn, units) {
        var adv = selector(L, idx).property("ADBE Text Range Advanced");
        adv.property("ADBE Text Range Units").setValue(units);
        adv = selector(L, idx).property("ADBE Text Range Advanced");
        adv.property("ADBE Text Range Type2").setValue(basedOn);
    }

    // Word-by-word pop reveal synced to spoken word times (comp-time).
    function wordReveal(L, times) {
        var idx = textAnimator(L, "Word reveal", [
            ["ADBE Text Opacity", 0],
            ["ADBE Text Position 3D", [0, 22, 0]],
            ["ADBE Text Blur", [8, 8]]
        ]);
        selectorMode(L, idx, 3, 1);
        var start = selector(L, idx).property("ADBE Text Percent Start");
        var n = times.length, keys = [];
        for (var i = 0; i < n; i++) {
            var ramp = 0.1;
            if (i < n - 1 && times[i + 1] - times[i] < 0.12) ramp = (times[i + 1] - times[i]) * 0.8;
            keys.push([times[i], (i / n) * 100]);
            keys.push([times[i] + ramp, ((i + 1) / n) * 100]);
        }
        kf(start, keys, "linear");
    }

    // Typewriter reveal by characters between t0 and t1.
    // Whole-line caption entrance: quick rise + un-blur, the way the reference's captions land.
    function lineIn(L, t) {
        var p = tr(L, "pos").value;
        kf(tr(L, "pos"), [[t, [p[0], p[1] + 18]], [t + 0.16, p]], 85);
        kf(tr(L, "op"), [[t, 0], [t + 0.1, 100]], "linear");
        var bl = blur(L, 0);
        kf(bl.property(1), [[t, 12], [t + 0.14, 0]], "linear");
    }

    function typeOn(L, t0, t1) {
        var idx = textAnimator(L, "Type on", [["ADBE Text Opacity", 0]]);
        selectorMode(L, idx, 1, 1);
        kf(selector(L, idx).property("ADBE Text Percent Start"), [[t0, 0], [t1, 100]], "linear");
    }

    // Paint words [a..b] magenta (linked to CONTROLS > Brand Magenta).
    function highlightWords(L, a, b) {
        var idx = textAnimator(L, "Highlight " + a + "-" + b, [["ADBE Text Fill Color", rgba(CFG.MAGENTA), ctrlExpr("Brand Magenta")]]);
        selectorMode(L, idx, 3, 2);
        selector(L, idx).property("ADBE Text Index End").setValue(b + 1);
        selector(L, idx).property("ADBE Text Index Start").setValue(a);
    }

    function softGlow(comp, src, amount, opacity) {
        var g = src.duplicate();
        g.name = src.name + " glow";
        g.moveAfter(src);
        blur(g, amount);
        // follows the source's motion and fades with it
        g.parent = src;
        tr(g, "pos").setValue(tr(src, "anchor").value);
        tr(g, "scale").setValue([100, 100, 100]);
        tr(g, "rot").setValue(0);
        tr(g, "op").expression = "thisLayer.parent.transform.opacity * " + (opacity / 100);
        return g;
    }

    function marker(comp, t, label) {
        try { comp.markerProperty.setValueAtTime(t, new MarkerValue(label)); } catch (e) {}
    }

    function setTrackMatte(layer, matte) {
        try { layer.setTrackMatte(matte, TrackMatteType.ALPHA); return; } catch (e) {}
        matte.moveBefore(layer);
        layer.trackMatteType = TrackMatteType.ALPHA;
    }

    // Seeded random so dot layouts are identical every build.
    var seed = 7;
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

    app.beginUndoGroup("Build Supademo trial edit");

    var root = app.project.items.addFolder("SUPADEMO TRIAL");
    var fFoot = app.project.items.addFolder("01 Footage"); fFoot.parentFolder = root;
    var fGfx = app.project.items.addFolder("02 GFX precomps"); fGfx.parentFolder = root;
    var fSolids = app.project.items.addFolder("03 Solids"); fSolids.parentFolder = root;

    var footage = app.project.importFile(new ImportOptions(footFile));
    footage.parentFolder = fFoot;
    try { footage.mainSource.conformFrameRate = CFG.FPS; } catch (e) {}

    var master = newComp("01_MASTER", CFG.MASTER_DUR, root);

    // ---- A-roll
    var i, seg, L;
    for (i = 0; i < SEGMENTS.length; i++) {
        seg = SEGMENTS[i];
        L = master.layers.add(footage);
        L.name = seg.name;
        L.startTime = seg.t - seg.rawIn;
        setSpan(L, seg.t, seg.t + (seg.rawOut - seg.rawIn));
        tr(L, "anchor").setValue(FACE);
        tr(L, "pos").setValue([FACE[0] / 2, FACE[1] / 2]);   // framing identical to 50% centred
        tr(L, "scale").setValue([seg.scale, seg.scale, 100]);
        // 2-frame audio fades so the jump cuts don't click
        try {
            var lv = L.property("ADBE Audio Group").property("ADBE Audio Levels");
            var tin = L.inPoint, tout = L.outPoint;
            kf(lv, [[tin, [-30, -30]], [tin + 0.06, [0, 0]], [tout - 0.06, [0, 0]], [tout, [-30, -30]]], "linear");
        } catch (e) {}
    }

    // ---- look: subtle warm grade + vignette (affects A-roll only - sits under all graphics)
    var vig = master.layers.addSolid([0, 0, 0], "LOOK vignette", CFG.W, CFG.H, 1);
    ellipseMask(vig, 220, 620, true);
    tr(vig, "op").setValue(45);
    var grade = master.layers.addSolid([1, 1, 1], "LOOK grade (adjustment)", CFG.W, CFG.H, 1);
    grade.adjustmentLayer = true;
    try {
        var ex = grade.property("ADBE Effect Parade").addProperty("ADBE Exposure2");
        ex.property("Exposure").setValue(-0.15);
    } catch (e) {}
    try {
        var pf = grade.property("ADBE Effect Parade").addProperty("ADBE Photo Filter");
        pf.property(3).setValue(12);   // density - warming filter is the default
    } catch (e) {}
    try { grade.property("ADBE Effect Parade").addProperty("ADBE Lumetri"); } catch (e) {}

    // ---- CONTROLS (must exist before any linked expression is written)
    var ctrl = master.layers.addNull();
    ctrl.name = "CONTROLS";
    ctrl.enabled = false;
    var colors = [["Brand Magenta", CFG.MAGENTA], ["Dark BG", CFG.DARK_BG], ["Grid Lines", CFG.GRID]];
    for (i = 0; i < colors.length; i++) {
        var cc = ctrl.property("ADBE Effect Parade").addProperty("ADBE Color Control");
        cc.name = colors[i][0];
        cc.property(1).setValue(rgba(colors[i][1]));
    }

    // Card frame: the A-roll pulls in to a rounded card on navy just before the dark panel
    // (reference 0:29-0:31). Built as a fat dark stroke around a rounded rect, so the footage
    // itself is untouched. Inner radius = roundness - stroke/2.
    function cardFrame(tIn, tOut, inset, radius) {
        var sw = 300;
        var F = addShape(master, "CARD FRAME (A-roll inset)", "rect", [CFG.W + sw, CFG.H + sw], sw / 2, CFG.DARK_BG, [960, 540], null);
        var vecs = F.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        vecs.property(2).enabled = false;                   // no fill - the stroke does the work
        vecs.addProperty("ADBE Vector Graphic - Stroke");
        vecs = F.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        var st = vecs.property(3);
        st.property("ADBE Vector Stroke Width").setValue(sw);
        st.property("ADBE Vector Stroke Color").setValue(rgba(CFG.DARK_BG));
        try { st.property("ADBE Vector Stroke Color").expression = ctrlExpr("Dark BG"); } catch (e) {}
        var inner = [CFG.W - 2 * inset + sw, CFG.H - 2 * inset + sw];
        kf(rectSize(F), [[tIn, [CFG.W + sw, CFG.H + sw]], [tIn + 0.45, inner]], 85);
        kf(rectRound(F), [[tIn, sw / 2], [tIn + 0.45, sw / 2 + radius]], 85);
        setSpan(F, tIn, tOut);
        return F;
    }

    function placeGfx(comp, tIn, tOut, inAnim) {
        var G = master.layers.add(comp);
        G.startTime = tIn;
        setSpan(G, tIn, tOut);
        if (inAnim) {
            kf(tr(G, "scale"), [[tIn, [108, 108, 100]], [tIn + 0.3, [100, 100, 100]]], 80);
            fadeIn(G, tIn, 0.15);
            kf(tr(G, "op"), [[tOut - 0.12, 100], [tOut, 0]]);
        }
        return G;
    }

    // =============================================================== GFX 01
    // "We studied a thousand demos ... Beehive, Lightspeed, Lovable ... tiny bootstrap tools"
    // White grid card, headline, dots that pop into logos on each company name.
    (function () {
        var t0 = M(16.54), t1 = M(23.34);                 // "biggest SaaS companies" -> "and we did it"
        var c = newComp("GFX_01_StudiedLogos", t1 - t0 + 0.5, fGfx);
        lightBackground(c);
        var cam = c.layers.addNull(); cam.name = "CAM (drift)";
        tr(cam, "pos").setValue([960, 540]);

        var head = addText(c, "Headline", "We studied 1,000+ SaaS product demos", { size: 74, color: CFG.INK, pos: [960, 170], track: -10 });
        head.parent = cam;
        highlightWords(head, 2, 2);
        wordReveal(head, [0.05, 0.13, 0.21, 0.29, 0.37, 0.45]);

        var rows = [
            { y: 340, xs: [260, 596, 924, 1098, 1436, 1660] },
            { y: 512, xs: [426, 766, 930, 1266, 1520] },
            { y: 684, xs: [250, 594, 1096, 1350, 1600] }
        ];
        var r, j, d, n = 0;
        for (r = 0; r < rows.length; r++) {
            for (j = 0; j < rows[r].xs.length; j++) {
                var indigo = rnd() < 0.3;
                d = addShape(c, "Dot " + (++n), "ellipse", [16, 16], 0, indigo ? CFG.INDIGO_LIGHT : CFG.INK_DOT, [rows[r].xs[j], rows[r].y]);
                d.parent = cam;
                pop(d, 0.15 + rnd() * 0.9, 160);
                tr(d, "pos").expression = "value + [0, Math.sin(time*1.6 + index)*4]";
            }
        }
        // Logos - placeholders: drop the real Beehiiv / Lightspeed / Lovable PNGs in and
        // Alt-drag (Option-drag) them onto these layers to keep the animation.
        var logos = [
            { n: "LOGO Beehiiv (replace)", l: "B", at: M(17.84), pos: [1436, 340] },
            { n: "LOGO Lightspeed (replace)", l: "LS", at: M(18.74), pos: [594, 684] },
            { n: "LOGO Lovable (replace)", l: "LV", at: M(19.44), pos: [1266, 512] }
        ];
        for (j = 0; j < logos.length; j++) {
            var lg = addShape(c, logos[j].n, "ellipse", [132, 132], 0, CFG.INDIGO, logos[j].pos, null);
            lg.parent = cam;
            softGlow(c, lg, 30, 60);
            var lt = addText(c, logos[j].n + " mark", logos[j].l, { size: 64, color: CFG.WHITE, pos: [0, 0] });
            lt.parent = lg; tr(lt, "pos").setValue([0, 0]);
            var a = logos[j].at - t0;
            var next = j < logos.length - 1 ? logos[j + 1].at - t0 : null;
            if (next) {
                kf(tr(lg, "scale"), [[a, [0, 0, 100]], [a + 0.17, [115, 115, 100]], [a + 0.3, [100, 100, 100]],
                                     [next, [100, 100, 100]], [next + 0.2, [14, 14, 100]]], 60);
            } else {
                pop(lg, a, 115);
            }
            marker(master, logos[j].at, "SFX pop");
        }
        // "all the way down to tiny bootstrap tools" - swarm of small dots
        var swarmAt = M(20.96) - t0;
        for (j = 0; j < 34; j++) {
            d = addShape(c, "Tiny dot " + (j + 1), "ellipse", [9, 9], 0, rnd() < 0.25 ? CFG.INDIGO_LIGHT : "#9AA0AC",
                         [180 + rnd() * 1560, 780 + rnd() * 240]);
            d.parent = cam;
            pop(d, swarmAt + rnd() * 1.1, 170);
        }
        kf(tr(cam, "scale"), [[0, [100, 100, 100]], [c.duration, [106, 106, 100]]], 30);
        kf(tr(cam, "pos"), [[0, [960, 540]], [c.duration, [960, 500]]], 30);

        placeGfx(c, t0, t1, true);
        marker(master, t0, "SFX whoosh in");
    })();

    // =============================================================== GFX 02
    // "two simple questions" - magenta "1" and "?" badges over the A-roll,
    // question typed bottom-left; "1" flips to "2" on the second question.
    (function () {
        var t0 = M(24.48), t1 = M(30.40);
        var c = newComp("GFX_02_QuestionBadges", t1 - t0, fGfx);

        function badge(name, label, pos, size, tPop) {
            var b = addShape(c, name, "rect", [size, size], 30, CFG.MAGENTA, pos, "Brand Magenta");
            softGlow(c, b, 45, 70);
            var t = addText(c, name + " label", label, { size: size * 0.62, color: CFG.WHITE, pos: [0, 0] });
            t.parent = b; tr(t, "pos").setValue([0, 0]);
            kf(tr(b, "rot"), [[tPop, -10], [tPop + 0.35, 0]]);
            pop(b, tPop, 116);
            tr(b, "pos").expression = "value + [0, Math.sin(time*2.1 + index)*6]";
            return { box: b, label: t };
        }
        var left = badge("Badge 1", "1", [330, 537], 266, 0.0);
        var right = badge("Badge ?", "?", [1590, 537], 266, 0.22);
        marker(master, t0, "SFX pop"); marker(master, t0 + 0.22, "SFX pop");

        var flip = M(28.56) - t0;
        var sp = left.label.property("ADBE Text Properties").property("ADBE Text Document");
        var td = sp.value;
        sp.setValueAtTime(0, td);
        td.text = "2";
        sp.setValueAtTime(flip, td);
        kf(tr(left.box, "scale"), [[flip - 0.01, [100, 100, 100]], [flip + 0.1, [118, 118, 100]], [flip + 0.28, [100, 100, 100]]], 60);
        marker(master, t0 + flip, "SFX tick");

        var q1 = addText(c, "Question 1 (type-on)", "Are product demos really that profitable?", { size: 46, color: CFG.WHITE, left: true, pos: [140, 950], font: CFG.FONT_SEMI });
        typeOn(q1, M(25.66) - t0, M(27.98) - t0);
        setSpan(q1, 0, flip - 0.05);
        dropShadow(q1, 55, 20);
        var q2 = addText(c, "Question 2 (type-on)", "Do they need to be a video?", { size: 46, color: CFG.WHITE, left: true, pos: [140, 950], font: CFG.FONT_SEMI });
        typeOn(q2, flip, M(30.34) - t0);
        setSpan(q2, flip - 0.05, c.duration);
        dropShadow(q2, 55, 20);

        var end = c.duration - 0.25;
        popOut(left.box, end); popOut(right.box, end - 0.05);
        placeGfx(c, t0, t1, false);
    })();

    // =============================================================== GFX 03
    // "we actually found ONE thing" - full-screen white grid, big magenta "1".
    (function () {
        var t0 = M(31.14), t1 = M(36.76);                 // "we actually found" -> "because"
        var c = newComp("GFX_03_OneThing", t1 - t0, fGfx);
        lightBackground(c);
        var at = M(31.92) - t0;                            // "one"
        var b = addShape(c, "Card 1", "rect", [424, 330], 26, CFG.MAGENTA, [962, 531], "Brand Magenta");
        softGlow(c, b, 50, 75);
        var t = addText(c, "Card 1 label", "1", { size: 215, color: CFG.WHITE, pos: [0, 0] });
        t.parent = b; tr(t, "pos").setValue([0, 0]);
        pop(b, at, 112);
        kf(tr(b, "rot"), [[at, 8], [at + 0.4, 0]]);
        // slow push for life
        tr(b, "scale").expression = "var s = (time > " + (at + 0.3).toFixed(2) + ") ? (time - " + (at + 0.3).toFixed(2) + ")*2.2 : 0; value + [s, s, 0]";
        var sub = addText(c, "Subtitle (optional - off to match ref)", "that goes against what most founders believe",
                          { size: 44, color: CFG.INK, pos: [960, 800], font: CFG.FONT_SEMI });
        wordReveal(sub, [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]);
        sub.enabled = false;
        placeGfx(c, t0, t1, true);
        marker(master, t0, "SFX whoosh in"); marker(master, t0 + at, "SFX pop (big)");
    })();

    cardFrame(M(65.26), M(67.52), 20, 26);   // "...of the worst performing" -> dark panel
    marker(master, M(65.26), "SFX soft whoosh (card pull-in)");

    // =============================================================== GFX 04
    // "were beautiful, expensive, and completely useless" - dark panel with a demo UI mock.
    (function () {
        var t0 = M(67.52), t1 = M(74.98);
        var c = newComp("GFX_04_BeautifulExpensiveUseless", t1 - t0, fGfx);
        darkBackground(c);

        // UI mock (stand-in for a real Supademo gallery screenshot - replace via Alt-drag)
        var ui = newComp("UI_Mock_REPLACE_with_screenshot", t1 - t0, fGfx);
        ui.width = 780; ui.height = 440;
        addShape(ui, "Window", "rect", [780, 440], 18, "#F6F6F8", [390, 220]);
        addShape(ui, "Top bar line", "rect", [700, 4], 2, "#E2E3E8", [390, 46]);
        var tiles = [["#FFFFFF", 0], ["#111418", 1], ["#FFFFFF", 0], ["#FFFFFF", 0],
                     ["#FFFFFF", 0], ["#1D2127", 1], ["#FFFFFF", 0], ["#F2F2F4", 0]];
        var k;
        for (k = 0; k < tiles.length; k++) {
            var col = k % 4, row = Math.floor(k / 4);
            var tl = addShape(ui, "Tile " + (k + 1), "rect", [168, 160], 8, tiles[k][0], [118 + col * 182, 158 + row * 176]);
            dropShadow(tl, 12, 10, 2);
            addShape(ui, "Tile " + (k + 1) + " line", "rect", [110, 8], 4, tiles[k][1] ? "#3A3F47" : "#DADCE2", [118 + col * 182, 128 + row * 176]);
            addShape(ui, "Tile " + (k + 1) + " line 2", "rect", [76, 8], 4, tiles[k][1] ? "#3A3F47" : "#E6E7EB", [100 + col * 182, 146 + row * 176]);
        }
        addShape(ui, "Accent red", "rect", [34, 34], 6, "#E5484D", [668, 386]);
        addShape(ui, "Accent green", "rect", [34, 34], 6, "#30A46C", [708, 386]);
        addShape(ui, "Accent pink", "rect", [34, 34], 6, "#F4A7C0", [708, 346]);

        var U = c.layers.add(ui);
        U.name = "UI mock";
        tr(U, "pos").setValue([964, 292]);
        kf(tr(U, "pos"), [[0, [964, 352]], [0.45, [964, 292]]], 85);
        fadeIn(U, 0, 0.3);
        dropShadow(U, 45, 40, 10);

        var words = [["Beautiful", 600, 67.96], ["Expensive", 972, 69.12], ["Useless", 1320, 70.82]];
        for (k = 0; k < words.length; k++) {
            var w = addText(c, "Word " + words[k][0], words[k][0], { size: 46, color: CFG.WHITE, pos: [words[k][1], 615] });
            var at = M(words[k][2]) - t0;
            fadeIn(w, at, 0.18);
            kf(tr(w, "pos"), [[at, [words[k][1], 640]], [at + 0.3, [words[k][1], 615]]], 85);
            var bl = blur(w, 0);
            kf(bl.property(1), [[at, 18], [at + 0.25, 0]]);
            marker(master, t0 + at, "SFX click");
        }
        // "completely useless" - the mock dims slightly to sell the point
        var useless = M(70.82) - t0;
        kf(tr(U, "op"), [[useless, 100], [useless + 0.4, 60]]);
        placeGfx(c, t0, t1, true);
        marker(master, t0, "SFX whoosh in");
    })();

    // =============================================================== GFX 05
    // "So in this video, I'm going to show you seven things..." - chapter list + presenter PiP.
    (function () {
        var t0 = M(74.98), t1 = M(80.96);                 // until "backed by data"
        var c = newComp("GFX_05_InThisVideo", t1 - t0, fGfx);
        darkBackground(c);
        var dur = c.duration;

        var title = addText(c, "Title", "In this video", { size: 72, color: CFG.WHITE, left: true, pos: [160, 150], font: CFG.FONT_SEMI });
        softGlow(c, title, 28, 55);
        fadeIn(title, 0.15, 0.3);
        kf(tr(title, "pos"), [[0.15, [130, 150]], [0.5, [160, 150]]], 85);

        // Items 1-3 named in the reference; 4-7 are blurred out there - rename freely.
        var items = ["Watched vs. Used", "The Pattern", "Demo Length", "Interactivity", "Personalisation", "Placement", "Measurement"];
        var ops = [100, 100, 72, 45, 28, 16, 8], blurs = [0, 1, 5, 10, 16, 22, 28];
        for (var k = 0; k < items.length; k++) {
            var x = 290 + 12 * k * k, y = 310 + 104 * k, at = 0.55 + k * 0.16;
            var holder = c.layers.addNull(); holder.name = "ITEM " + (k + 1);
            tr(holder, "pos").setValue([x, y]);
            var dot = addShape(c, "Item " + (k + 1) + " circle", "ellipse", [50, 50], 0, CFG.MAGENTA, [0, 0], "Brand Magenta");
            dot.parent = holder; tr(dot, "pos").setValue([50, 50]);   // null anchor is [50,50]
            var num = addText(c, "Item " + (k + 1) + " number", String(k + 1), { size: 28, color: CFG.WHITE, pos: [0, 0] });
            num.parent = holder; tr(num, "pos").setValue([50, 50]);
            var lab = addText(c, "Item " + (k + 1) + " label", items[k], { size: 36, color: CFG.WHITE, left: true, pos: [0, 0], font: CFG.FONT_SEMI });
            lab.parent = holder; tr(lab, "pos").setValue([108, 50]);
            if (blurs[k] > 0) { blur(dot, blurs[k]); blur(num, blurs[k]); blur(lab, blurs[k]); }
            kf(tr(holder, "pos"), [[at, [x - 70, y]], [at + 0.4, [x, y]]], 85);
            var layersK = [dot, num, lab];
            for (var q = 0; q < layersK.length; q++) {
                kf(tr(layersK[q], "op"), [[at, 0], [at + 0.3, ops[k]]]);
            }
            // whole list drifts up slowly, like the reference's scrolling list
            tr(holder, "pos").expression = "value - [0, Math.max(0, time - " + at.toFixed(2) + ")*7]";
        }
        marker(master, t0 + 0.55, "SFX list ticks");

        // PiP - the A-roll shrinks from full-frame into a rounded card on the right.
        var pip = c.layers.add(footage);
        pip.name = "PiP presenter";
        pip.startTime = -SEGMENTS[5].rawIn;
        pip.audioEnabled = false;
        var matte = addShape(c, "PiP matte", "rect", [1920, 1080], 0, CFG.WHITE, [960, 540]);
        var inA = 0.0, inB = 0.55, outA = dur - 0.5, outB = dur;
        kf(tr(pip, "scale"), [[inA, [50, 50, 100]], [inB, [26.5, 26.5, 100]], [outA, [26.5, 26.5, 100]], [outB, [50, 50, 100]]], 85);
        kf(tr(pip, "pos"), [[inA, [960, 540]], [inB, [1364, 540]], [outA, [1364, 540]], [outB, [960, 540]]], 85);
        kf(rectSize(matte), [[inA, [1920, 1080]], [inB, [1000, 540]], [outA, [1000, 540]], [outB, [1920, 1080]]], 85);
        kf(tr(matte, "pos"), [[inA, [960, 540]], [inB, [1364, 540]], [outA, [1364, 540]], [outB, [960, 540]]], 85);
        kf(rectRound(matte), [[inA, 0], [inB, 20], [outA, 20], [outB, 0]], 85);
        setTrackMatte(pip, matte);
        // list + title fade out as the PiP grows back
        kf(tr(title, "op"), [[outA, 100], [outB - 0.15, 0]]);

        placeGfx(c, t0, t1, false);
        marker(master, t0, "SFX whoosh (shrink to PiP)");
        marker(master, t1 - 0.5, "SFX whoosh (back to full)");
    })();

    // =============================================================== GFX 06
    // "backed by data from over 200,000 companies" - counting number over the A-roll.
    (function () {
        var t0 = M(82.38), t1 = M(85.10);
        var c = newComp("GFX_06_200k", t1 - t0, fGfx);
        var num = addText(c, "Number (count-up)", "+200,000", { size: 124, color: CFG.MAGENTA, pos: [923, 800] });
        var sl = num.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        sl.name = "Count";
        kf(num.property("ADBE Effect Parade").property("Count").property(1), [[0, 0], [0.75, 200000]], 85);
        num.property("ADBE Text Properties").property("ADBE Text Document").expression =
            'var v = Math.round(effect("Count")(1));\n' +
            '"+" + v.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");';
        softGlow(c, num, 30, 60);
        pop(num, 0, 108);
        var lab = addText(c, "Companies", "Companies", { size: 54, color: CFG.WHITE, left: true, pos: [560, 896] });
        dropShadow(lab, 60, 20);
        fadeIn(lab, 0.25, 0.25);
        kf(tr(lab, "pos"), [[0.25, [560, 930]], [0.55, [560, 896]]], 85);
        placeGfx(c, t0, t1, false);
        marker(master, t0, "SFX riser + ding");
    })();

    // ---- captions (added last, so they sit above every graphic)
    for (i = 0; i < CAPTIONS.length; i++) {
        var cp = CAPTIONS[i];
        var times = [];
        for (var w = 0; w < cp.words.length; w++) times.push(M(cp.words[w]));
        var cap = addText(master, "CAP " + (i + 1) + " - " + cp.text, cp.text, { size: CFG.CAPTION_SIZE, color: CFG.WHITE, pos: [960, CFG.CAPTION_Y] });
        setSpan(cap, times[0] - 0.04, M(cp.out));
        dropShadow(cap, 65, 22, 3);
        for (var h = 0; h < cp.hl.length; h++) highlightWords(cap, cp.hl[h][0], cp.hl[h][1]);
        lineIn(cap, times[0] - 0.04);
    }
    ctrl.moveToBeginning();

    // ---- trial comps
    function trialComp(name, offset) {
        var t = newComp(name, 30, root);
        var Lm = t.layers.add(master);
        Lm.startTime = -offset;
        return t;
    }
    var trialA = trialComp("00_TRIAL_30s_A (ref 0-10 to 0-40)", 10);
    trialComp("00_TRIAL_30s_B (ref 0-00 to 0-30)", 0);

    // Housekeeping: solids into their folder.
    for (i = app.project.numItems; i >= 1; i--) {
        var it = app.project.item(i);
        if (it instanceof FootageItem && it.mainSource instanceof SolidSource) it.parentFolder = fSolids;
    }

    try { app.project.renderQueue.items.add(trialA); } catch (e) {}
    trialA.openInViewer();
    app.endUndoGroup();

    if (!app.project.file) {
        var out = new File(new File($.fileName).parent.fsName + "/Supademo_Trial_Edit.aep");
        try { app.project.save(out); } catch (e) {}
    }
    alert("Supademo trial built.\n\nOpen 00_TRIAL_30s_A for the 30-second edit, 01_MASTER for the full timeline.\n" +
          "Comp markers in 01_MASTER show where to drop SFX.");
})();
