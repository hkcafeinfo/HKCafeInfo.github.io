(() => {
  "use strict";
  const data = window.MAID_ROSTERS;
  const $ = (id) => document.getElementById(id);
  const matrix = $("roster-matrix");
  const viewport = $("matrix-viewport");
  function normalizedInstagramHandle(value) {
    let handle = String(value || "").trim().replace(/^@+/, "");
    if (!handle) return "";
    if (/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i.test(handle)) {
      try {
        const url = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`);
        handle = url.pathname.split("/").filter(Boolean)[0] || "";
      } catch { return ""; }
    }
    return handle.replace(/^@+/, "").replace(/[/?#].*$/, "").trim().toLocaleLowerCase();
  }
  if (!data || !Array.isArray(data.shops)) {
    matrix.textContent = "讀唔到更表資料。請確認 data/rosters.js 同 index.html 放喺原本嘅資料夾結構。";
    return;
  }
  const rosterDates = [...new Set(data.shops.flatMap((shop) => [
    ...(shop.shifts || []).map((shift) => shift.date),
    ...(shop.unresolved || []).map((item) => item.date),
    ...(shop.date_notices || []).map((item) => item.date),
  ]))].sort();
  // Keep calendar days with no published roster visible as empty columns. This
  // makes gaps such as 6/11 explicit instead of making the table look incomplete.
  const dates = rosterDates.length ? (() => {
    const result = [];
    const cursor = new Date(`${rosterDates[0]}T12:00:00Z`);
    const end = new Date(`${rosterDates.at(-1)}T12:00:00Z`);
    while (cursor <= end) {
      result.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  })() : [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone || "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const isReload = performance.getEntriesByType("navigation")[0]?.type === "reload";
  const saved = (() => { if (!isReload) return {}; try { return JSON.parse(sessionStorage.getItem("hkcafeinfo-matrix-v1") || "{}"); } catch { return {}; } })();
  const state = { across: saved.across === "shops" ? "shops" : "dates", range: saved.range === "all" ? "all" : "future", search: saved.search || "", person: saved.person || null, focusTarget: null };
  let focusTodayOnNextRender = state.across === "dates";
  let firstRender = true;
  function persist() { try { sessionStorage.setItem("hkcafeinfo-matrix-v1", JSON.stringify({ ...state, scrollLeft: viewport.scrollLeft })); } catch { /* optional */ } }
  viewport.addEventListener("scroll", () => { persist(); updateSticky(); }, { passive: true });
  const sticky = makeSticky();
  function makeSticky() {
    const node = document.createElement("div"); node.className = "matrix-sticky-header"; node.setAttribute("aria-hidden", "true");
    document.body.append(node); return node;
  }
  function updateSticky() {
    const header = matrix.querySelector(".matrix-header");
    if (!header || $("matrix-view").hidden) { sticky.hidden = true; return; }
    const bounds = viewport.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    const height = headerBounds.height;
    const top = Math.max(0, document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0);
    sticky.style.top = `${top}px`;
    const visible = headerBounds.top <= top && bounds.bottom > top + height;
    sticky.hidden = !visible;
    if (!visible) return;
    sticky.style.left = `${bounds.left}px`; sticky.style.width = `${bounds.width}px`; sticky.style.height = `${height}px`;
    let copy = sticky.firstElementChild;
    if (!copy || copy.dataset.originalWidth !== String(header.getBoundingClientRect().width)) {
      copy = header.cloneNode(true);
      copy.inert = true;
      copy.dataset.originalWidth = String(header.getBoundingClientRect().width);
      copy.style.gridTemplateColumns = getComputedStyle(header).gridTemplateColumns;
      copy.style.width = `${header.getBoundingClientRect().width}px`;
      sticky.replaceChildren(copy);
    }
    copy.style.transform = `translateX(${-viewport.scrollLeft}px)`;
    if (copy.firstElementChild) copy.firstElementChild.style.transform = `translateX(${viewport.scrollLeft}px)`;
  }
  window.addEventListener("scroll", updateSticky, { passive: true });
  window.addEventListener("resize", () => { sticky.replaceChildren(); updateSticky(); });

  function make(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function dateLabel(date) {
    const value = new Date(`${date}T12:00:00Z`);
    return {
      day: new Intl.DateTimeFormat("zh-HK", { timeZone: "UTC", month: "numeric", day: "numeric" }).format(value),
      weekday: new Intl.DateTimeFormat("zh-HK", { timeZone: "UTC", weekday: "short" }).format(value),
    };
  }
  function instagramUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "www.instagram.com" ? url.href : null;
    } catch { return null; }
  }
  function sourceLink(shop, override) {
    const url = instagramUrl(override || shop.source);
    if (!url) return null;
    const link = make("a", "matrix-source", "來源 ↗");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }
  function includesPerson(shop, date) {
    const shift = (shop.shifts || []).find((item) => item.date === date);
    return Boolean(shift && shop.shop.toLocaleLowerCase().includes(state.search)) || Object.values(shift?.groups || {}).some((names) => names.some((name) => name.toLocaleLowerCase().includes(state.search)));
  }
  function visible() {
    let shownDates = dates;
    if (state.range !== "all") shownDates = shownDates.filter((date) => date >= today);
    let shops = data.shops.filter((shop) => state.search || shop.shop === state.focusTarget?.shop || window.MAID_VISIBLE_SHOPS?.has(shop.shop));
    if (state.search && !state.person) {
      shownDates = shownDates.filter((date) => shops.some((shop) => includesPerson(shop, date)));
      shops = shops.filter((shop) => shownDates.some((date) => includesPerson(shop, date)));
    }
    return { shownDates, shops };
  }
  function shopHours(shop) {
    const hours = make("div", "matrix-opening-hours");
    hours.append(make("span", "hours-heading", "營業時間"));
    for (const line of (shop.opening_hours || "常規營業時間待確認").split("\n")) hours.append(make("span", "hours-line", line));
    return hours;
  }
  function rowHead(label, subtitle, profile, photo, shop) {
    const node = make("div", "matrix-rowhead");
    node.setAttribute("role", "rowheader");
    const url = instagramUrl(profile);
    const title = make(url ? "a" : "strong", "rowhead-title", label);
    if (url) { title.href = url; title.target = "_blank"; title.rel = "noopener noreferrer"; }
    if (photo) { const img = make("img", "shop-profile-photo"); img.src = photo; img.alt = ""; node.append(img); }
    node.append(title);
    if (url) { const ig = make("a", "shop-ig", HKCI.handle(url)); ig.href = url; ig.target = "_blank"; ig.rel = "noopener noreferrer"; node.append(ig); }
    node.append(shop ? HKCI.addressLink(shop, "rowhead-subtitle") : make("span", "rowhead-subtitle", subtitle));
    if (shop) node.append(shopHours(shop));
    return node;
  }
  function columnHead(label, subtitle, active, photo, profile, shop) {
    const node = make("div", `matrix-colhead${active ? " is-today" : ""}`);
    node.setAttribute("role", "columnheader");
    if (photo) { const img = make("img", "shop-profile-photo"); img.src = photo; img.alt = ""; node.append(img); }
    node.append(make("strong", null, label));
    const url = HKCI.instagram(profile);
    if (url) { const ig = make("a", "shop-ig", HKCI.handle(url)); ig.href = url; ig.target = "_blank"; ig.rel = "noopener noreferrer"; node.append(ig); }
    node.append(shop ? HKCI.addressLink(shop) : make("span", null, subtitle));
    if (shop) node.append(shopHours(shop));
    return node;
  }
  function cell(shop, date) {
    const node = make("div", "matrix-cell");
    node.setAttribute("role", "cell");
    node.dataset.shop = shop.shop;
    node.dataset.date = date;
    const shift = (shop.shifts || []).find((item) => item.date === date);
    const unresolved = (shop.unresolved || []).find((item) => item.date === date);
    if (shift) {
      HKCI.eventArt(data, shop, shift, node);
      if (shift.event_name) node.append(make("strong", "matrix-event-name", shift.event_name));
      let count = 0;
      for (const [, roleGroups] of HKCI.orderedRoleGroups(shift.groups, shop.shop)) {
        for (const [role, names] of roleGroups) {
        const people = state.search ? names.filter((name) => HKCI.displayName(name).toLocaleLowerCase().includes(state.search)) : names;
        if (!people.length) continue;
        count += people.length;
        const group = make("div", "matrix-role");
        group.append(make("span", "matrix-role-label", role));
        const tags = make("div", "matrix-people");
        for (const name of people) {
          const tag = make("button", `matrix-person${shift.review_names?.[name] ? " needs-review" : ""}`, HKCI.displayName(name));
          tag.type = "button";
          if (shift.person_times?.[name]) tag.append(make("small", "person-time", HKCI.formatPersonTimes(shift.person_times[name])));
          tag.addEventListener("click", () => window.dispatchEvent(new CustomEvent("hkcafeinfo:person", { detail: { shop: shop.shop, name } })));
          if (shift.review_names?.[name]) tag.title = shift.review_names[name];
          tags.append(tag);
        }
        group.append(tags);
        node.append(group);
        }
      }
      if (count) {
        node.classList.add("matrix-cell-roster");
        if (shift.notes && !shift.notes.includes("貼文列出日程，時段為當日營業時間，個別人員更期未逐一註明")) node.append(make("p", "matrix-note", shift.notes));
        const foot = make("div", "matrix-cell-foot");
        foot.append(make("span", null, shift.hours || "時間未註明"));
        const link = sourceLink(shop, shift.source);
        if (link) foot.append(link);
        node.append(foot);
      } else { node.classList.add("matrix-cell-empty"); node.append(make("span", "matrix-empty-copy", "—")); }
    } else if (unresolved && !state.search) {
      node.classList.add("matrix-cell-pending");
      node.append(make("strong", "matrix-status", "待核對名單"), make("p", "matrix-status-copy", unresolved.reason));
      const link = sourceLink(shop, unresolved.source);
      if (link) node.append(link);
    } else {
      node.classList.add("matrix-cell-empty");
      const closed = HKCI.closed(shop, date);
      const dated = HKCI.dateNotice(shop, date);
      if (dated) node.append(HKCI.dateNoticeView(dated));
      else if (closed) node.append(HKCI.closedNotice(shop));
      else node.append(make("span", "matrix-empty-symbol", "—"), make("span", "matrix-empty-copy", "未找到更表"));
      if (shop.notice && !closed && !dated) {
        node.title = shop.notice;
        const link = sourceLink(shop);
        if (link) node.append(link);
      }
    }
    return node;
  }
  function render() {
    for (const button of $("date-range").querySelectorAll("[data-range]")) {
      const active = button.dataset.range === state.range;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    const previousScroll = firstRender ? (saved.scrollLeft || 0) : viewport.scrollLeft;
    firstRender = false;
    const personMode = Boolean(state.search || state.person);
    document.body.classList.toggle("person-search-mode", personMode && !$("matrix-view").hidden);
    $("matrix-view").classList.toggle("people-card-view", personMode);
    $("person-back").hidden = !personMode;
    const { shownDates, shops } = visible();
    if (state.search || state.person) {
      matrix.replaceChildren();
      matrix.removeAttribute("role");
      const groups = new Map();
      for (const shop of data.shops) for (const shift of shop.shifts || []) {
        if (state.range !== "all" && shift.date < today) continue;
        for (const [role, names] of Object.entries(shift.groups || {})) for (const name of names) {
          if (state.person && HKCI.identityKey(data, shop.shop, name) !== HKCI.identityKey(data, state.person.shop, state.person.name)) continue;
          if (!state.person && !shop.shop.toLocaleLowerCase().includes(state.search) && !HKCI.displayName(name).toLocaleLowerCase().includes(state.search)) continue;
          const key = HKCI.identityKey(data, shop.shop, name);
          if (!groups.has(key)) groups.set(key, { shop, name, personId: data.person_accounts?.[shop.shop]?.[name]?.person_id || data.people?.[name]?.person_id || "", shifts: [], shops: new Set() });
          if (groups.get(key).name === groups.get(key).name.toLocaleUpperCase() && name !== name.toLocaleUpperCase()) groups.get(key).name = name;
          groups.get(key).shops.add(shop.shop);
          const attendance = shift.attendance_records?.find((record) => record.name === name && record.role === role);
          if (!groups.get(key).shifts.some((item) => item.shop.shop === shop.shop && item.shift === shift && item.role === role)) {
            groups.get(key).shifts.push({ shop, shift, role, attendanceType: attendance?.type || "當值" });
          }
        }
      }
      const list = make("div", "person-card-list");
      for (const person of [...groups.values()].sort((a,b) => a.name.localeCompare(b.name, "zh-HK") || a.shop.shop.localeCompare(b.shop.shop, "zh-HK"))) {
        const card = make("article", "person-card");
        const shopInfo = data.person_accounts?.[person.shop.shop]?.[person.name] || {};
        const sharedInfo = data.people?.[person.name] || Object.values(data.people || {}).find(info => person.personId && info.person_id === person.personId) || {};
        const info = { ...sharedInfo, ...shopInfo,
          profile_image: shopInfo.profile_image || sharedInfo.profile_image || "" };
        const allNames = new Set([person.name]), allHandles = new Map();
        const addInstagramAccount = (account) => {
          const handle = normalizedInstagramHandle(account?.handle);
          if (!handle) return;
          const existing = allHandles.get(handle);
          if (!existing || (existing.status !== "current" && account.status === "current")) {
            allHandles.set(handle, { ...account, handle });
          }
        };
        if (person.personId) {
          for (const [name, candidate] of Object.entries(data.people || {})) if (candidate.person_id === person.personId) {
            allNames.add(name); for (const alias of candidate.names || []) if (alias) allNames.add(alias);
            for (const account of candidate.instagram_accounts || []) addInstagramAccount(account);
          }
          for (const entries of Object.values(data.person_accounts || {})) for (const [name, candidate] of Object.entries(entries || {})) if (candidate.person_id === person.personId) {
            allNames.add(name);
            for (const account of candidate.instagram_accounts || []) addInstagramAccount(account);
          }
        }
        const top = make("div", "person-card-top");
        const profile = make("div", "person-search-profile");
        if (info?.profile_image) {
          const photo = make("img", "person-photo"); photo.src = info.profile_image; photo.alt = ""; profile.append(photo);
        } else profile.append(make("span", "person-photo-placeholder", "♡"));
        const identity = make("div", "person-identity");
        identity.append(make("strong", null, [...allNames].map(HKCI.displayName).join(" ／ ")));
        const instagramAccounts = Array.isArray(info?.instagram_accounts) ? info.instagram_accounts : [];
        const links = allHandles.size ? [...allHandles.values()] : instagramAccounts;
        const igList = make("div", "people-ig-list");
        for (const account of links) {
          const url = HKCI.instagram(account.handle?.startsWith("http") ? account.handle : `https://www.instagram.com/${String(account.handle || "").replace(/^@/, "")}/`);
          if (!url) continue;
          const ig = make("a", "people-ig", `${HKCI.handle(url)}${account.status === "former" ? " · 曾用" : ""}`);
          ig.href = url; ig.target = "_blank"; ig.rel = "noopener noreferrer"; igList.append(ig);
        }
        if (igList.childElementCount) identity.append(igList);
        profile.append(identity); top.append(profile);
        const report = make("button", "person-report", "回報 IG／錯誤"); report.type = "button";
        report.addEventListener("click", () => HKCI.report(person.shop.shop, HKCI.displayName(person.name)));
        top.append(report); card.append(top);
        const table = make("table", "person-results");
        const head = make("thead"), headings = make("tr");
        for (const label of ["日期", "店舖", "Event", "類型", "來源"]) headings.append(make("th", null, label));
        head.append(headings); table.append(head);
        const body = make("tbody");
        for (const { shop, shift, attendanceType } of person.shifts.sort((a,b) => a.shift.date.localeCompare(b.shift.date))) {
          const row = make("tr");
          const addJumpCell = (value, label) => {
            const cell = make("td", "person-roster-jump-cell");
            const button = make("button", "person-roster-jump", value);
            button.type = "button";
            button.setAttribute("aria-label", `在列表查看 ${shift.date} ${shop.shop} ${label}`);
            button.addEventListener("click", () => jumpToRosterCell(shop.shop, shift.date));
            cell.append(button);
            row.append(cell);
          };
          addJumpCell(shift.date, "日期");
          addJumpCell(shop.shop, "店舖");
          addJumpCell(shift.event_name || "—", "活動");
          addJumpCell(attendanceType, "類型");
          const source = make("td"); const link = sourceLink(shop, shift.source); if (link) { link.textContent = "↗"; link.setAttribute("aria-label", "開啟來源貼文"); source.append(link); } else source.textContent = "—";
          row.append(source); body.append(row);
        }
        table.append(body);
        const results = make("div", "person-results-wrap");
        results.append(table); card.append(results); list.append(card);
      }
      if (!list.childElementCount) matrix.append(make("p", "matrix-no-dates", "呢個範圍搵唔到當值記錄；可切換「全部更表」睇舊更表。"));
      else matrix.append(list);
      $("matrix-result-count").textContent = `${groups.size} 位女僕`;
      updateSticky();
      return;
    }
    const columns = state.across === "dates" ? shownDates : shops;
    const rows = state.across === "dates" ? shops : shownDates;
    matrix.replaceChildren();
    matrix.style.setProperty("--columns", String(columns.length));
    if (!columns.length || !rows.length) {
      matrix.removeAttribute("role");
      matrix.append(make("div", "matrix-no-dates", "呢個日期範圍暫時冇資料，請選「全部更表」。"));
      $("matrix-result-count").textContent = "0 筆資料";
      return;
    }
    matrix.setAttribute("role", "table");
    const header = make("div", "matrix-row matrix-header");
    header.setAttribute("role", "row");
    const corner = make("div", "matrix-corner", state.across === "dates" ? "CAFE / 日期" : "日期 / CAFE");
    corner.setAttribute("role", "columnheader");
    header.append(corner);
    for (const item of columns) {
      if (state.across === "dates") {
        const info = dateLabel(item);
        const heading = columnHead(info.day, info.weekday, item === today);
        heading.dataset.date = item;
        header.append(heading);
      }
      else header.append(columnHead(item.shop, item.address || "地址未提供", false, item.profile_image, item.profile, item));
    }
    matrix.append(header);
    for (const item of rows) {
      const line = make("div", "matrix-row");
      line.setAttribute("role", "row");
      if (state.across === "dates") {
        line.append(rowHead(item.shop, item.address || "地址未提供", item.profile, item.profile_image, item));
        for (const date of shownDates) line.append(cell(item, date));
      } else {
        const info = dateLabel(item);
        line.append(rowHead(info.day, info.weekday, null));
        for (const shop of shops) line.append(cell(shop, item));
      }
      matrix.append(line);
    }
    requestAnimationFrame(alignRosterFooters);
    $("matrix-result-count").textContent = `${shops.length} 間店 · ${shownDates.length} 日`;
    $("scroll-hint").textContent = state.across === "dates" ? "左右捲動查看更多日期" : "左右捲動查看更多店舖";
    viewport.scrollLeft = previousScroll;
    if (focusTodayOnNextRender && state.across === "dates") {
      focusTodayOnNextRender = false;
      const todayHeading = matrix.querySelector(`.matrix-colhead[data-date="${today}"]`);
      if (todayHeading) {
        const viewportLeft = viewport.getBoundingClientRect().left;
        const rowLabelWidth = matrix.querySelector(".matrix-rowhead")?.getBoundingClientRect().width || 0;
        viewport.scrollLeft += todayHeading.getBoundingClientRect().left - viewportLeft - rowLabelWidth;
      }
    }
    sticky.replaceChildren(); updateSticky();
  }
  function alignRosterFooters() {
    for (const row of matrix.querySelectorAll(".matrix-row:not(.matrix-header)")) {
      const cells = [...row.querySelectorAll(".matrix-cell-roster")];
      if (!cells.length) continue;
      cells.forEach((cell) => cell.style.removeProperty("min-height"));
      const height = Math.ceil(row.getBoundingClientRect().height);
      if (!height) continue;
      cells.forEach((cell) => cell.style.setProperty("min-height", `${height}px`));
    }
  }
  let observedMatrixSize = "";
  new ResizeObserver(([entry]) => {
    const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
    if (!entry.contentRect.width || size === observedMatrixSize) return;
    observedMatrixSize = size;
    requestAnimationFrame(alignRosterFooters);
  }).observe(matrix);
  function jumpToRosterCell(shop, date) {
    state.person = null;
    state.search = "";
    state.range = "all";
    state.across = "dates";
    state.focusTarget = { shop, date };
    $("name-search").value = "";
    persist();
    window.dispatchEvent(new Event("hkcafeinfo:show-matrix"));
    render();
    requestAnimationFrame(() => {
      const target = [...matrix.querySelectorAll(".matrix-cell")].find((item) => item.dataset.shop === shop && item.dataset.date === date);
      if (!target) return;
      const viewportBounds = viewport.getBoundingClientRect();
      const cellBounds = target.getBoundingClientRect();
      const rowLabelWidth = matrix.querySelector(".matrix-rowhead")?.getBoundingClientRect().width || 0;
      viewport.scrollTo({
        left: viewport.scrollLeft + cellBounds.left - viewportBounds.left - rowLabelWidth,
        behavior: "smooth",
      });
      const headerHeight = matrix.querySelector(".matrix-header")?.getBoundingClientRect().height || 0;
      const topbarHeight = document.querySelector(".topbar")?.getBoundingClientRect().height || 0;
      window.scrollTo({
        top: window.scrollY + cellBounds.top - topbarHeight - headerHeight - 12,
        behavior: "smooth",
      });
      target.classList.add("matrix-cell-focused");
      window.setTimeout(() => target.classList.remove("matrix-cell-focused"), 1800);
    });
  }
  function setAcross(value) {
    state.across = value;
    focusTodayOnNextRender = value === "dates";
    persist();
    for (const [id, active] of [["dates-across", value === "dates"], ["shops-across", value === "shops"]]) {
      $(id).classList.toggle("active", active);
      $(id).setAttribute("aria-pressed", String(active));
    }
    render();
  }
  $("name-search").value = state.search;
  $("date-range").addEventListener("click", (event) => {
    const button = event.target.closest("[data-range]");
    if (!button) return;
    state.range = button.dataset.range === "all" ? "all" : "future";
    focusTodayOnNextRender = state.across === "dates";
    persist(); render();
  });
  $("name-search").addEventListener("input", (event) => {
    const wasSearching = Boolean(state.search || state.person);
    state.search = event.target.value.trim().toLocaleLowerCase(); state.person = null;
    if (state.search && !wasSearching) state.range = "all";
    persist(); render();
  });
  window.addEventListener("hkcafeinfo:person", (event) => { state.person = event.detail; state.search = ""; state.range = "all"; $("name-search").value = ""; persist(); render(); requestAnimationFrame(() => $("matrix-view").scrollIntoView({ block: "start", behavior: "smooth" })); });
  window.addEventListener("maid:visibility-change", render);
  window.addEventListener("hkcafeinfo:view-change", updateSticky);
  window.addEventListener("hkcafeinfo:reset-view", () => {
    state.search = ""; state.person = null; state.range = "future"; state.across = "dates";
    $("name-search").value = "";
    $("dates-across").classList.add("active"); $("dates-across").setAttribute("aria-pressed", "true");
    $("shops-across").classList.remove("active"); $("shops-across").setAttribute("aria-pressed", "false");
    viewport.scrollLeft = 0; persist(); render();
  });
  $("dates-across").addEventListener("click", () => setAcross("dates"));
  $("shops-across").addEventListener("click", () => setAcross("shops"));
  function move(direction) {
    const column = matrix.querySelector(".matrix-colhead");
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const current = Math.min(max, Math.max(0, viewport.scrollLeft));
    const step = column?.getBoundingClientRect().width || 260;
    const target = Math.min(max, Math.max(0, current + direction * step));
    if (Math.abs(target - current) > 1) viewport.scrollTo({ left: target, behavior: "smooth" });
  }
  $("matrix-prev").addEventListener("click", () => move(-1));
  $("matrix-next").addEventListener("click", () => move(1));
  $("show-matrix").addEventListener("click", render);
  $("person-back").addEventListener("click", () => window.dispatchEvent(new Event("hkcafeinfo:return-person")));
  for (const [id, active] of [["dates-across", state.across === "dates"], ["shops-across", state.across === "shops"]]) { $(id).classList.toggle("active", active); $(id).setAttribute("aria-pressed", String(active)); }
  const controlRow = document.querySelector(".matrix-controls-row");
  let lastControlWidth = -1;
  new ResizeObserver(() => {
    const width = controlRow.clientWidth;
    if (!width || width === lastControlWidth) return;
    lastControlWidth = width;
    controlRow.classList.remove("is-wrapped");
    const filters = controlRow.querySelector(".matrix-filter-controls");
    const navigation = controlRow.querySelector(".matrix-navigation");
    const gap = parseFloat(getComputedStyle(controlRow).columnGap) || 0;
    controlRow.classList.toggle("is-wrapped", filters.getBoundingClientRect().width + navigation.getBoundingClientRect().width + gap > width);
  }).observe(controlRow);
  render();
})();
