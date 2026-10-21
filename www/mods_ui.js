// MOD: on-screen menus that sit on top of the game.
//  - Commands chat button (next to the pause button) + command box
//  - Mods menu (turn mods on/off)
//  - Custom NPC creator (pick a skin, name, behaviour)
(function () {
  'use strict';

  var css = [
    '.mc-ui{font-family:"Trebuchet MS",Verdana,sans-serif;color:#eee;-webkit-user-select:none;user-select:none}',
    '.mc-ui input,.mc-ui select{-webkit-user-select:text;user-select:text}',
    '#mc-chatbtn{position:fixed;display:none;z-index:20;padding:0;border:2px solid rgba(255,255,255,.55);border-radius:4px;background:rgba(40,40,40,.45);cursor:pointer}',
    '#mc-chatbtn svg{width:70%;height:70%;display:block;margin:auto}',
    '#mc-chatbtn:active{background:rgba(120,120,120,.6)}',
    '.mc-overlay{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}',
    '.mc-panel{background:#3b3b3b;border:3px solid #111;box-shadow:inset 2px 2px 0 #6b6b6b,inset -2px -2px 0 #222;padding:14px;width:min(560px,92vw);max-height:88vh;display:flex;flex-direction:column;gap:10px}',
    '.mc-panel h2{margin:0;font-size:20px;text-align:center;color:#fff;text-shadow:2px 2px #000}',
    '.mc-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;display:flex;flex-direction:column;gap:8px}',
    '.mc-btn{font:inherit;font-size:15px;color:#fff;background:#6f6f6f;border:2px solid #111;box-shadow:inset 2px 2px 0 #9a9a9a,inset -2px -2px 0 #444;padding:8px 12px;cursor:pointer;text-shadow:1px 1px #222;min-height:40px}',
    '.mc-btn:active{background:#8a8aaa}',
    '.mc-btn.small{font-size:13px;padding:6px 9px;min-height:34px}',
    '.mc-btn.green{background:#3f7f3f}',
    '.mc-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.mc-input{flex:1;min-width:120px;font-size:16px;padding:9px;background:#000;color:#fff;border:2px solid #aaa}',
    '.mc-select{font-size:15px;padding:8px;background:#222;color:#fff;border:2px solid #aaa}',
    '.mc-out{min-height:20px;color:#ffdd77;font-size:14px}',
    '.mc-mod{display:flex;align-items:center;gap:10px;background:#2a2a2a;padding:8px;border:2px solid #1a1a1a}',
    '.mc-mod .t{flex:1}.mc-mod .n{font-weight:bold}.mc-mod .d{font-size:12px;color:#bbb}',
    '.mc-toggle{min-width:64px}',
    '.mc-toggle.on{background:#3f7f3f}.mc-toggle.off{background:#7f3f3f}',
    '.mc-npc{background:#2a2a2a;border:2px solid #1a1a1a;padding:8px;display:flex;gap:10px;align-items:flex-start}',
    '.mc-npc canvas{width:64px;height:64px;image-rendering:pixelated;background:#555;border:2px solid #111;flex:none}',
    '.mc-npc .f{flex:1;display:flex;flex-direction:column;gap:6px}',
    '.mc-note{font-size:12px;color:#bbb;text-align:center}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  // Call into the game directly (not via ccall: the game uses Asyncify for its loading screen,
  // and ccall's async checks would wrongly abort once a world has been loaded).
  function C(name, ret, types, args) {
    try {
      var f = Module['_' + name]; if (!f) return null;
      var allocs = [], a = [];
      for (var i = 0; i < (args || []).length; i++) {
        if (types[i] === 'string') {
          var str = String(args[i]), len = (Module.lengthBytesUTF8 || lengthBytesUTF8)(str) + 1, ptr = Module._malloc(len);
          (Module.stringToUTF8 || stringToUTF8)(str, ptr, len); allocs.push(ptr); a.push(ptr);
        } else a.push(args[i]);
      }
      var r = f.apply(null, a);
      for (var j = 0; j < allocs.length; j++) Module._free(allocs[j]);
      if (ret === "string") return r ? (Module.UTF8ToString || UTF8ToString)(r) : "";
      return r;
    } catch (e) { console.warn(name, e); return null; }
  }
  function shield(node) {
    // keep keyboard events away from the game while typing
    ['keydown', 'keyup', 'keypress'].forEach(function (t) { node.addEventListener(t, function (e) { e.stopPropagation(); }); });
  }
  function overlay() {
    var o = el('div', 'mc-ui mc-overlay'); shield(o); document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o) close(o); });
    return o;
  }
  function open(o) { window.mcMenuOpen = true; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {} o.style.display = 'flex'; }
  function close(o) { o.style.display = 'none'; window.mcMenuOpen = false; }

  // ---------------- commands ----------------
  var chatBtn = el('button', 'mc-ui', '<svg viewBox="0 0 24 24"><path fill="#fff" d="M3 4h18v12H8l-5 4z"/><rect x="6" y="8" width="2" height="2" fill="#333"/><rect x="11" y="8" width="2" height="2" fill="#333"/><rect x="16" y="8" width="2" height="2" fill="#333"/></svg>');
  chatBtn.id = 'mc-chatbtn'; chatBtn.title = 'Commands';
  document.body.appendChild(chatBtn);

  var chat = overlay();
  chat.style.alignItems = 'flex-end';
  var cp = el('div', 'mc-panel'); chat.appendChild(cp);
  cp.appendChild(el('h2', null, 'Commands'));
  var row = el('div', 'mc-row'); cp.appendChild(row);
  var input = el('input', 'mc-input'); input.placeholder = 'Type a command (help)'; input.autocapitalize = 'off'; input.autocomplete = 'off'; input.spellcheck = false;
  row.appendChild(input);
  var runBtn = el('button', 'mc-btn green', 'Run'); row.appendChild(runBtn);
  var quick = el('div', 'mc-row'); cp.appendChild(quick);
  ['creative', 'survival', 'god', 'day', 'night'].forEach(function (c) {
    var b = el('button', 'mc-btn small', c); quick.appendChild(b);
    b.onclick = function () { run(c); };
  });
  var out = el('div', 'mc-out'); cp.appendChild(out);
  var closeChat = el('button', 'mc-btn', 'Close'); cp.appendChild(closeChat);

  function run(text) {
    var r = C('mc_command', 'string', ['string'], [text]);
    out.textContent = r || '';
    input.value = '';
  }
  runBtn.onclick = function () { run(input.value); };
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(input.value); } if (e.key === 'Escape') close(chat); });
  closeChat.onclick = function () { close(chat); };
  chatBtn.onclick = function () { out.textContent = 'Commands: creative, survival, god, day, night'; open(chat); setTimeout(function () { input.focus(); }, 50); };

  window.mcSetInGame = function (on) {
    chatBtn.style.display = on ? 'block' : 'none';
    if (!on) close(chat);
  };
  var lastLayout = null;
  window.mcLayoutChat = function (x, y, size, cw, ch) {
    lastLayout = [x, y, size, cw, ch];
    var c = Module.canvas || document.getElementById('canvas');
    var r = c.getBoundingClientRect();
    var sx = r.width / cw, sy = r.height / ch;
    var s = size * sx;
    chatBtn.style.width = chatBtn.style.height = s + 'px';
    chatBtn.style.left = (r.left + (x - size - 8) * sx) + 'px';
    chatBtn.style.top = (r.top + y * sy) + 'px';
  };
  window.addEventListener('resize', function () { if (lastLayout) window.mcLayoutChat.apply(null, lastLayout); });

  // ---------------- mods menu ----------------
  var mods = overlay();
  var mp = el('div', 'mc-panel'); mods.appendChild(mp);
  mp.appendChild(el('h2', null, 'Mods'));
  var mpBtn = el('button', 'mc-btn green', 'Multiplayer (play with friends)'); mp.appendChild(mpBtn);
  mpBtn.onclick = function () { close(mods); C('mc_menu_refresh', null, [], []); if (window.mcOpenMultiplayer) window.mcOpenMultiplayer(); };
  var mlist = el('div', 'mc-scroll'); mp.appendChild(mlist);
  mp.appendChild(el('div', 'mc-note', 'Changes to creatures and items apply the next time you load a world.'));
  var mclose = el('button', 'mc-btn', 'Done'); mp.appendChild(mclose);
  mclose.onclick = function () { close(mods); C('mc_menu_refresh', null, [], []); };

  window.mcOpenMods = function () {
    mlist.innerHTML = '';
    var n = C('mc_mod_count', 'number', [], []) || 0;
    for (var i = 0; i < n; i++) (function (i) {
      var r = el('div', 'mc-mod');
      var t = el('div', 't');
      t.appendChild(el('div', 'n', C('mc_mod_name', 'string', ['number'], [i])));
      t.appendChild(el('div', 'd', C('mc_mod_desc', 'string', ['number'], [i])));
      var b = el('button', 'mc-btn small mc-toggle');
      function paint() { var on = C('mc_mod_get', 'number', ['number'], [i]); b.textContent = on ? 'ON' : 'OFF'; b.className = 'mc-btn small mc-toggle ' + (on ? 'on' : 'off'); }
      b.onclick = function () { C('mc_mod_set', null, ['number', 'number'], [i, C('mc_mod_get', 'number', ['number'], [i]) ? 0 : 1]); paint(); };
      paint();
      r.appendChild(t); r.appendChild(b); mlist.appendChild(r);
    })(i);
    open(mods);
  };

  // ---------------- custom NPCs ----------------
  var npcs = overlay();
  var np = el('div', 'mc-panel'); npcs.appendChild(np);
  np.appendChild(el('h2', null, 'Custom NPCs'));
  np.appendChild(el('div', 'mc-note', 'Pick a Minecraft skin (.png, 64x32 or 64x64), a name and how it behaves, then tap Set. Its spawn egg appears in the creative inventory.'));
  var nlist = el('div', 'mc-scroll'); np.appendChild(nlist);
  var nclose = el('button', 'mc-btn', 'Done'); np.appendChild(nclose);
  nclose.onclick = function () { close(npcs); };

  function drawFace(canvas, img) {
    var g = canvas.getContext('2d'); canvas.width = 8; canvas.height = 8;
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, 8, 8);
    var s = img.width / 64;
    g.drawImage(img, 8 * s, 8 * s, 8 * s, 8 * s, 0, 0, 8, 8);    // face
    g.drawImage(img, 40 * s, 8 * s, 8 * s, 8 * s, 0, 0, 8, 8);   // hat layer
  }
  function loadSkinFromFS(slot, ver, cb) {
    try {
      var data = FS.readFile('/games/npcs/skin' + slot + '_v' + ver + '.png');
      var url = URL.createObjectURL(new Blob([data], { type: 'image/png' }));
      var img = new Image(); img.onload = function () { cb(img); URL.revokeObjectURL(url); }; img.src = url;
    } catch (e) {}
  }
  function toSkinPng(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (w < 64 || (h !== w && h * 2 !== w)) return null;   // must be 64x32 / 64x64 (or HD multiples)
    var c = document.createElement('canvas'); c.width = 64; c.height = 32;
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, w, w / 2, 0, 0, 64, 32);          // the top half is the classic skin layout
    var b64 = c.toDataURL('image/png').split(',')[1];
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  window.mcOpenNpcs = function () {
    nlist.innerHTML = '';
    for (var slot = 0; slot < 5; slot++) (function (slot) {
      var info = (C('mc_npc_info', 'string', ['number'], [slot]) || '0|0|').split('|');
      var beh = +info[0], ver = +info[1], name = info.slice(2).join('|');
      var card = el('div', 'mc-npc');
      var cv = el('canvas'); card.appendChild(cv);
      var f = el('div', 'f'); card.appendChild(f);
      var nameIn = el('input', 'mc-input'); nameIn.placeholder = 'Custom NPC ' + (slot + 1); nameIn.value = name; nameIn.maxLength = 24;
      f.appendChild(nameIn);
      var r2 = el('div', 'mc-row'); f.appendChild(r2);
      var sel = el('select', 'mc-select');
      [['Friendly - follows & protects you', 0], ['Neutral - fights back if hit', 1], ['Enemy - attacks you', 2]].forEach(function (o) {
        var op = el('option', null, o[0]); op.value = o[1]; sel.appendChild(op);
      });
      sel.value = beh;
      r2.appendChild(sel);
      var r3 = el('div', 'mc-row'); f.appendChild(r3);
      var file = el('input'); file.type = 'file'; file.accept = 'image/png,image/*'; file.style.display = 'none';
      var pick = el('button', 'mc-btn small', 'Choose skin'); pick.onclick = function () { file.click(); };
      var set = el('button', 'mc-btn small green', 'Set');
      var status = el('div', 'mc-out'); status.style.fontSize = '12px';
      r3.appendChild(pick); r3.appendChild(set); r3.appendChild(file);
      f.appendChild(status);
      var chosen = null;
      if (ver > 0) { loadSkinFromFS(slot, ver, function (img) { drawFace(cv, img); }); status.textContent = 'Skin set.'; }
      else status.textContent = 'No skin yet (looks like Steve).';
      file.onchange = function () {
        var fl = file.files && file.files[0]; if (!fl) return;
        var url = URL.createObjectURL(fl); var img = new Image();
        img.onload = function () {
          var png = toSkinPng(img);
          if (!png) { status.textContent = 'That image isn’t a Minecraft skin (needs 64x32 or 64x64).'; chosen = null; return; }
          chosen = png; drawFace(cv, img); status.textContent = 'Skin loaded - tap Set to save it.';
          URL.revokeObjectURL(url);
        };
        img.onerror = function () { status.textContent = 'Couldn’t read that image.'; };
        img.src = url;
      };
      set.onclick = function () {
        var newVer = ver;
        if (chosen) {
          try { FS.mkdir('/games/npcs'); } catch (e) {}
          newVer = ver + 1;
          try { FS.writeFile('/games/npcs/skin' + slot + '_v' + newVer + '.png', chosen); } catch (e) { status.textContent = 'Could not save the skin.'; return; }
          if (ver > 0) { try { FS.unlink('/games/npcs/skin' + slot + '_v' + ver + '.png'); } catch (e) {} }
          ver = newVer; chosen = null;
        }
        C('mc_npc_set', null, ['number', 'number', 'number', 'string'], [slot, +sel.value, ver, nameIn.value.trim()]);
        status.textContent = 'Saved! Find "' + (nameIn.value.trim() || ('Custom NPC ' + (slot + 1))) + ' Egg" in creative.';
      };
      nlist.appendChild(card);
    })(slot);
    open(npcs);
  };

  // ---------------- player skin ----------------
  var skinO = overlay();
  var sp = el('div', 'mc-panel'); skinO.appendChild(sp);
  sp.appendChild(el('h2', null, 'Your Skin'));
  sp.appendChild(el('div', 'mc-note', 'Pick a Minecraft skin (.png, 64x32 or 64x64). Turn on "Third person" in Options > Graphics, or type "view" in the commands box, to see yourself.'));
  var srow = el('div', 'mc-npc'); sp.appendChild(srow);
  var scv = el('canvas'); srow.appendChild(scv);
  var sf = el('div', 'f'); srow.appendChild(sf);
  var sfile = el('input'); sfile.type = 'file'; sfile.accept = 'image/png,image/*'; sfile.style.display = 'none';
  var sr = el('div', 'mc-row'); sf.appendChild(sr);
  var spick = el('button', 'mc-btn small', 'Choose skin'); spick.onclick = function () { sfile.click(); };
  var sset = el('button', 'mc-btn small green', 'Set');
  var sreset = el('button', 'mc-btn small', 'Back to Steve');
  sr.appendChild(spick); sr.appendChild(sset); sr.appendChild(sreset); sr.appendChild(sfile);
  var sstat = el('div', 'mc-out'); sf.appendChild(sstat);
  var sdone = el('button', 'mc-btn', 'Done'); sp.appendChild(sdone);
  sdone.onclick = function () { close(skinO); };
  var schosen = null;
  sfile.onchange = function () {
    var fl = sfile.files && sfile.files[0]; if (!fl) return;
    var url = URL.createObjectURL(fl), img = new Image();
    img.onload = function () {
      var png = toSkinPng(img);
      if (!png) { sstat.textContent = 'That image isn’t a Minecraft skin (needs 64x32 or 64x64).'; schosen = null; return; }
      schosen = png; drawFace(scv, img); sstat.textContent = 'Skin loaded - tap Set to wear it.';
    };
    img.src = url;
  };
  sset.onclick = function () {
    if (!schosen) { sstat.textContent = 'Choose a skin first.'; return; }
    var ver = (C('mc_skin_get', 'number', [], []) || 0) + 1;
    try { FS.mkdir('/games/skin'); } catch (e) {}
    try { FS.writeFile('/games/skin/player_v' + ver + '.png', schosen); } catch (e) { sstat.textContent = 'Could not save the skin.'; return; }
    try { if (ver > 1) FS.unlink('/games/skin/player_v' + (ver - 1) + '.png'); } catch (e) {}
    C('mc_skin_set', null, ['number'], [ver]); schosen = null;
    sstat.textContent = 'You’re wearing your new skin!';
  };
  sreset.onclick = function () { C('mc_skin_set', null, ['number'], [0]); var g = scv.getContext('2d'); g.clearRect(0, 0, scv.width, scv.height); sstat.textContent = 'Back to the default skin.'; };
  window.mcOpenSkin = function () {
    var v = C('mc_skin_get', 'number', [], []) || 0;
    sstat.textContent = v > 0 ? 'Custom skin on.' : 'Default skin (Steve).';
    if (v > 0) { try { var data = FS.readFile('/games/skin/player_v' + v + '.png'); var u = URL.createObjectURL(new Blob([data], { type: 'image/png' })); var im = new Image(); im.onload = function () { drawFace(scv, im); }; im.src = u; } catch (e) {} }
    open(skinO);
  };

  // ---------------- the Computer: BlockOS ----------------
  var css2 = [
    '.os{width:min(720px,96vw);height:min(460px,90vh);background:#0d1b14;border:6px solid #9c9ca4;border-radius:8px;box-shadow:inset 0 0 0 3px #555,0 0 30px rgba(0,255,120,.25);display:flex;flex-direction:column;overflow:hidden;font-family:"Courier New",monospace;color:#5dff8f}',
    '.os-bar{display:flex;align-items:center;gap:8px;background:#1f3328;padding:6px 8px;border-bottom:2px solid #2f5;color:#bfffd0;font-weight:bold}',
    '.os-bar .sp{flex:1}',
    '.os-body{flex:1;position:relative;overflow:hidden}',
    '.os-desk{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:14px;padding:18px}',
    '.os-icon{font:inherit;background:#132a1e;border:2px solid #2f6;color:#bfffd0;padding:12px 4px;border-radius:6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;min-height:84px}',
    '.os-icon b{font-size:26px;line-height:1}',
    '.os-icon:active{background:#2a5}',
    '.os-app{position:absolute;inset:0;display:none;flex-direction:column;padding:10px;gap:8px}',
    '.os-term{flex:1;overflow-y:auto;white-space:pre-wrap;font-size:14px;-webkit-overflow-scrolling:touch;touch-action:pan-y}',
    '.os-in{display:flex;gap:6px}.os-in span{align-self:center}',
    '.os-in input{flex:1;background:#000;border:1px solid #2f6;color:#5dff8f;font:inherit;font-size:16px;padding:6px}',
    '.os-btn{font:inherit;background:#174;color:#dfffe8;border:2px solid #3f8;padding:6px 10px;border-radius:4px;cursor:pointer;min-height:36px}',
    '.os-btn:active{background:#3a7}',
    '.os-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.os canvas{image-rendering:pixelated;background:#000;border:2px solid #2f6;touch-action:none;max-width:100%}',
    '.os textarea{flex:1;background:#000;color:#5dff8f;border:1px solid #2f6;font:inherit;font-size:15px;padding:8px;resize:none}',
    '.os-calc{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-width:320px}',
    '.os-disp{background:#000;border:1px solid #2f6;padding:10px;font-size:22px;text-align:right;max-width:300px;min-height:30px}'
  ].join('\n');
  var st2 = document.createElement('style'); st2.textContent = css2; document.head.appendChild(st2);

  var comp = overlay();
  var os = el('div', 'os mc-ui'); comp.appendChild(os);
  var bar = el('div', 'os-bar'); os.appendChild(bar);
  var homeBtn = el('button', 'os-btn', '▣ Home'); bar.appendChild(homeBtn);
  var title = el('span', null, 'BlockOS 1.0'); bar.appendChild(title);
  bar.appendChild(el('span', 'sp'));
  var clock = el('span', null, ''); bar.appendChild(clock);
  var offBtn = el('button', 'os-btn', '⏻ Off'); bar.appendChild(offBtn);
  var body = el('div', 'os-body'); os.appendChild(body);
  var desk = el('div', 'os-desk'); body.appendChild(desk);
  var apps = {}, current = null, stopFns = [];
  function show(name) {
    stopFns.forEach(function (f) { f(); }); stopFns = [];
    desk.style.display = name ? 'none' : 'grid';
    Object.keys(apps).forEach(function (k) { apps[k].el.style.display = k === name ? 'flex' : 'none'; });
    title.textContent = name ? 'BlockOS - ' + apps[name].title : 'BlockOS 1.0';
    current = name;
    if (name && apps[name].start) apps[name].start();
  }
  function app(name, icon, label, build, start) {
    var a = el('div', 'os-app'); body.appendChild(a);
    apps[name] = { el: a, title: label, start: start };
    build(a);
    var b = el('button', 'os-icon', '<b>' + icon + '</b>' + label); b.onclick = function () { show(name); }; desk.appendChild(b);
  }
  homeBtn.onclick = function () { show(null); };
  offBtn.onclick = function () { show(null); close(comp); };
  setInterval(function () { var d = new Date(); clock.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }, 1000);

  // Terminal
  var term, tin;
  function tprint(t) { term.textContent += t + '\n'; term.scrollTop = term.scrollHeight; }
  var FORTUNES = ['You will find diamonds... eventually.', 'A creeper is closer than you think.', 'Today is a good day to build a house.',
    'Never dig straight down.', 'The Hollow says hi.', 'Lucky numbers: 4, 8, 15, 16, 23, 42', 'You will befriend a dog.', 'Beware of hazmat figures bearing hugs.'];
  var JOKES = ['Why did the creeper cross the road? To get to the other SSSSSide.', 'What is a skeleton’s favorite instrument? The trom-BONE.',
    'Why don’t zombies eat clowns? They taste funny.', 'I tried to make a block of gold joke, but it didn’t pan out.', 'What do you call a sheep covered in chocolate? A candy baa.'];
  function hack() {
    var lines = ['Connecting to the mainframe...', 'Bypassing creeper firewall... OK', 'Downloading more RAM... 100%', 'Decrypting diamond locations...', 'ACCESS GRANTED', '(just kidding, this did nothing)'];
    lines.forEach(function (l, i) { setTimeout(function () { tprint(l); }, 400 * i); });
  }
  function matrix() {
    var n = 0, id = setInterval(function () { var s = ''; for (var i = 0; i < 48; i++) s += Math.random() < 0.5 ? String.fromCharCode(0x30a0 + Math.random() * 96) : ' '; tprint(s); if (++n > 25) clearInterval(id); }, 60);
    stopFns.push(function () { clearInterval(id); });
  }
  function runTerm(line) {
    line = (line || '').trim(); if (!line) return;
    tprint('> ' + line);
    var l = line.toLowerCase();
    if (l === 'help') tprint('BlockOS commands:\n  help, clear, time, date, fortune, joke, hack, matrix, ls, whoami, exit\nGame commands (they really work!):\n  day, night, creative, survival, god, heal, coords, view, tp spawn,\n  clearmobs, spawn <mob>, give <item>');
    else if (l === 'clear' || l === 'cls') term.textContent = '';
    else if (l === 'date' || l === 'time') tprint(new Date().toString());
    else if (l === 'fortune') tprint(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]);
    else if (l === 'joke') tprint(JOKES[Math.floor(Math.random() * JOKES.length)]);
    else if (l === 'hack') hack();
    else if (l === 'matrix') matrix();
    else if (l === 'ls' || l === 'dir') tprint('diamonds_TOTALLY_REAL.txt   creeper_photos/   homework.doc   secret_base_plans.png');
    else if (l === 'whoami') tprint('steve (probably)');
    else if (l === 'exit') show(null);
    else { var r = C('mc_command', 'string', ['string'], [line]); tprint(r || '...'); }
  }
  app('term', '&gt;_', 'Terminal', function (a) {
    term = el('div', 'os-term mc-scroll'); a.appendChild(term);
    var row = el('div', 'os-in'); a.appendChild(row);
    row.appendChild(el('span', null, '&gt;'));
    tin = el('input'); tin.autocapitalize = 'off'; tin.autocomplete = 'off'; tin.spellcheck = false; row.appendChild(tin);
    var go = el('button', 'os-btn', 'Enter'); row.appendChild(go);
    go.onclick = function () { runTerm(tin.value); tin.value = ''; };
    tin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runTerm(tin.value); tin.value = ''; } });
    tprint('BlockOS 1.0 - type "help"');
  }, function () { setTimeout(function () { tin.focus(); }, 50); });

  // Snake
  app('snake', '▦', 'Snake', function (a) {
    var cv = el('canvas'); cv.width = 240; cv.height = 240; cv.style.width = cv.style.height = 'min(240px,45vh)'; a.appendChild(cv);
    var info = el('div', null, 'Score: 0'); a.appendChild(info);
    var pad = el('div', 'os-row'); a.appendChild(pad);
    var dir = [1, 0], snake, food, timer, score;
    [['←', [-1, 0]], ['↑', [0, -1]], ['↓', [0, 1]], ['→', [1, 0]]].forEach(function (d) {
      var b = el('button', 'os-btn', d[0]); b.style.minWidth = '56px'; b.onclick = function () { setDir(d[1]); }; pad.appendChild(b);
    });
    function setDir(d) { if (d[0] !== -dir[0] || d[1] !== -dir[1]) dir = d; }
    a.tabIndex = 0;
    a.addEventListener('keydown', function (e) {
      var m = { ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowRight: [1, 0] }[e.key]; if (m) { e.preventDefault(); setDir(m); }
    });
    var g = cv.getContext('2d');
    function place() { food = [Math.floor(Math.random() * 20), Math.floor(Math.random() * 20)]; }
    function step() {
      var h = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] > 19 || h[1] > 19 || snake.some(function (p) { return p[0] === h[0] && p[1] === h[1]; })) {
        info.textContent = 'Game over! Score: ' + score + ' (tap Snake on Home to retry)'; clearInterval(timer); return;
      }
      snake.unshift(h);
      if (h[0] === food[0] && h[1] === food[1]) { score++; info.textContent = 'Score: ' + score; place(); } else snake.pop();
      g.fillStyle = '#000'; g.fillRect(0, 0, 240, 240);
      g.fillStyle = '#f33'; g.fillRect(food[0] * 12, food[1] * 12, 12, 12);
      g.fillStyle = '#5dff8f'; snake.forEach(function (p) { g.fillRect(p[0] * 12 + 1, p[1] * 12 + 1, 10, 10); });
    }
    apps.snake.start = function () { snake = [[10, 10], [9, 10], [8, 10]]; dir = [1, 0]; score = 0; info.textContent = 'Score: 0'; place(); clearInterval(timer); timer = setInterval(step, 140); a.focus(); stopFns.push(function () { clearInterval(timer); }); };
  });

  // Paint
  app('paint', '✎', 'Paint', function (a) {
    var cv = el('canvas'); cv.width = 32; cv.height = 32; cv.style.width = cv.style.height = 'min(256px,48vh)'; a.appendChild(cv);
    var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32);
    var pal = el('div', 'os-row'); a.appendChild(pal);
    var color = '#000';
    ['#000', '#fff', '#e33', '#f93', '#fe3', '#3c3', '#3af', '#36f', '#a3f', '#963', '#888'].forEach(function (c) {
      var b = el('button', 'os-btn'); b.style.background = c; b.style.width = '34px'; b.onclick = function () { color = c; }; pal.appendChild(b);
    });
    var clr = el('button', 'os-btn', 'Clear'); clr.onclick = function () { g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32); }; pal.appendChild(clr);
    var drawing = false;
    function paintAt(e) {
      var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
      var x = Math.floor((t.clientX - r.left) / r.width * 32), y = Math.floor((t.clientY - r.top) / r.height * 32);
      g.fillStyle = color; g.fillRect(x, y, 1, 1);
    }
    cv.addEventListener('mousedown', function (e) { drawing = true; paintAt(e); });
    cv.addEventListener('mousemove', function (e) { if (drawing) paintAt(e); });
    window.addEventListener('mouseup', function () { drawing = false; });
    cv.addEventListener('touchstart', function (e) { e.preventDefault(); drawing = true; paintAt(e); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); if (drawing) paintAt(e); }, { passive: false });
    cv.addEventListener('touchend', function () { drawing = false; });
  });

  // Notes
  app('notes', '☰', 'Notes', function (a) {
    var ta = el('textarea'); ta.placeholder = 'Write anything... (saved automatically)'; a.appendChild(ta);
    shield(ta);
    try { ta.value = localStorage.getItem('blockos_notes') || ''; } catch (e) {}
    ta.addEventListener('input', function () { try { localStorage.setItem('blockos_notes', ta.value); } catch (e) {} });
  });

  // Calculator
  app('calc', '±', 'Calculator', function (a) {
    var d = el('div', 'os-disp', '0'); a.appendChild(d);
    var grid = el('div', 'os-calc'); a.appendChild(grid);
    var expr = '';
    '7 8 9 / 4 5 6 * 1 2 3 - 0 . = + C'.split(' ').forEach(function (k) {
      var b = el('button', 'os-btn', k); grid.appendChild(b);
      b.onclick = function () {
        if (k === 'C') expr = '';
        else if (k === '=') { try { if (/^[0-9+\-*/. ]+$/.test(expr)) expr = String(Function('return (' + expr + ')')()); } catch (e) { expr = 'Error'; } }
        else { if (expr === 'Error') expr = ''; expr += k; }
        d.textContent = expr || '0';
      };
    });
  });

  // Jukebox: little original tunes with WebAudio
  var actx = null;
  function playTune(notes, tempo, wave) {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    var t = actx.currentTime + 0.05;
    notes.forEach(function (n) {
      if (n[0] > 0) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = wave; o.frequency.value = 440 * Math.pow(2, (n[0] - 69) / 12);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] * tempo * 0.95);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + n[1] * tempo);
      }
      t += n[1] * tempo;
    });
  }
  var TUNES = {
    'Blocky Morning': [[72,1],[76,1],[79,1],[76,1],[74,1],[77,1],[81,2],[79,1],[77,1],[76,1],[74,1],[72,3],[0,1],[67,1],[72,1],[76,1],[79,2],[84,3]],
    'Cave Echoes':   [[57,2],[60,1],[64,2],[62,1],[60,2],[57,3],[0,1],[55,2],[59,1],[62,2],[60,1],[59,2],[57,4]],
    'Creeper Panic': [[76,0.5],[75,0.5],[76,0.5],[75,0.5],[76,0.5],[71,0.5],[74,0.5],[72,0.5],[69,1],[0,0.5],[60,0.5],[64,0.5],[69,0.5],[71,1.5]],
    'Night Shift':   [[62,1.5],[65,0.5],[69,1],[67,1],[65,1],[64,1],[62,2],[0,1],[60,1],[64,1],[67,1],[65,3]]
  };
  app('music', '♫', 'Jukebox', function (a) {
    a.appendChild(el('div', null, 'Original tunes by BlockOS. Tap to play:'));
    var row = el('div', 'os-row'); a.appendChild(row);
    Object.keys(TUNES).forEach(function (n, i) {
      var b = el('button', 'os-btn', n); row.appendChild(b);
      b.onclick = function () { playTune(TUNES[n], i === 2 ? 0.16 : 0.24, ['square', 'triangle', 'sawtooth', 'sine'][i]); };
    });
  });

  // System info
  app('sys', '⚙', 'About', function (a) {
    a.appendChild(el('div', null, 'BlockOS 1.0<br>CPU: 1 redstone dust @ 4 ticks<br>RAM: 9 iron ingots<br>Storage: 1 chest (27 slots)<br>GPU: glass pane<br><br>Tip: the Terminal can run real game commands - type "help".'));
  });

  window.mcOpenComputer = function (x, y, z) { show(null); open(comp); };
})();

