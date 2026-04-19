/**
 * Source for the in-page comment overlay. Served verbatim from the local
 * comment server at /sdk.js. Loaded by scaffolds when the page URL contains
 * the __demox_sdk param. Must stay vanilla JS, no build step.
 */
export const COMMENT_SDK_SOURCE = String.raw`
;(function () {
  if (window.__DEMOX_LOADED__) return
  window.__DEMOX_LOADED__ = true

  var u = new URL(location.href)
  var pid = u.searchParams.get('__demox_pid') || (window.__DEMOX__ && window.__DEMOX__.project)
  var api = u.searchParams.get('__demox_api') || (window.__DEMOX__ && window.__DEMOX__.api)
  if (!pid || !api) return

  var STATE = { selecting: false, hover: null, comments: [] }

  function css(el, styles) { for (var k in styles) el.style[k] = styles[k] }

  function root() {
    var r = document.getElementById('__demox_root__')
    if (r) return r
    r = document.createElement('div')
    r.id = '__demox_root__'
    css(r, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483640' })
    document.documentElement.appendChild(r)
    return r
  }

  function fab() {
    var b = document.createElement('button')
    b.type = 'button'
    b.textContent = '💬 Comment'
    css(b, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483646',
      pointerEvents: 'auto', cursor: 'pointer',
      padding: '10px 14px', borderRadius: '999px', border: '0',
      background: '#4f8cff', color: 'white', fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', fontWeight: '600',
      boxShadow: '0 6px 24px rgba(0,0,0,0.25)'
    })
    b.addEventListener('click', function () { setSelecting(!STATE.selecting) })
    document.documentElement.appendChild(b)
    return b
  }

  function highlightBox() {
    var box = document.createElement('div')
    box.id = '__demox_hl__'
    css(box, {
      position: 'fixed', pointerEvents: 'none', zIndex: '2147483641',
      border: '2px solid #4f8cff', borderRadius: '4px',
      background: 'rgba(79,140,255,0.08)', display: 'none',
      transition: 'all 80ms ease'
    })
    root().appendChild(box)
    return box
  }

  function setSelecting(on) {
    STATE.selecting = on
    document.documentElement.style.cursor = on ? 'crosshair' : ''
    if (!on && STATE.hl) STATE.hl.style.display = 'none'
  }

  function isOverlay(el) {
    while (el && el !== document.documentElement) {
      if (el.id === '__demox_root__' || el.id === '__demox_hl__' || el.classList && el.classList.contains('__demox_marker__')) return true
      el = el.parentElement
    }
    return false
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return ''
    var path = []
    while (el && el.nodeType === 1 && path.length < 6) {
      var s = el.nodeName.toLowerCase()
      if (el.id) { s += '#' + el.id; path.unshift(s); break }
      var sib = el, n = 1
      while ((sib = sib.previousElementSibling)) if (sib.nodeName === el.nodeName) n++
      s += ':nth-of-type(' + n + ')'
      path.unshift(s)
      el = el.parentElement
    }
    return path.join(' > ')
  }

  function xPath(el) {
    if (!(el instanceof Element)) return ''
    var parts = []
    while (el && el.nodeType === 1) {
      var i = 1, sib = el.previousSibling
      while (sib) { if (sib.nodeType === 1 && sib.nodeName === el.nodeName) i++; sib = sib.previousSibling }
      parts.unshift(el.nodeName.toLowerCase() + '[' + i + ']')
      el = el.parentNode
    }
    return '/' + parts.join('/')
  }

  function findSourceLoc(el) {
    var cur = el
    while (cur && cur !== document.documentElement) {
      if (cur.dataset && cur.dataset.demoxLoc) return cur.dataset.demoxLoc
      cur = cur.parentElement
    }
    return undefined
  }

  function showHighlight(el) {
    if (!STATE.hl) STATE.hl = highlightBox()
    var r = el.getBoundingClientRect()
    css(STATE.hl, {
      display: 'block',
      left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px'
    })
  }

  function onMove(e) {
    if (!STATE.selecting) return
    var el = e.target
    if (!el || isOverlay(el)) return
    STATE.hover = el
    showHighlight(el)
  }

  function onClick(e) {
    if (!STATE.selecting) return
    var el = e.target
    if (!el || isOverlay(el)) return
    e.preventDefault()
    e.stopPropagation()
    setSelecting(false)
    openComposer(el, e.clientX, e.clientY)
  }

  function openComposer(el, cx, cy) {
    var rect = el.getBoundingClientRect()
    var rx = rect.width ? (cx - rect.left) / rect.width : 0.5
    var ry = rect.height ? (cy - rect.top) / rect.height : 0.5

    var wrap = document.createElement('div')
    css(wrap, {
      position: 'fixed', zIndex: '2147483647', pointerEvents: 'auto',
      left: Math.min(window.innerWidth - 320, Math.max(8, cx)) + 'px',
      top: Math.min(window.innerHeight - 200, Math.max(8, cy + 8)) + 'px',
      width: '300px',
      background: '#11151a', color: '#e6e9ef',
      border: '1px solid #1f2630', borderRadius: '10px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
      fontFamily: 'system-ui, sans-serif', fontSize: '13px',
      padding: '10px'
    })
    wrap.innerHTML =
      '<div style="font-size:11px;color:#8a93a3;margin-bottom:6px">' +
        'Commenting on &lt;' + el.tagName.toLowerCase() + '&gt;' +
      '</div>' +
      '<input id="__dx_author" placeholder="Your name (optional)" style="width:100%;background:#161b22;color:#e6e9ef;border:1px solid #1f2630;border-radius:6px;padding:6px 8px;margin-bottom:6px;font:inherit" />' +
      '<textarea id="__dx_body" rows="4" placeholder="What needs to change?" style="width:100%;resize:vertical;background:#161b22;color:#e6e9ef;border:1px solid #1f2630;border-radius:6px;padding:6px 8px;font:inherit"></textarea>' +
      '<div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px">' +
        '<button id="__dx_cancel" style="background:transparent;color:inherit;border:1px solid #1f2630;border-radius:6px;padding:5px 10px;cursor:pointer;font:inherit">Cancel</button>' +
        '<button id="__dx_send" style="background:#4f8cff;color:white;border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font:inherit">Post</button>' +
      '</div>'
    document.documentElement.appendChild(wrap)
    var body = wrap.querySelector('#__dx_body'); body.focus()
    wrap.querySelector('#__dx_cancel').onclick = function () { wrap.remove() }
    wrap.querySelector('#__dx_send').onclick = function () {
      var text = body.value.trim()
      if (!text) return
      var author = wrap.querySelector('#__dx_author').value.trim() || 'Anonymous'
      try { localStorage.setItem('__demox_author', author) } catch (_) {}
      submit({
        projectId: pid,
        author: author,
        body: text,
        target: {
          selector: cssPath(el), xpath: xPath(el),
          rx: rx, ry: ry,
          rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
          text: (el.innerText || '').trim().slice(0, 120),
          tag: el.tagName.toLowerCase(),
          sourceLoc: findSourceLoc(el)
        },
        viewport: {
          w: window.innerWidth, h: window.innerHeight,
          scrollX: window.scrollX, scrollY: window.scrollY,
          pageUrl: location.href, routePath: location.pathname
        }
      }).then(function (c) { if (c) addMarker(c); wrap.remove() })
        .catch(function (e) {
          var err = document.createElement('div')
          err.textContent = String(e && e.message || e)
          css(err, { color: '#ff9c9c', fontSize: '11px', marginTop: '6px' })
          wrap.appendChild(err)
        })
    }
  }

  function submit(input) {
    return fetch(api + '/api/comments?p=' + encodeURIComponent(pid), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('post failed: ' + r.status + ' ' + t) })
      return r.json()
    })
  }

  function addMarker(c) {
    var m = document.createElement('div')
    m.className = '__demox_marker__'
    m.title = c.author + ': ' + c.body
    css(m, {
      position: 'fixed', zIndex: '2147483642', pointerEvents: 'auto',
      width: '22px', height: '22px', borderRadius: '50%',
      background: '#facc15', color: '#1a1300',
      display: 'grid', placeItems: 'center',
      fontFamily: 'system-ui', fontSize: '12px', fontWeight: '700',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      cursor: 'pointer', transform: 'translate(-50%,-50%)'
    })
    m.textContent = String(STATE.comments.length + 1)
    var place = function () {
      try {
        var el = document.querySelector(c.target.selector)
        if (!el) { m.style.display = 'none'; return }
        var r = el.getBoundingClientRect()
        m.style.display = 'grid'
        m.style.left = (r.left + r.width * c.target.rx) + 'px'
        m.style.top = (r.top + r.height * c.target.ry) + 'px'
      } catch (_) { m.style.display = 'none' }
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.documentElement.appendChild(m)
    STATE.comments.push(c)
  }

  function loadExisting() {
    fetch(api + '/api/comments?p=' + encodeURIComponent(pid))
      .then(function (r) { return r.ok ? r.json() : [] })
      .then(function (list) { (list || []).forEach(function (c) { if (c.status === 'open') addMarker(c) }) })
      .catch(function () {})
  }

  function init() {
    fab()
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('click', onClick, true)
    loadExisting()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})();
`
