// HTML to Figma — plugin main thread.
// Receives the JSON produced by src/capture.js (from the plugin UI or the CLI)
// and builds editable Figma layers from it.
// Plain ES2017 on purpose: no build step needed to load the plugin.

figma.showUI(__html__, { width: 440, height: 640, themeColors: true });

var WEIGHT_STYLES = {
  100: ['Thin', 'Hairline'],
  200: ['ExtraLight', 'Extra Light', 'UltraLight', 'Ultra Light'],
  300: ['Light'],
  400: ['Regular', 'Normal', 'Book', 'Roman'],
  500: ['Medium'],
  600: ['SemiBold', 'Semi Bold', 'DemiBold', 'Demi Bold'],
  700: ['Bold'],
  800: ['ExtraBold', 'Extra Bold', 'UltraBold', 'Ultra Bold'],
  900: ['Black', 'Heavy'],
};

// CSS generic / system families -> fonts that usually exist in Figma.
var GENERIC_FAMILIES = {
  'sans-serif': ['Inter', 'Roboto', 'Arial'],
  'system-ui': ['Inter', 'SF Pro Text', 'Roboto'],
  '-apple-system': ['SF Pro Text', 'Inter'],
  blinkmacsystemfont: ['SF Pro Text', 'Inter'],
  'ui-sans-serif': ['Inter'],
  'segoe ui': ['Segoe UI', 'Inter'],
  'helvetica neue': ['Helvetica Neue', 'Inter'],
  helvetica: ['Helvetica', 'Arial', 'Inter'],
  arial: ['Arial', 'Inter'],
  serif: ['Times New Roman', 'Georgia', 'Noto Serif', 'Roboto Serif', 'Inter'],
  'ui-serif': ['Georgia', 'Noto Serif', 'Inter'],
  monospace: ['Roboto Mono', 'Source Code Pro', 'JetBrains Mono', 'Courier New', 'Inter'],
  'ui-monospace': ['SF Mono', 'Roboto Mono', 'Source Code Pro', 'Inter'],
};

var fontIndex = null;
var fontCache = {};

function getFontIndex() {
  if (fontIndex) return Promise.resolve(fontIndex);
  return figma.listAvailableFontsAsync().then(function (list) {
    fontIndex = {};
    list.forEach(function (f) {
      var key = f.fontName.family.toLowerCase();
      if (!fontIndex[key]) fontIndex[key] = { family: f.fontName.family, styles: [] };
      fontIndex[key].styles.push(f.fontName.style);
    });
    return fontIndex;
  });
}

function normStyle(s) {
  return s.toLowerCase().replace(/[\s_-]/g, '');
}

function pickStyle(styles, weight, italic) {
  var available = {};
  styles.forEach(function (s) { available[normStyle(s)] = s; });
  var w = Math.min(900, Math.max(100, Math.round((weight || 400) / 100) * 100));
  var order = [100, 200, 300, 400, 500, 600, 700, 800, 900].sort(function (a, b) {
    var d = Math.abs(a - w) - Math.abs(b - w);
    if (d !== 0) return d;
    return w >= 500 ? b - a : a - b;
  });
  function find(wantItalic) {
    for (var i = 0; i < order.length; i++) {
      var names = WEIGHT_STYLES[order[i]];
      for (var j = 0; j < names.length; j++) {
        var candidates = wantItalic
          ? (order[i] === 400 ? ['Italic', names[j] + ' Italic'] : [names[j] + ' Italic', names[j] + 'Italic'])
          : [names[j]];
        for (var k = 0; k < candidates.length; k++) {
          var hit = available[normStyle(candidates[k])];
          if (hit) return hit;
        }
      }
    }
    return null;
  }
  return (italic && find(true)) || find(false) || styles[0];
}