// ---------------- multiplayer (virtual UDP over a WebSocket relay) ----------------
(function () {
  'use strict';
  var LS = 'mcnet_host';
  function lsGet() { try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; } }
  function lsSet(v) { try { localStorage.setItem(LS, v); } catch (e) {} }
  function ipStr(n) { return (n & 255) + '.' + ((n >>> 8) & 255) + '.' + ((n >>> 16) & 255) + '.' + ((n >>> 24) & 255); }
  function ipParse(s) { var p = s.split('.'); return ((+p[0]) | (+p[1] << 8) | (+p[2] << 16) | (+p[3] << 24)) >>> 0; }

  var N = window.MCNet = {
    ws: null, myIp: 0, socks: {}, nextId: 1, nextPort: 40000, host: '', online: 0,
    state: 'off', retry: null, listeners: [],
    ipNum: function () { return (N.myIp || 0x0100007f) >>> 0; },
    bind: function (port) {
      if (!port) port = N.nextPort++;
      var id = N.nextId++; N.socks[id] = { port: port, q: [] };
      return id;
    },
    port: function (id) { var s = N.socks[id]; return s ? s.port : 0; },
    close: function (id) { delete N.socks[id]; },
    deliver: function (ip, srcPort, dstPort, data) {
      for (var k in N.socks) { var s = N.socks[k]; if (s.port === dstPort && s.q.length < 4000) s.q.push({ ip: ip, port: srcPort, data: data }); }
    },
    send: function (id, ip, port, data) {
      var s = N.socks[id]; if (!s) return -1;
      if ((ip & 255) === 127 || (N.myIp && ip === N.myIp)) { N.deliver(N.ipNum(), s.port, port, data); return data.length; }
      if (!N.ws || N.ws.readyState !== 1) return data.length; // dropped, like real UDP
      var b = new Uint8Array(8 + data.length);
      b[0] = ip & 255; b[1] = (ip >>> 8) & 255; b[2] = (ip >>> 16) & 255; b[3] = (ip >>> 24) & 255;
      b[4] = port >> 8; b[5] = port & 255; b[6] = s.port >> 8; b[7] = s.port & 255;
      b.set(data, 8);
      try { N.ws.send(b); } catch (e) {}
      return data.length;
    },
    recv: function (id) { var s = N.socks[id]; return (s && s.q.length) ? s.q.shift() : null; },
    defaultHost: function () {
      var saved = lsGet(); if (saved) return saved;
      if (/^https?:$/.test(location.protocol) && location.host) return location.host;
      return '';
    },
    notify: function () { N.listeners.forEach(function (f) { try { f(); } catch (e) {} }); },
    connect: function (host, manual) {
      host = (host || '').trim().replace(/^(https?|wss?):\/\//, '').replace(/\/.*$/, '');
      if (!host) return;
      if (host.indexOf(':') < 0) host += ':8080';
      if (manual) lsSet(host);
      if (N.ws) { try { N.ws.onclose = null; N.ws.close(); } catch (e) {} N.ws = null; }
      clearTimeout(N.retry);
      N.host = host; N.state = 'connecting'; N.myIp = 0; N.notify();
      var ws;
      try { ws = new WebSocket('ws://' + host + '/relay'); } catch (e) { N.state = 'error'; N.notify(); return; }
      ws.binaryType = 'arraybuffer'; N.ws = ws;
      ws.onmessage = function (ev) {
        if (typeof ev.data === 'string') {
          var m = ev.data.split(' ');
          if (m[0] === 'IP') { N.myIp = ipParse(m[1]); N.state = 'on'; }
          if (m[0] === 'COUNT') N.online = +m[1];
          N.notify(); return;
        }
        var u = new Uint8Array(ev.data); if (u.length < 8) return;
        var ip = (u[0] | (u[1] << 8) | (u[2] << 16) | (u[3] << 24)) >>> 0;
        N.deliver(ip, (u[4] << 8) | u[5], (u[6] << 8) | u[7], u.slice(8));
      };
      ws.onclose = function () {
        if (N.ws !== ws) return;
        N.ws = null; N.myIp = 0; N.state = 'off'; N.notify();
        N.retry = setTimeout(function () { N.connect(N.host); }, 5000);
      };
    },
    status: function () {
      if (N.state === 'on') return 'Connected to ' + N.host + '  -  your game address is ' + ipStr(N.myIp) + (N.online ? '  -  ' + N.online + ' device(s) online' : '');
      if (N.state === 'connecting') return 'Connecting to ' + N.host + ' ...';
      if (N.host) return 'Not connected (can’t reach ' + N.host + ' - retrying)';
      return 'Not connected. Type the address shown in the "Play Modded" window on the PC.';
    }
  };
  var h0 = N.defaultHost(); if (h0) N.connect(h0);

  // ---- UI ----
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var o = el('div', 'mc-overlay mc-ui');
  ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'wheel', 'click', 'keydown', 'keyup', 'keypress'].forEach(function (t) { o.addEventListener(t, function (e) { e.stopPropagation(); }); });
  document.body.appendChild(o);
  var p = el('div', 'mc-panel'); o.appendChild(p);
  p.appendChild(el('h2', null, 'Multiplayer'));
  var sc = el('div', 'mc-scroll'); p.appendChild(sc);
  var stat = el('div', 'mc-out'); sc.appendChild(stat);
  sc.appendChild(el('div', 'mc-note', 'Your player name:'));
  var nrow = el('div', 'mc-row'); sc.appendChild(nrow);
  var nin = el('input', 'mc-input'); nin.maxLength = 16; nin.placeholder = 'Steve'; nin.autocapitalize = 'off'; nin.spellcheck = false; nrow.appendChild(nin);
  var nset = el('button', 'mc-btn small', 'Save name'); nrow.appendChild(nset);
  nset.onclick = function () { var v = nin.value.trim() || 'Steve'; try { localStorage.setItem('mcnet_name', v); } catch (e) {} applyName(v); nset.textContent = 'Saved!'; setTimeout(function () { nset.textContent = 'Save name'; }, 1200); };
  sc.appendChild(el('div', 'mc-note', 'PC address (shown in the black "Play Modded" window):'));
  var row = el('div', 'mc-row'); sc.appendChild(row);
  var inp = el('input', 'mc-input'); inp.placeholder = 'e.g. 192.168.1.20:8080'; inp.autocapitalize = 'off'; inp.spellcheck = false; row.appendChild(inp);
  var go = el('button', 'mc-btn green small', 'Connect'); row.appendChild(go);
  go.onclick = function () { N.connect(inp.value, true); };
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); N.connect(inp.value, true); } });
  sc.appendChild(el('div', 'mc-note', '<b>How to play together</b><br>1. On the PC, run <b>Play Modded.bat</b> and keep its window open.<br>' +
    '2. Every device (PC and phones) must be on the same Wi-Fi and show <b>Connected</b> here.<br>' +
    '3. The host opens a world (Start Game). Everyone else taps <b>Join Game</b> on the main menu and picks the host.<br>' +
    'If a phone can’t connect from the HTML app, open <b>http://&lt;PC address&gt;</b> in Safari instead.'));
  var done = el('button', 'mc-btn', 'Done'); p.appendChild(done);
  done.onclick = function () { o.style.display = 'none'; window.mcMenuOpen = false; };
  function paint() { stat.textContent = N.status(); stat.style.color = N.state === 'on' ? '#8f8' : '#ffdd77'; }
  N.listeners.push(paint);
  function applyName(v) {
    var M = window.Module; if (!M || !M._mc_name_set || !M._malloc || !M.stringToUTF8) return 0;
    var len = M.lengthBytesUTF8(v) + 1, ptr = M._malloc(len); M.stringToUTF8(v, ptr, len);
    var r = M._mc_name_set(ptr); M._free(ptr); return r;
  }
  function savedName() { try { return localStorage.getItem('mcnet_name') || ''; } catch (e) { return ''; } }
  var nameTimer = setInterval(function () { var v = savedName(); if (!v) { clearInterval(nameTimer); return; } try { if (applyName(v)) clearInterval(nameTimer); } catch (e) {} }, 1000);
  window.mcOpenMultiplayer = function () {
    inp.value = N.host || N.defaultHost(); nin.value = savedName(); paint();
    window.mcMenuOpen = true; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
    o.style.display = 'flex';
  };
})();

