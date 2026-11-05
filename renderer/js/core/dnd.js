/* Pointer-based drag & drop. It does not rely on HTML5 drag events, so it also works in webviews
   where the native file-drop handler swallows them (this was the "can't drag onto canvas" bug). */
(function () {
  const targets = new Set();
  let ghost = null, hover = null;

  function targetAt(x, y, payload) {
    for (const el of document.elementsFromPoint(x, y)) {
      for (const t of targets) if (t.el === el || t.el.contains(el)) { if (!t.accept || t.accept(payload)) return t; }
    }
    return null;
  }

  VX.dnd = {
    /** Make `el` start a drag when the user presses and moves. `payload()` returns the data handed to the drop target. */
    draggable(el, payload, label) {
      el.classList.add('vx-draggable');
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY; let started = false, data = null;
        const move = (ev) => {
          if (!started) {
            if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
            started = true; data = typeof payload === 'function' ? payload() : payload;
            ghost = VX.h('div', { class: 'dnd-ghost' }, label || el.textContent.trim()); document.body.append(ghost);
            document.body.classList.add('dnd-active');
          }
          ghost.style.left = ev.clientX + 12 + 'px'; ghost.style.top = ev.clientY + 12 + 'px';
          const t = targetAt(ev.clientX, ev.clientY, data);
          if (hover && (!t || hover !== t)) hover.el.classList.remove('drop-hover');
          hover = t; if (t) t.el.classList.add('drop-hover');
        };
        const up = (ev) => {
          removeEventListener('mousemove', move, true); removeEventListener('mouseup', up, true);
          if (!started) return;
          ghost && ghost.remove(); ghost = null; document.body.classList.remove('dnd-active');
          if (hover) hover.el.classList.remove('drop-hover'); hover = null;
          const t = targetAt(ev.clientX, ev.clientY, data);
          if (t) { ev.preventDefault(); t.drop(data, ev.clientX, ev.clientY); }
          const swallow = (c) => { c.stopPropagation(); c.preventDefault(); }; // don't also fire the palette item's click
          addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => removeEventListener('click', swallow, true), 0);
        };
        addEventListener('mousemove', move, true); addEventListener('mouseup', up, true);
      });
    },
    /** Drag-to-reorder for a row/column of items (tabs, panel tabs, activity icons). Pointer based, one delegated listener, survives re-renders.
        opts: { item: '.tab', id: (el) => key, onMove(fromId, toId, after), vertical, ignore: '.x' } */
    sortable(box, opts) {
      if (box.__vxSort) return; box.__vxSort = true; const vertical = !!opts.vertical;
      box.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; const src = e.target.closest(opts.item); if (!src || !box.contains(src) || (opts.ignore && e.target.closest(opts.ignore))) return;
        const sx = e.clientX, sy = e.clientY, fromId = opts.id(src); let started = false, mark = null, overId = null, after = false, gh = null;
        const clear = () => { box.querySelectorAll('.drop-before,.drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after')); };
        const move = (ev) => {
          if (!started) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return; started = true; src.classList.add('sorting'); document.body.classList.add('dnd-active'); gh = VX.h('div', { class: 'dnd-ghost' }, src.textContent.trim() || opts.id(src)); document.body.append(gh); }
          gh.style.left = ev.clientX + 12 + 'px'; gh.style.top = ev.clientY + 12 + 'px';
          if (vertical) { const r = box.getBoundingClientRect(); if (ev.clientY < r.top + 24) box.scrollTop -= 12; else if (ev.clientY > r.bottom - 24) box.scrollTop += 12; } else { const r = box.getBoundingClientRect(); if (ev.clientX < r.left + 30) box.scrollLeft -= 14; else if (ev.clientX > r.right - 30) box.scrollLeft += 14; }
          clear(); overId = null; let hit = null;
          for (const n of box.querySelectorAll(opts.item)) { const r = n.getBoundingClientRect(); if (n !== src && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) { hit = n; after = vertical ? ev.clientY > r.top + r.height / 2 : ev.clientX > r.left + r.width / 2; break; } }
          if (!hit) { /* past either end of the row → first / last item */ const all = [...box.querySelectorAll(opts.item)].filter((n) => n !== src); if (all.length) { const f = all[0].getBoundingClientRect(), l = all[all.length - 1].getBoundingClientRect(); if (vertical ? ev.clientY < f.top : ev.clientX < f.left) { hit = all[0]; after = false; } else if (vertical ? ev.clientY > l.bottom : ev.clientX > l.right) { hit = all[all.length - 1]; after = true; } } }
          if (hit) { overId = opts.id(hit); hit.classList.add(after ? 'drop-after' : 'drop-before'); }
        };
        const up = () => {
          removeEventListener('mousemove', move, true); removeEventListener('mouseup', up, true); if (!started) return;
          gh && gh.remove(); src.classList.remove('sorting'); document.body.classList.remove('dnd-active'); clear();
          const swallow = (c) => { c.stopPropagation(); c.preventDefault(); }; addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => removeEventListener('click', swallow, true), 0);
          if (overId !== null && overId !== fromId) opts.onMove(fromId, overId, after);
        };
        addEventListener('mousemove', move, true); addEventListener('mouseup', up, true);
      });
    },
    /** Register a drop target. drop(payload, clientX, clientY). Returns an unregister function. */
    target(el, drop, accept) { const t = { el, drop, accept }; targets.add(t); return () => targets.delete(t); },
    prune() { for (const t of [...targets]) if (!document.body.contains(t.el)) targets.delete(t); },
  };
})();
