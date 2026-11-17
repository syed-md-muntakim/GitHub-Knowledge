(() => {
  const $ = s => document.querySelector(s);
  const main = $("#main"), content = $("#content"), search = $("#search");
  const root = document.documentElement;

  /* ---------- Theme ---------- */
  const themeBtn = $("#themeBtn");
  const setTheme = t => {
    root.dataset.theme = t;
    themeBtn.textContent = t === "dark" ? "☀ Light" : "☾ Dark";
    try { localStorage.setItem("gk-theme", t); } catch (e) {}
  };
  let saved = "dark";
  try { saved = localStorage.getItem("gk-theme") || "dark"; } catch (e) {}
  setTheme(saved);
  themeBtn.onclick = () => setTheme(root.dataset.theme === "dark" ? "light" : "dark");

  /* ---------- Build content ---------- */
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const copyText = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const t = el("textarea"); t.value = text; document.body.appendChild(t);
      t.select(); document.execCommand("copy"); t.remove();
    }
    btn.textContent = "Copied"; btn.classList.add("done");
    setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1200);
  };

  const lines = []; // {node, text, sec}
  const secNodes = [];

  SECTIONS.forEach(s => {
    const sec = el("section", "section"); sec.id = s.id;
    const h = el("h3", null, s.title); sec.appendChild(h);
    if (s.note) sec.appendChild(el("p", "note", s.note));
    const code = el("div", "code");
    s.cmds.forEach(c => {
      const line = el("div", "line");
      if (typeof c === "string") {
        line.classList.add("comment"); line.textContent = c;
        line.dataset.keep = "1";
      } else {
        line.classList.add("clickable");
        const cmd = el("span", "cmd", c[0]);
        line.append(cmd, el("span", "gap"));
        if (c[1]) line.appendChild(el("span", "cm", "# " + c[1]));
        const btn = el("button", "copy", "Copy"); btn.type = "button";
        btn.onclick = e => { e.stopPropagation(); copyText(c[0], btn); };
        line.onclick = () => copyText(c[0], btn);
        line.appendChild(btn);
        lines.push({ node: line, cmd, cm: line.querySelector(".cm"), text: (c[0] + " " + (c[1] || "")).toLowerCase(), raw: c, sec: sec });
      }
      code.appendChild(line);
    });
    sec.appendChild(code);
    if (s.warn) sec.appendChild(el("p", "warn", s.warn));
    if (s.extra) {
      sec.appendChild(el("p", "note", s.extra[0]));
      const ul = el("ul"); s.extra.slice(1).forEach(t => ul.appendChild(el("li", null, t)));
      sec.appendChild(ul);
    }
    (s.images || []).forEach(im => {
      const f = el("figure"); const i = el("img"); i.src = im.src; i.alt = im.alt || ""; i.loading = "lazy";
      f.appendChild(i); if (im.alt) f.appendChild(el("figcaption", null, im.alt)); sec.appendChild(f);
    });
    content.appendChild(sec);
    secNodes.push({ node: sec, title: s.title.toLowerCase(), data: s });
  });

  /* ---------- Sidebars ---------- */
  const scrollToSection = id => {
    const t = document.getElementById(id); if (!t) return;
    if (t.hidden) { search.value = ""; runSearch(); }
    main.scrollTo({ top: t.offsetTop - content.offsetTop - 4, behavior: "smooth" });
    closeDrawers();
  };
  const sectionList = $("#sectionList"), navLinks = {};
  SECTIONS.filter(s => !s.help).forEach(s => {
    const a = el("a", null, s.title); a.href = "#" + s.id;
    a.onclick = e => { e.preventDefault(); scrollToSection(s.id); };
    sectionList.appendChild(a); navLinks[s.id] = a;
  });
  HELP.forEach(h => {
    const a = el("a", null, h.label);
    if (h.url) { a.href = h.url; a.target = "_blank"; a.rel = "noopener"; }
    else { a.href = "#" + h.section; a.onclick = e => { e.preventDefault(); scrollToSection(h.section); }; }
    $("#helpList").appendChild(a);
  });
  $("#brand").onclick = e => { e.preventDefault(); main.scrollTo({ top: 0, behavior: "smooth" }); };

  /* Active section highlight */
  main.addEventListener("scroll", () => {
    let cur = null;
    secNodes.forEach(s => { if (!s.node.hidden && s.node.offsetTop - content.offsetTop - 20 <= main.scrollTop) cur = s.data.id; });
    Object.entries(navLinks).forEach(([id, a]) => a.classList.toggle("active", id === cur));
  }, { passive: true });

  /* ---------- Search ---------- */
  const highlight = (node, q, text) => {
    node.textContent = "";
    const i = q ? text.toLowerCase().indexOf(q) : -1;
    if (i < 0) { node.textContent = text; return; }
    node.append(text.slice(0, i));
    const m = el("mark", null, text.slice(i, i + q.length)); node.appendChild(m);
    node.append(text.slice(i + q.length));
  };
  function runSearch() {
    const q = search.value.trim().toLowerCase();
    let any = false;
    secNodes.forEach(s => {
      const titleHit = q && s.title.includes(q);
      let hits = 0;
      lines.filter(l => l.sec === s.node).forEach(l => {
        const hit = !q || titleHit || l.text.includes(q);
        l.node.hidden = !hit; if (hit) hits++;
        highlight(l.cmd, q, l.raw[0]);
        if (l.cm) highlight(l.cm, q, "# " + l.raw[1]);
      });
      s.node.querySelectorAll(".line.comment").forEach(c => c.hidden = !!q && !hits);
      const noteHit = q && (s.data.note || "").toLowerCase().includes(q);
      const show = !q || titleHit || hits > 0 || noteHit;
      s.node.hidden = !show; if (show) any = true;
    });
    $("#empty").hidden = any;
    main.scrollTop = 0;
  }
  search.addEventListener("input", runSearch);
  document.addEventListener("keydown", e => {
    if ((e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) && document.activeElement !== search) {
      e.preventDefault(); search.focus();
    } else if (e.key === "Escape" && document.activeElement === search) { search.value = ""; runSearch(); search.blur(); }
  });

  /* ---------- Mobile drawers ---------- */
  const left = $("#leftBar"), right = $("#rightBar"), scrim = $("#scrim");
  function closeDrawers() { left.classList.remove("open"); right.classList.remove("open"); scrim.classList.remove("show"); }
  const openDrawer = d => { const was = d.classList.contains("open"); closeDrawers(); if (!was) { d.classList.add("open"); scrim.classList.add("show"); } };
  $("#menuBtn").onclick = () => openDrawer(left);
  $("#helpBtn").onclick = () => openDrawer(right);
  scrim.onclick = closeDrawers;
})();