// ---------------- sign editor ----------------
(function () {
  'use strict';
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var o = el('div', 'mc-overlay mc-ui');
  ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'wheel', 'click', 'keydown', 'keyup', 'keypress'].forEach(function (t) { o.addEventListener(t, function (e) { e.stopPropagation(); }); });
  document.body.appendChild(o);
  var p = el('div', 'mc-panel'); p.style.width = 'min(380px,92vw)'; o.appendChild(p);
  p.appendChild(el('h2', null, 'Edit Sign'));
  var board = el('div'); board.style.cssText = 'background:#a0783c;border:3px solid #5a3d14;padding:10px;display:flex;flex-direction:column;gap:6px';
  p.appendChild(board);
  var lines = [];
  for (var i = 0; i < 4; i++) {
    var inp = el('input', 'mc-input'); inp.maxLength = 15; inp.style.cssText = 'text-align:center;background:#c79a55;color:#000;border:2px solid #5a3d14;font-family:monospace;font-size:17px';
    inp.autocapitalize = 'off'; inp.spellcheck = false;
    (function (i) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (i < 3) lines[i + 1].focus(); else done(); } }); })(i);
    board.appendChild(inp); lines.push(inp);
  }
  var b = el('button', 'mc-btn green', 'Done'); p.appendChild(b);
  function done() {
    var M = window.Module, t = lines.map(function (l) { return l.value.replace(/[^\x20-\x7e]/g, ''); }).join('\n');
    if (M && M._mc_sign_done && M._malloc) { var n = M.lengthBytesUTF8(t) + 1, ptr = M._malloc(n); M.stringToUTF8(t, ptr, n); M._mc_sign_done(ptr); M._free(ptr); }
    o.style.display = 'none'; window.mcMenuOpen = false;
  }
  b.onclick = done;
  window.mcOpenSign = function (text) {
    var parts = (text || '').split('\n');
    lines.forEach(function (l, i) { l.value = parts[i] || ''; });
    window.mcMenuOpen = true; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
    o.style.display = 'flex'; setTimeout(function () { lines[0].focus(); }, 60);
  };
})();