function splitFamilies(css) {
  return String(css || '')
    .split(',')
    .map(function (s) { return s.trim().replace(/^['"]|['"]$/g, ''); })
    .filter(Boolean);
}

function resolveFont(familyCss, weight, italic, ctx) {
  var key = familyCss + '|' + weight + '|' + italic;
  if (fontCache[key]) return fontCache[key];
  fontCache[key] = getFontIndex().then(function (index) {
    var families = splitFamilies(familyCss);
    var entry = null;
    for (var i = 0; i < families.length && !entry; i++) {
      var k = families[i].toLowerCase();
      if (index[k]) { entry = index[k]; break; }
      var generic = GENERIC_FAMILIES[k] || [];
      for (var j = 0; j < generic.length; j++) {
        if (index[generic[j].toLowerCase()]) { entry = index[generic[j].toLowerCase()]; break; }
      }
    }
    if (!entry) entry = index.inter || { family: 'Inter', styles: ['Regular'] };
    if (families.length && entry.family.toLowerCase() !== families[0].toLowerCase()) {
      ctx.substitutedFonts[families[0]] = entry.family;
    }
    var fontName = { family: entry.family, style: pickStyle(entry.styles, weight, italic) };
    return figma.loadFontAsync(fontName).then(
      function () { return fontName; },
      function () {
        var fallback = { family: 'Inter', style: 'Regular' };
        return figma.loadFontAsync(fallback).then(function () { return fallback; });
      }
    );
  });
  return fontCache[key];
}

// ---------- paints ----------

var PLACEHOLDER = { type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.87 }, opacity: 1 };

function resolvePaints(paints, ctx) {
  return (paints || [])
    .map(function (p) {
      if (p.type === 'IMAGE') {
        var hash = ctx.imageHashes[p.imageRef];
        if (!hash) return PLACEHOLDER;
        return { type: 'IMAGE', scaleMode: p.scaleMode || 'FILL', imageHash: hash };
      }
      if (p.type === 'SOLID') {
        return { type: 'SOLID', color: p.color, opacity: p.opacity == null ? 1 : p.opacity };
      }
      if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL') {
        return { type: p.type, gradientTransform: p.gradientTransform, gradientStops: p.gradientStops };
      }
      return null;
    })
    .filter(Boolean);
}

function prepareImages(images, ctx) {
  Object.keys(images || {}).forEach(function (id) {
    var img = images[id];
    if (!img.base64) return;
    try {
      ctx.imageHashes[id] = figma.createImage(figma.base64Decode(img.base64)).hash;
    } catch (e) {
      ctx.warnings.push('Imagen no soportada: ' + (img.url || id).slice(0, 80));
    }
  });
}

// ---------- nodes ----------

function applyFrame(frame, d, ctx) {
  frame.name = d.name || 'Frame';
  frame.resize(Math.max(d.width, 0.01), Math.max(d.height, 0.01));
  frame.fills = resolvePaints(d.fills, ctx);
  if (d.strokes && d.strokes.length) {
    frame.strokes = resolvePaints(d.strokes, ctx);
    frame.strokeAlign = 'INSIDE';
    var w = d.strokeWeights || { top: 1, right: 1, bottom: 1, left: 1 };
    if (w.top === w.right && w.top === w.bottom && w.top === w.left) {
      frame.strokeWeight = w.top;
    } else {
      frame.strokeTopWeight = w.top;
      frame.strokeRightWeight = w.right;
      frame.strokeBottomWeight = w.bottom;
      frame.strokeLeftWeight = w.left;
    }
    if (d.dashed) {
      var unit = Math.max(w.top, w.right, w.bottom, w.left, 1);
      frame.dashPattern = d.dashed === 'dotted' ? [unit, unit] : [unit * 3, unit * 2];
    }
  } else {
    frame.strokes = [];
  }
  var c = d.cornerRadius;
  if (c) {
    if (c.tl === c.tr && c.tl === c.br && c.tl === c.bl) {
      frame.cornerRadius = c.tl;
    } else {
      frame.topLeftRadius = c.tl;
      frame.topRightRadius = c.tr;
      frame.bottomRightRadius = c.br;
      frame.bottomLeftRadius = c.bl;
    }
  }
  if (d.effects && d.effects.length) {
    try {
      frame.effects = d.effects;
    } catch (e) {
      ctx.warnings.push('Efecto no aplicado en ' + frame.name);
    }
  }
  if (d.opacity != null && d.opacity < 1) frame.opacity = d.opacity;
  frame.clipsContent = !!d.clipsContent;
}

var ALIGN = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED' };

function buildText(d, ctx) {
  var s = d.style || {};
  return resolveFont(s.fontFamily, s.fontWeight, s.italic, ctx).then(function (font) {
    var t = figma.createText();
    t.fontName = font;
    t.characters = d.characters;
    t.fontSize = Math.max(1, s.fontSize || 16);
    t.name = d.name || d.characters.slice(0, 40);
    if (s.color) t.fills = [{ type: 'SOLID', color: { r: s.color.r, g: s.color.g, b: s.color.b }, opacity: s.color.a }];
    t.lineHeight = s.lineHeight ? { value: s.lineHeight, unit: 'PIXELS' } : { unit: 'AUTO' };
    if (s.letterSpacing) t.letterSpacing = { value: s.letterSpacing, unit: 'PIXELS' };
    if (s.textCase && s.textCase !== 'ORIGINAL') t.textCase = s.textCase;
    if (s.textDecoration && s.textDecoration !== 'NONE') t.textDecoration = s.textDecoration;
    var multiline = d.lines > 1 || d.clipWidth || d.characters.indexOf('\n') !== -1;
    if (multiline) {
      // resize() first: it can reset textAutoResize, then let the height follow the content.
      t.resize(Math.max(1, d.width + 1), Math.max(1, t.height));
      t.textAutoResize = 'HEIGHT';
      t.textAlignHorizontal = ALIGN[s.textAlign] || 'LEFT';
    } else {
      t.textAutoResize = 'WIDTH_AND_HEIGHT';
    }
    return t;
  });
}

function buildSvg(d, ctx) {
  try {
    var node = figma.createNodeFromSvg(d.svg);
    node.name = d.name || 'svg';
    if (d.opacity != null && d.opacity < 1) node.opacity = d.opacity;
    return node;
  } catch (e) {
    ctx.warnings.push('SVG no convertido: ' + (d.name || 'svg'));
    var f = figma.createFrame();
    f.name = (d.name || 'svg') + ' (no convertido)';
    f.resize(Math.max(d.width, 0.01), Math.max(d.height, 0.01));
    f.fills = [];
    return f;
  }
}

function position(node, d, parentAbs) {
  var x = d.x - parentAbs.x;
  var y = d.y - parentAbs.y;
  if (d.type === 'TEXT') {
    // Keep the text visually where the browser drew it, even if the font metrics differ.
    var align = (d.style && d.style.textAlign) || 'left';
    if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
      if (align === 'center') x += (d.width - node.width) / 2;
      else if (align === 'right') x += d.width - node.width;
    }
    y += (d.height - node.height) / 2;
  }
  node.x = Math.round(x * 100) / 100;
  node.y = Math.round(y * 100) / 100;
}

function buildNode(d, parent, parentAbs, ctx) {
  var made;
  if (d.type === 'TEXT') made = buildText(d, ctx);
  else if (d.type === 'SVG') made = Promise.resolve(buildSvg(d, ctx));
  else {
    var frame = figma.createFrame();
    applyFrame(frame, d, ctx);
    made = Promise.resolve(frame);
  }
  return made.then(function (node) {
    parent.appendChild(node);
    position(node, d, parentAbs);
    ctx.count++;
    if (ctx.count % 250 === 0) figma.ui.postMessage({ type: 'progress', count: ctx.count, total: ctx.total });
    if (d.type !== 'FRAME' || !d.children || !d.children.length) return;
    return buildChildren(d.children, node, { x: d.x, y: d.y }, ctx);
  });
}

function buildChildren(children, parent, abs, ctx) {
  // Sequential so layer order matches paint order.
  return children.reduce(function (p, child) {
    return p.then(function () {
      return buildNode(child, parent, abs, ctx).catch(function (e) {
        ctx.warnings.push('Capa omitida (' + (child.name || child.type) + '): ' + e.message);
      });
    });
  }, Promise.resolve());
}

function countNodes(d) {
  var n = 1;
  (d.children || []).forEach(function (c) { n += countNodes(c); });
  return n;
}

function placeNewRoot(root) {
  var maxX = null;
  var minY = 0;
  figma.currentPage.children.forEach(function (n) {
    if (n === root) return;
    var right = n.x + n.width;
    if (maxX === null || right > maxX) { maxX = right; minY = n.y; }
  });
  if (maxX === null) {
    root.x = Math.round(figma.viewport.center.x - root.width / 2);
    root.y = Math.round(figma.viewport.center.y - Math.min(root.height, 800) / 2);
  } else {
    root.x = Math.round(maxX + 200);
    root.y = Math.round(minY);
  }
}

function importCapture(data) {
  if (!data || !data.root || data.generator !== 'html-to-figma') {
    return Promise.reject(new Error('El JSON no viene de html-to-figma (falta "root").'));
  }
  var ctx = { imageHashes: {}, warnings: [], substitutedFonts: {}, count: 0, total: countNodes(data.root) };
  prepareImages(data.images, ctx);

  var rootData = data.root;
  var root = figma.createFrame();
  applyFrame(root, rootData, ctx);
  root.name = (data.source && data.source.title) || rootData.name || 'HTML import';
  figma.currentPage.appendChild(root);
  placeNewRoot(root);

  return buildChildren(rootData.children || [], root, { x: rootData.x, y: rootData.y }, ctx).then(function () {
    figma.currentPage.selection = [root];
    figma.viewport.scrollAndZoomIntoView([root]);
    return { root: root, ctx: ctx };
  });
}

figma.ui.onmessage = function (msg) {
  if (!msg) return;
  if (msg.type === 'close') {
    figma.closePlugin();
    return;
  }
  if (msg.type !== 'import') return;
  importCapture(msg.data).then(
    function (r) {
      var fonts = Object.keys(r.ctx.substitutedFonts).map(function (k) { return k + ' → ' + r.ctx.substitutedFonts[k]; });
      figma.ui.postMessage({ type: 'done', count: r.ctx.count, warnings: r.ctx.warnings.slice(0, 20), fonts: fonts });
      figma.notify('HTML importado: ' + r.ctx.count + ' capas');
    },
    function (e) {
      figma.ui.postMessage({ type: 'error', message: e.message || String(e) });
    }
  );
};

// Exposed for the local test harness (ignored inside Figma).
if (typeof module !== 'undefined') module.exports = { importCapture: importCapture, pickStyle: pickStyle };
