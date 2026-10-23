// A small in-browser stand-in for the Figma Plugin API, strict enough to catch
// the mistakes Figma itself rejects (unloaded fonts, bad paints, tiny sizes),
// plus a renderer that draws the resulting layer tree as DOM for visual checks.
(function () {
  'use strict';

  var FONT_FAMILIES = {
    Inter: ['Thin', 'Extra Light', 'Light', 'Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black', 'Italic', 'Bold Italic'],
    Roboto: ['Thin', 'Light', 'Regular', 'Medium', 'Bold', 'Black', 'Italic', 'Bold Italic'],
    'Roboto Mono': ['Regular', 'Bold'],
    Arial: ['Regular', 'Bold', 'Italic', 'Bold Italic'],
    Georgia: ['Regular', 'Bold', 'Italic'],
  };
  var STYLE_WEIGHT = { thin: 100, extralight: 200, light: 300, regular: 400, italic: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
  var loaded = {};
  var errors = [];

  function fail(msg) {
    errors.push(msg);
    throw new Error(msg);
  }

  function checkPaints(paints, where) {
    if (!Array.isArray(paints)) fail(where + ': paints must be an array');
    paints.forEach(function (p) {
      if (p.type === 'SOLID') {
        if (!p.color || 'a' in p.color) fail(where + ': SOLID color must be {r,g,b}');
        ['r', 'g', 'b'].forEach(function (k) { if (!(p.color[k] >= 0 && p.color[k] <= 1)) fail(where + ': color out of range'); });
      } else if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL') {
        if (!p.gradientTransform || p.gradientTransform.length !== 2) fail(where + ': bad gradientTransform');
        if (!p.gradientStops || p.gradientStops.length < 2) fail(where + ': gradient needs 2+ stops');
      } else if (p.type === 'IMAGE') {
        if (!images[p.imageHash]) fail(where + ': unknown imageHash');
      } else fail(where + ': unknown paint ' + p.type);
    });
    return paints;
  }

  var images = {};
  var nextId = 1;

  function Base(type) {
    this.id = String(nextId++);
    this.type = type;
    this.name = type;
    this.x = 0;
    this.y = 0;
    this._w = 100;
    this._h = 100;
    this.parent = null;
    this.opacity = 1;
    this._fills = [];
    this.strokes = [];
    this.effects = [];
  }
  Object.defineProperty(Base.prototype, 'width', { get: function () { return this._w; } });
  Object.defineProperty(Base.prototype, 'height', { get: function () { return this._h; } });
  Object.defineProperty(Base.prototype, 'fills', {
    get: function () { return this._fills; },
    set: function (v) { this._fills = checkPaints(v, this.name + '.fills'); },
  });
  Base.prototype.resize = function (w, h) {
    if (!(w >= 0.01 && h >= 0.01)) fail(this.name + ': resize below 0.01 (' + w + 'x' + h + ')');
    this._w = w;
    this._h = h;
  };

  function Container(type) {
    Base.call(this, type);
    this.children = [];
  }
  Container.prototype = Object.create(Base.prototype);
  Container.prototype.appendChild = function (n) {
    if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1);
    n.parent = this;
    this.children.push(n);
  };

  // ---- text measurement with the real browser ----
  var measurer = null;
  function measure(t) {
    if (!measurer) {
      measurer = document.createElement('div');
      measurer.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
      document.body.appendChild(measurer);
    }
    applyTextCss(measurer, t);
    measurer.style.width = t._autoResize === 'WIDTH_AND_HEIGHT' ? 'auto' : t._w + 'px';
    measurer.style.whiteSpace = t._autoResize === 'WIDTH_AND_HEIGHT' ? 'pre' : 'pre-wrap';
    measurer.textContent = t._characters || ' ';
    var r = measurer.getBoundingClientRect();
    if (t._autoResize === 'WIDTH_AND_HEIGHT') t._w = Math.max(1, r.width);
    if (t._autoResize !== 'NONE') t._h = Math.max(1, r.height);
  }

  function TextNode() {
    Base.call(this, 'TEXT');
    this._fontName = { family: 'Inter', style: 'Regular' };
    this._characters = '';
    this.fontSize = 12;
    this._autoResize = 'WIDTH_AND_HEIGHT';
    this.lineHeight = { unit: 'AUTO' };
    this.letterSpacing = { value: 0, unit: 'PIXELS' };
    this.textAlignHorizontal = 'LEFT';
    this.textCase = 'ORIGINAL';
    this.textDecoration = 'NONE';
    this._fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
  }
  TextNode.prototype = Object.create(Base.prototype);
  function fontKey(f) { return f.family + '::' + f.style; }
  Object.defineProperty(TextNode.prototype, 'fontName', {
    get: function () { return this._fontName; },
    set: function (f) {
      if (!loaded[fontKey(f)]) fail('fontName set before loadFontAsync: ' + fontKey(f));
      this._fontName = f;
    },
  });
  Object.defineProperty(TextNode.prototype, 'characters', {
    get: function () { return this._characters; },
    set: function (v) {
      if (!loaded[fontKey(this._fontName)]) fail('characters set before font loaded: ' + fontKey(this._fontName));
      this._characters = v;
      measure(this);
    },
  });
  Object.defineProperty(TextNode.prototype, 'textAutoResize', {
    get: function () { return this._autoResize; },
    set: function (v) { this._autoResize = v; measure(this); },
  });
  TextNode.prototype.resize = function (w, h) {
    Base.prototype.resize.call(this, w, h);
    this._autoResize = 'NONE';
  };
  Object.defineProperty(TextNode.prototype, 'width', { get: function () { measure(this); return this._w; } });
  Object.defineProperty(TextNode.prototype, 'height', { get: function () { measure(this); return this._h; } });

  var uiMessages = [];
  var page = new Container('PAGE');
  page.selection = [];

  window.__mock = { errors: errors, uiMessages: uiMessages, page: page };
  window.__html__ = '';
  window.figma = {
    showUI: function () {},
    notify: function () {},
    closePlugin: function () {},
    ui: { postMessage: function (m) { uiMessages.push(m); }, onmessage: null },
    currentPage: page,
    viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView: function () {} },
    createFrame: function () {
      var f = new Container('FRAME');
      f._fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
      f.clipsContent = true;
      return f;
    },
    createText: function () { return new TextNode(); },
    createImage: function (bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.length < 8) fail('createImage needs bytes');
      var sig = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x47 ? 'image/gif' : null;
      if (!sig) fail('createImage: unsupported image format');
      var hash = 'h' + nextId++;
      images[hash] = URL.createObjectURL(new Blob([bytes], { type: sig }));
      return { hash: hash };
    },
    base64Decode: function (b64) {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    },
    createNodeFromSvg: function (svg) {
      var doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) fail('createNodeFromSvg: invalid SVG');
      var f = new Container('FRAME');
      f._svg = svg;
      f._fills = [];
      var el = doc.documentElement;
      f._w = parseFloat(el.getAttribute('width')) || 100;
      f._h = parseFloat(el.getAttribute('height')) || 100;
      return f;
    },
    listAvailableFontsAsync: function () {
      var list = [];
      Object.keys(FONT_FAMILIES).forEach(function (fam) {
        FONT_FAMILIES[fam].forEach(function (s) { list.push({ fontName: { family: fam, style: s } }); });
      });
      return Promise.resolve(list);
    },
    loadFontAsync: function (f) {
      if (!FONT_FAMILIES[f.family] || FONT_FAMILIES[f.family].indexOf(f.style) === -1) return Promise.reject(new Error('font not found'));
      loaded[fontKey(f)] = true;
      return Promise.resolve();
    },
  };

  // ---- renderer ----

  function css(c, a) {
    return 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',' + (a == null ? 1 : a) + ')';
  }

  function styleWeight(style) {
    return STYLE_WEIGHT[style.toLowerCase().replace(/italic/, '').replace(/\s/g, '') || 'regular'] || 400;
  }

  function applyTextCss(el, t) {
    var fill = t._fills[0];
    el.style.fontFamily = '"' + t._fontName.family + '", sans-serif';
    el.style.fontWeight = styleWeight(t._fontName.style);
    el.style.fontStyle = /italic/i.test(t._fontName.style) ? 'italic' : 'normal';
    el.style.fontSize = t.fontSize + 'px';
    el.style.lineHeight = t.lineHeight.unit === 'PIXELS' ? t.lineHeight.value + 'px' : 'normal';
    el.style.letterSpacing = (t.letterSpacing.value || 0) + 'px';
    el.style.textAlign = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }[t.textAlignHorizontal];
    el.style.textTransform = { UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' }[t.textCase] || 'none';
    el.style.textDecoration = { UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' }[t.textDecoration] || 'none';
    el.style.color = fill && fill.type === 'SOLID' ? css(fill.color, fill.opacity) : '#000';
  }

  // Invert Figma's gradientTransform back into a CSS angle (verifies the math).
  function gradientCss(p, w, h) {
    var stops = p.gradientStops.map(function (s) { return css(s.color, s.color.a) + ' ' + s.position * 100 + '%'; }).join(', ');
    var m = p.gradientTransform;
    if (p.type === 'GRADIENT_RADIAL') return 'radial-gradient(farthest-corner, ' + stops + ')';
    var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2];
    var det = a * e - b * d;
    var inv = function (gx, gy) {
      return { x: (e * (gx - c) - b * (gy - f)) / det, y: (-d * (gx - c) + a * (gy - f)) / det };
    };
    var p0 = inv(0, 0.5);
    var p1 = inv(1, 0.5);
    var dx = (p1.x - p0.x) * w;
    var dy = (p1.y - p0.y) * h;
    var deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return 'linear-gradient(' + deg + 'deg, ' + stops + ')';
  }

  function renderNode(n) {
    var el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.style.width = n._w + 'px';
    el.style.height = n._h + 'px';
    el.style.boxSizing = 'border-box';
    if (n.opacity < 1) el.style.opacity = n.opacity;
    if (n.type === 'TEXT') {
      applyTextCss(el, n);
      el.style.whiteSpace = n._autoResize === 'WIDTH_AND_HEIGHT' ? 'pre' : 'pre-wrap';
      el.textContent = n._characters;
      return el;
    }
    if (n._svg) {
      el.innerHTML = n._svg;
      return el;
    }
    var bgs = [];
    var sizes = [];
    n._fills.slice().reverse().forEach(function (p, i, arr) {
      var isBottom = i === arr.length - 1;
      if (p.type === 'SOLID') {
        if (isBottom) el.style.backgroundColor = css(p.color, p.opacity);
        else { bgs.push('linear-gradient(' + css(p.color, p.opacity) + ',' + css(p.color, p.opacity) + ')'); sizes.push('auto'); }
      } else if (p.type === 'IMAGE') {
        bgs.push('url(' + images[p.imageHash] + ')');
        sizes.push(p.scaleMode === 'FIT' ? 'contain' : p.scaleMode === 'TILE' ? 'auto' : 'cover');
      } else {
        bgs.push(gradientCss(p, n._w, n._h));
        sizes.push('auto');
      }
    });
    if (bgs.length) {
      el.style.backgroundImage = bgs.join(',');
      el.style.backgroundSize = sizes.join(',');
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = sizes.map(function (s) { return s === 'auto' ? 'repeat' : 'no-repeat'; }).join(',');
    }
    if (n.strokes.length) {
      var s = n.strokes[0];
      var w = n.strokeTopWeight != null ? [n.strokeTopWeight, n.strokeRightWeight, n.strokeBottomWeight, n.strokeLeftWeight] : [n.strokeWeight, n.strokeWeight, n.strokeWeight, n.strokeWeight];
      el.style.borderStyle = n.dashPattern ? 'dashed' : 'solid';
      el.style.borderColor = css(s.color, s.opacity);
      el.style.borderWidth = w.map(function (x) { return (x || 0) + 'px'; }).join(' ');
    }
    if (n.topLeftRadius != null) el.style.borderRadius = [n.topLeftRadius, n.topRightRadius, n.bottomRightRadius, n.bottomLeftRadius].map(function (r) { return r + 'px'; }).join(' ');
    else if (n.cornerRadius) el.style.borderRadius = n.cornerRadius + 'px';
    var shadows = n.effects
      .filter(function (e) { return e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'; })
      .map(function (e) { return (e.type === 'INNER_SHADOW' ? 'inset ' : '') + e.offset.x + 'px ' + e.offset.y + 'px ' + e.radius + 'px ' + (e.spread || 0) + 'px ' + css(e.color, e.color.a); });
    if (shadows.length) el.style.boxShadow = shadows.reverse().join(',');
    if (n.clipsContent) el.style.overflow = 'hidden';
    // Figma strokes are drawn inside without shifting children; offset children to match.
    var inner = el;
    if (n.strokes.length) {
      inner = document.createElement('div');
      inner.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;margin:-' + el.style.borderWidth.split(' ').map(function (x) { return x; }).join(' -') + ';';
      el.appendChild(inner);
    }
    n.children.forEach(function (c) { inner.appendChild(renderNode(c)); });
    return el;
  }

  window.__renderFigma = function (container) {
    var root = page.children[page.children.length - 1];
    root.x = 0;
    root.y = 0;
    container.innerHTML = '';
    container.appendChild(renderNode(root));
    return { width: root._w, height: root._h };
  };

  window.__countNodes = function () {
    var counts = {};
    (function walk(n) {
      var k = n._svg ? 'SVG' : n.type;
      counts[k] = (counts[k] || 0) + 1;
      (n.children || []).forEach(walk);
    })(page);
    return counts;
  };
})();