// ---------------- "Quit and copy map" name box ----------------
(function () {
  'use strict';
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var o = el('div', 'mc-overlay mc-ui');
  ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'wheel', 'click', 'keydown', 'keyup', 'keypress'].forEach(function (t) { o.addEventListener(t, function (e) { e.stopPropagation(); }); });
  document.body.appendChild(o);
  var p = el('div', 'mc-panel'); p.style.width = 'min(380px,92vw)'; o.appendChild(p);
  p.appendChild(el('h2', null, 'Save a copy of this world'));
  p.appendChild(el('div', 'mc-note', 'The copy appears in your world list.'));
  var inp = el('input', 'mc-input'); inp.maxLength = 30; p.appendChild(inp);
  var row = el('div', 'mc-row'); p.appendChild(row);
  var ok = el('button', 'mc-btn green', 'Save copy'), no = el('button', 'mc-btn', 'Don’t save');
  row.appendChild(ok); row.appendChild(no);
  function finish(save) {
    var M = window.Module, v = inp.value.trim() || 'Copied world';
    if (M && M._mc_rename_done) { var n = M.lengthBytesUTF8(v) + 1, ptr = M._malloc(n); M.stringToUTF8(v, ptr, n); M._mc_rename_done(save ? 1 : 0, ptr); M._free(ptr); }
    o.style.display = 'none'; window.mcMenuOpen = false;
  }
  ok.onclick = function () { finish(true); };
  no.onclick = function () { finish(false); };
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); finish(true); } });
  window.mcOpenCopyMap = function () {
    inp.value = 'Copied world';
    window.mcMenuOpen = true; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
    o.style.display = 'flex'; setTimeout(function () { inp.focus(); inp.select(); }, 60);
  };
})();

// ---------------- text box for the classic game screens ----------------
// The game draws the box and the text; this invisible input sits on top of it
// so tapping it brings up the phone keyboard (and typing works on a PC).
(function () {
  'use strict';
  var el = null, submitted = false, rect = null;
  function make() {
    el = document.createElement('input');
    el.type = 'text'; el.className = 'mc-ui';
    el.autocapitalize = 'sentences'; el.autocomplete = 'off'; el.spellcheck = false;
    el.style.cssText = 'position:fixed;z-index:25;opacity:0.01;font-size:16px;border:0;padding:0;margin:0;background:transparent;color:transparent;caret-color:transparent;outline:none';
    ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click'].forEach(function (t) {
      el.addEventListener(t, function (e) { e.stopPropagation(); if (t === 'keydown' && e.key === 'Enter') { e.preventDefault(); submitted = true; el.blur(); } });
    });
    document.body.appendChild(el);
  }
  function position() {
    if (!el || !rect) return;
    var c = document.getElementById('canvas'), r = c.getBoundingClientRect();
    var sx = r.width / rect[4], sy = r.height / rect[5];
    el.style.left = (r.left + rect[0] * sx) + 'px'; el.style.top = (r.top + rect[1] * sy) + 'px';
    el.style.width = (rect[2] * sx) + 'px'; el.style.height = (rect[3] * sy) + 'px';
  }
  window.addEventListener('resize', position);
  window.mcTextField = {
    open: function (x, y, w, h, gw, gh, text, max) {
      if (!el) make();
      rect = [x, y, w, h, gw, gh]; position();
      el.maxLength = max || 32; el.value = text || ''; submitted = false;
      el.style.display = 'block';
      try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {}
      setTimeout(function () { try { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }, 50);
    },
    place: function (x, y, w, h, gw, gh) { rect = [x, y, w, h, gw, gh]; position(); },
    get: function () { return el && el.style.display !== 'none' ? el.value : ''; },
    takeSubmit: function () { var s = submitted; submitted = false; return s; },
    close: function () { if (el) { el.blur(); el.style.display = 'none'; } rect = null; }
  };
})();
