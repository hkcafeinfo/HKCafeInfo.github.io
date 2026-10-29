(() => {
  "use strict";

  const headerObserver = new ResizeObserver(entries => document.documentElement.style.setProperty("--topbar-sticky-height", `${entries[0].target.getBoundingClientRect().height}px`));
  headerObserver.observe(document.querySelector(".topbar"));
  const data = window.MAID_ROSTERS;
  const $ = (id) => document.getElementById(id);
  const nodes = { dates: $("date-bar"), grid: $("roster-grid"), search: $("name-search"), result: $("result-count"), footerVersion: $("footer-version") };
  if (!data || !Array.isArray(data.shops)) {
    nodes.grid.textContent = "讀唔到更表資料，請確認 data/rosters.js 同 index.html 放喺原本嘅資料夾結構。";
    return;
  }
  const lastUpdate = (() => {
    if (!data.published_at) return data.checked_at || "未標示";
    const date = new Date(data.published_at);
    if (Number.isNaN(date.getTime())) return data.checked_at || "未標示";
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(", ", " ");
  })();
  if (nodes.footerVersion) nodes.footerVersion.textContent = `最後更新：${lastUpdate}（香港時間）`;

  const allDates = [...new Set(data.shops.flatMap((shop) => [
    ...(shop.shifts || []).map((shift) => shift.date),
    ...(shop.unresolved || []).map((item) => item.date),
    ...(shop.date_notices || []).map((item) => item.date),
  ]))].sort();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone || "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const total = data.shops.reduce((sum, shop) => sum + (shop.shifts || []).reduce((count, shift) =>
    count + Object.values(shift.groups || {}).reduce((people, names) => people + names.length, 0), 0), 0);
  let selectedDate = allDates.includes(today) ? today : (allDates.find((date) => date > today) || allDates.at(-1) || "all");
  const isReload = performance.getEntriesByType("navigation")[0]?.type === "reload";
  const savedPage = (() => { if (!isReload) return {}; try { return JSON.parse(sessionStorage.getItem("hkcafeinfo-page-v1") || "{}"); } catch { return {}; } })();
  let cardRange = savedPage.cardRange === "all" ? "all" : "future";
  const cardDates = () => cardRange === "all" ? allDates : allDates.filter((date) => date >= today);
  if (selectedDate !== "all" && !cardDates().includes(selectedDate)) selectedDate = cardDates()[0] || "all";
  let search = savedPage.search || "";
  let returnView = "matrix";
  nodes.search.value = search;
  function savePage(mode) {
    try { sessionStorage.setItem("hkcafeinfo-page-v1", JSON.stringify({ mode: mode || document.body.dataset.view || "matrix", selectedDate, cardRange, search, scrollY: window.scrollY })); } catch { /* optional */ }
  }
  window.addEventListener("scroll", () => savePage(), { passive: true });
  const storageKey = "maid-roster-visible-shops-v2";
  const topNames = new Set(data.shops.filter((shop) => shop.default_visible).map((shop) => shop.shop));
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { saved = null; }
  const availableNames = new Set(data.shops.map((shop) => shop.shop));
  let visibleNames = new Set(Array.isArray(saved) ? saved.filter((name) => availableNames.has(name)) : topNames);
  window.MAID_VISIBLE_SHOPS = visibleNames;
  const sidebar = $("cafe-sidebar");
  const sidebarToggle = $("toggle-cafe-sidebar");
  function setSidebarOpen(open) {
    if (!sidebar || !sidebarToggle) return;
    sidebar.hidden = !open;
    sidebar.parentElement.classList.toggle("sidebar-collapsed", !open);
    sidebarToggle.setAttribute("aria-expanded", String(open));
    sidebarToggle.firstChild.textContent = open ? "✕ 隱藏列表 " : "☰ 店舖顯示 ";
    try { localStorage.setItem("maid-roster-sidebar-open-v1", String(open)); } catch { /* storage may be unavailable */ }
  }
  let sidebarWasOpen = false;
  try { sidebarWasOpen = localStorage.getItem("maid-roster-sidebar-open-v1") === "true"; } catch { /* storage may be unavailable */ }
  if (sidebar && sidebarToggle) {
    setSidebarOpen(sidebarWasOpen);
    sidebarToggle.addEventListener("click", () => setSidebarOpen(sidebar.hidden));
    document.addEventListener("click", (event) => {
      if (sidebar.hidden || sidebar.contains(event.target) || sidebarToggle.contains(event.target)) return;
      setSidebarOpen(false);
    });
  }

  function renderChecklist() {
    const list = $("cafe-checklist");
    list.replaceChildren();
    for (const shop of data.shops) {
      const label = document.createElement("label");
      label.className = "cafe-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = visibleNames.has(shop.shop);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) visibleNames.add(shop.shop); else visibleNames.delete(shop.shop);
        saveVisibility();
      });
      label.append(checkbox, make("span", null, shop.shop));
      list.append(label);
    }
    $("visible-shop-count").textContent = `${visibleNames.size}/${data.shops.length}`;
    const toggleCount = $("sidebar-toggle-count");
    if (toggleCount) toggleCount.textContent = `${visibleNames.size}/${data.shops.length}`;
  }
  function saveVisibility() {
    try { localStorage.setItem(storageKey, JSON.stringify([...visibleNames])); } catch { /* file browsing can block storage */ }
    renderChecklist();
    renderCards();
    renderShops();
    renderEvents();
    window.dispatchEvent(new Event("maid:visibility-change"));
  }
  $("select-all-shops").addEventListener("click", () => { visibleNames = new Set(availableNames); window.MAID_VISIBLE_SHOPS = visibleNames; saveVisibility(); });
  $("select-top-shops").addEventListener("click", () => { visibleNames = new Set(topNames); window.MAID_VISIBLE_SHOPS = visibleNames; saveVisibility(); });

  $("shop-count").textContent = data.shops.length;
  $("date-count").textContent = allDates.length;
  $("person-count").textContent = total;
  $("updated-label").textContent = `最後更新：${lastUpdate}`;
  const heroLogos = $("hero-logos");
  const bannerOrder = [
    "Maidoll Mirage", "Maid Planet", "Maid Academy", "Maid Clinic", "Elysium Cafe",
    "The Misty", "Baberu Cafe", "Maid Eidolon", "Aurelia Garden", "Dear Devil",
    "CosPlace Café", "Kaizoku House", "Queen’s Garden", "Comma Cafe", "Sugar Factory Cafe",
    "The Manor Cafe", "Maid Minori", "Mistia Luna", "Kirakira Maido", "Itotsuki Cafe",
  ];
  const bannerShops = [...data.shops].sort((a, b) => bannerOrder.indexOf(a.shop) - bannerOrder.indexOf(b.shop));
  for (const [index, shop] of bannerShops.entries()) {
    if (!shop.profile_image) continue;
    const panel = make("div", "hero-logo-panel");
    const logo = make("img", "hero-logo"); logo.src = shop.profile_image; logo.alt = ""; logo.decoding = "async";
    panel.append(logo); heroLogos.append(panel);
  }

  function make(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = value;
    return element;
  }
  function dateLabel(date) {
    const day = new Date(`${date}T12:00:00Z`);
    return {
      day: new Intl.DateTimeFormat("zh-HK", { timeZone: "UTC", month: "numeric", day: "numeric" }).format(day),
      weekday: new Intl.DateTimeFormat("zh-HK", { timeZone: "UTC", weekday: "short" }).format(day),
    };
  }
  function sourceLink(shop, override) {
    let url;
    try { url = new URL(override || shop.source); } catch { return null; }
    if (url.protocol !== "https:" || url.hostname !== "www.instagram.com") return null;
    const link = make("a", "source-link", "查看來源貼文 ↗");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }
  function renderDates() {
    nodes.dates.replaceChildren();
    const dates = [{ value: "all", day: "全部日期", weekday: "總覽" }, ...cardDates().map((date) => ({ value: date, ...dateLabel(date) }))];
    for (const item of dates) {
      const button = make("button", `date-button${selectedDate === item.value ? " active" : ""}`);
      button.type = "button";
      button.setAttribute("aria-pressed", String(selectedDate === item.value));
      button.append(make("span", "date-weekday", item.weekday), make("strong", "date-day", item.day));
      button.addEventListener("click", () => { selectedDate = item.value; savePage(); renderDates(); renderCards(); });
      nodes.dates.append(button);
    }
    requestAnimationFrame(() => { const active = nodes.dates.querySelector(".active"); if (active && nodes.dates.clientWidth) nodes.dates.scrollLeft = Math.max(0, active.offsetLeft - nodes.dates.offsetLeft); updateDateScrollButtons(); });
  }
  function updateDateScrollButtons() {
    const wrap = $("date-selector-wrap");
    const prev = $("date-scroll-prev"), next = $("date-scroll-next");
    if (!wrap || !prev || !next) return;
    const max = Math.max(0, nodes.dates.scrollWidth - nodes.dates.clientWidth);
    const canScroll = max > 2;
    const canScrollLeft = canScroll && nodes.dates.scrollLeft > 2;
    const canScrollRight = canScroll && nodes.dates.scrollLeft < max - 2;
    wrap.classList.toggle("can-scroll-left", canScrollLeft);
    wrap.classList.toggle("can-scroll-right", canScrollRight);
    prev.hidden = !canScrollLeft;
    next.hidden = !canScrollRight;
  }
  function card(shop, shift, date) {
    const element = make("article", "roster-card");
    HKCI.eventArt(data, shop, shift, element);
    const head = make("div", "card-head");
    const title = make("div", "card-title-wrap");
    const iconText = { "Maid Clinic": "✚", "Maid Academy": "✦", "Maid Planet": "✳", "Maid Eidolon": "✞", "CosPlace Café": "♡", "Maidoll Mirage": "◇", "Dear Devil": "♠", "Elysium Cafe": "✟", "Maid Jinja": "⛩" };
    if (shop.profile_image) {
      const photo = make("img", "shop-profile-photo");
      photo.src = shop.profile_image;
      photo.alt = "";
      title.append(photo);
    } else title.append(make("span", `shop-icon ${shop.shop.toLowerCase().replace(/[^a-z]+/g, "-")}`, iconText[shop.shop] || "✦"));
    const titleText = make("div");
    titleText.append(make("h3", "shop-name", shop.shop));
    const shopUrl = HKCI.instagram(shop.profile);
    if (shopUrl) { const ig = make("a", "shop-ig", HKCI.handle(shopUrl)); ig.href = shopUrl; ig.target = "_blank"; ig.rel = "noopener noreferrer"; titleText.append(ig); }
    if (shop.address) titleText.append(HKCI.addressLink(shop, "shop-address"));
    title.append(titleText);
    head.append(title, make("span", "time-badge", shift.hours || "時間未註明"));
    element.append(head);
    if (selectedDate === "all" || search) element.append(make("div", "card-date", `${date} · ${dateLabel(date).weekday}`));
    if (shift.event_name) element.append(make("div", "event-name", shift.event_name));
    let count = 0;
    for (const [, roleGroups] of HKCI.orderedRoleGroups(shift.groups, shop.shop)) {
      for (const [role, names] of roleGroups) {
      const matched = names.filter((name) => shop.shop.toLocaleLowerCase().includes(search) || HKCI.displayName(name).toLocaleLowerCase().includes(search));
      if (!matched.length) continue;
      count += matched.length;
      const group = make("div", "role-group");
      group.append(make("div", "role-name", role));
      const tags = make("div", "person-tags");
      for (const name of matched) {
        const tag = make("button", `person-tag${shift.review_names?.[name] ? " needs-review" : ""}`, HKCI.displayName(name));
        tag.type = "button";
        if (shift.person_times?.[name]) tag.append(make("small", "person-time", HKCI.formatPersonTimes(shift.person_times[name])));
        tag.addEventListener("click", () => window.dispatchEvent(new CustomEvent("hkcafeinfo:person", { detail: { shop: shop.shop, name } })));
        if (shift.review_names?.[name]) tag.title = shift.review_names[name];
        tags.append(tag);
      }
      group.append(tags);
      element.append(group);
      }
    }
    if (shift.notes && !shift.notes.includes("貼文列出日程，時段為當日營業時間，個別人員更期未逐一註明")) element.append(make("p", "card-note", shift.notes));
    const foot = make("div", "card-foot");
    foot.append(make("span", "headcount", `${count} 位女僕`));
    const link = sourceLink(shop, shift.source);
    if (link) foot.append(link);
    element.append(foot);
    return { element, count };
  }
  function unresolvedCard(shop, item, date) {
    const element = make("article", "roster-card unresolved-card");
    const head = make("div", "card-head");
    const title = make("div", "card-title-wrap");
    title.append(make("span", "shop-icon pending-icon", "?"), make("h3", "shop-name", shop.shop));
    head.append(title, make("span", "pending-badge", "待核對"));
    element.append(head);
    if (selectedDate === "all" || search) element.append(make("div", "card-date", `${date} · ${dateLabel(date).weekday}`));
    element.append(make("strong", "pending-title", "未有確認名單"), make("p", "pending-copy", item.reason));
    const foot = make("div", "card-foot");
    foot.append(make("span", "headcount", "有相關貼文"));
    const link = sourceLink(shop, item.source);
    if (link) foot.append(link);
    element.append(foot);
    return element;
  }
  function missingCard(shop, date) {
    const element = make("article", "roster-card missing-card");
    const closed = HKCI.closed(shop, date);
    const dated = HKCI.dateNotice(shop, date);
    element.append(make("span", "missing-icon", shop.notice ? "!" : "·"), make("h3", "shop-name", shop.shop),
      dated ? HKCI.dateNoticeView(dated) : closed ? HKCI.closedNotice(shop) : make("p", "missing-copy", "呢日暫時未找到更表資料"));
    if (shop.notice && !closed && !dated) { const link = sourceLink(shop); if (link) element.append(link); }
    return element;
  }
  function renderCards() {
    for (const button of $("card-date-range").querySelectorAll("[data-range]")) {
      const active = button.dataset.range === cardRange;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    nodes.grid.replaceChildren();
    const dates = (selectedDate === "all" || search) ? cardDates() : [selectedDate];
    const shops = data.shops.filter((shop) => visibleNames.has(shop.shop));
    let cards = 0, people = 0;
    for (const date of dates) {
      const grid = make("div", "date-grid");
      for (const shop of shops) {
        const shift = (shop.shifts || []).find((item) => item.date === date);
        const unresolved = (shop.unresolved || []).find((item) => item.date === date);
        if (shift) {
          const result = card(shop, shift, date);
          if (result.count) { grid.append(result.element); cards++; people += result.count; }
        } else if (!search && unresolved) { grid.append(unresolvedCard(shop, unresolved, date)); cards++; }
        else if (!search && (selectedDate !== "all" || HKCI.dateNotice(shop, date))) { grid.append(missingCard(shop, date)); cards++; }
      }
      if (grid.childElementCount) {
        if (selectedDate === "all" || search) nodes.grid.append(make("h3", "grid-date-heading", `${date} · ${dateLabel(date).weekday}`));
        nodes.grid.append(grid);
      }
    }
    if (!cards) {
      const empty = make("div", "empty-state");
      empty.append(make("strong", null, "搵唔到符合條件嘅更表"), make("p", null, "試下換個日期、店舖或者人名。"));
      nodes.grid.append(empty);
    }
    nodes.result.textContent = search ? `${people} 筆符合搜尋` : `${cards} 張店舖卡片`;
  }
  renderChecklist();
  $("card-date-range").addEventListener("click", (event) => {
    const button = event.target.closest("[data-range]");
    if (!button) return;
    cardRange = button.dataset.range === "all" ? "all" : "future";
    const availableDates = cardDates();
    selectedDate = availableDates.includes(today) ? today : (availableDates[0] || "all");
    savePage(); renderDates(); renderCards();
  });
  const dateScrollStep = () => {
    const first = nodes.dates.querySelector(".date-button");
    if (!first) return 110;
    const styles = getComputedStyle(nodes.dates);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    return (first.getBoundingClientRect().width + gap) * 3;
  };
  let dateScrollTimer;
  function scrollDates(direction) {
    const max = Math.max(0, nodes.dates.scrollWidth - nodes.dates.clientWidth);
    const current = Math.min(max, Math.max(0, nodes.dates.scrollLeft));
    const target = Math.min(max, Math.max(0, current + direction * dateScrollStep()));
    if (Math.abs(target - current) < 1) { updateDateScrollButtons(); return; }
    nodes.dates.scrollTo({ left: target, behavior: "smooth" });
    updateDateScrollButtons();
    clearTimeout(dateScrollTimer);
    dateScrollTimer = setTimeout(updateDateScrollButtons, 450);
  }
  $("date-scroll-prev").addEventListener("click", () => scrollDates(-1));
  $("date-scroll-next").addEventListener("click", () => scrollDates(1));
  nodes.dates.addEventListener("scroll", updateDateScrollButtons, { passive: true });
  window.addEventListener("resize", updateDateScrollButtons);
  nodes.search.addEventListener("input", () => {
    if (!search && nodes.search.value.trim()) returnView = document.body.dataset.view || "matrix";
    search = nodes.search.value.trim().toLocaleLowerCase();
    savePage();
    nodes.dates.hidden = Boolean(search);
    renderCards();
    if (search) showView("matrix");
  });
  const people = new Map();
  for (const shop of data.shops) for (const shift of shop.shifts || []) {
    for (const [role, names] of Object.entries(shift.groups || {})) for (const name of names) {
      const pid = data.person_accounts?.[shop.shop]?.[name]?.person_id || data.people?.[name]?.person_id;
      const key = pid ? `person:${pid}` : HKCI.identityKey(data, shop.shop, name);
      const record = people.get(key) || { name, pid, shops: new Map() };
      if (record.name === record.name.toLocaleUpperCase() && name !== name.toLocaleUpperCase()) record.name = name;
      const appearance = record.shops.get(shop.shop) || { name, hasDuty: false };
      if (appearance.name === appearance.name.toLocaleUpperCase() && name !== name.toLocaleUpperCase()) appearance.name = name;
      const attendance = shift.attendance_records?.find((item) => item.name === name && item.role === role)?.type || "當值";
      const reunionException = shop.shop === "Maid Academy" && shift.event_name === "Maid Academy Reunion SP";
      if (attendance === "當值" || reunionException) appearance.hasDuty = true;
      record.shops.set(shop.shop, appearance);
      people.set(key, record);
    }
  }
  function renderPeople() {
    const list = $("people-list");
    list.replaceChildren();
    const sorted = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-HK"));
    const appendGroup = (title, entries, shopName) => {
      if (!entries.length) return;
      const section = make("details", "people-shop-group"); section.open = true;
      const heading = make("summary", "people-shop-heading");
      const shop = data.shops.find(item => item.shop === shopName);
      if (shop?.profile_image) { const logo = make("img", "group-shop-logo"); logo.src = shop.profile_image; logo.alt = ""; logo.loading = "lazy"; heading.append(logo); }
      heading.append(make("span", "people-shop-title", title),
        make("span", "people-shop-count", `${entries.length} 位女僕`));
      const items = make("div", "people-shop-items");
      for (const { person, name } of entries) {
        const item = make("div", "people-item");
        const nameButton = make("button", "people-name", HKCI.displayName(name));
        nameButton.type = "button";
        item.append(nameButton);
        nameButton.addEventListener("click", () => {
          const appearance = shopName && person.shops.get(shopName);
          const homeShop = person.shops.has(shopName) ? shopName : person.shops.keys().next().value;
          window.dispatchEvent(new CustomEvent("hkcafeinfo:person", { detail: { shop: homeShop, name: appearance?.name || name } }));
          window.scrollTo({ top: $("matrix-view").offsetTop - 30, behavior: "smooth" });
        });
        items.append(item);
      }
      section.append(heading, items);
      list.append(section);
    };
    for (const shop of data.shops) {
      const members = sorted.flatMap((person) => {
        const appearance = person.shops.get(shop.shop);
        const affiliation = data.person_affiliations?.[person.pid];
        const belongs = affiliation ? affiliation.shops.includes(shop.shop) : appearance?.hasDuty;
        return belongs ? [{ person, name: appearance?.name || person.name }] : [];
      });
      appendGroup(shop.shop, members, shop.shop);
    }
    const unassigned = sorted.filter((person) => data.person_affiliations?.[person.pid] ? !data.person_affiliations[person.pid].shops.length : ![...person.shops.values()].some((appearance) => appearance.hasDuty))
      .map((person) => ({ person, name: person.name }));
    appendGroup("限定暫無所屬", unassigned, null);
    $("people-count").textContent = `${sorted.length} 位女僕`;
  }
  function showView(mode) {
    document.body.dataset.view = mode;
    if (mode === "shops") setSidebarOpen(false);
    savePage(mode);
    $("card-view").hidden = mode !== "cards";
    $("matrix-view").hidden = mode !== "matrix";
    $("people-view").hidden = mode !== "people";
    $("shops-view").hidden = mode !== "shops";
    $("events-view").hidden = mode !== "events";
    if (mode === "events") renderEvents();
    if (mode === "cards") renderDates();
    document.body.classList.toggle("person-search-mode", Boolean(search) && mode === "matrix");
    for (const [id, active] of [["show-events", mode === "events"], ["show-cards", mode === "cards"], ["show-matrix", mode === "matrix"], ["show-people", mode === "people"], ["show-shops", mode === "shops"]]) {
      $(id).classList.toggle("active", active);
      $(id).setAttribute("aria-pressed", String(active));
    }
    window.dispatchEvent(new Event("hkcafeinfo:view-change"));
  }
  function chooseView(mode) {
    search = ""; nodes.search.value = ""; nodes.dates.hidden = false;
    selectedDate = allDates.includes(today) ? today : (allDates.find((date) => date > today) || allDates.at(-1) || "all");
    renderDates(); renderCards();
    window.dispatchEvent(new Event("hkcafeinfo:reset-view"));
    showView(mode);
  }
  $("show-events").addEventListener("click", () => chooseView("events"));
  $("show-cards").addEventListener("click", () => chooseView("cards"));
  $("show-matrix").addEventListener("click", () => chooseView("matrix"));
  $("show-people").addEventListener("click", () => chooseView("people"));
  $("show-shops").addEventListener("click", () => chooseView("shops"));
  window.addEventListener("hkcafeinfo:show-matrix", () => showView("matrix"));
  let eventsRange = "future";
  function renderEvents() {
    const list = $("events-list");
    const openShops = new Set([...list.querySelectorAll("details[open]")].map(node => node.dataset.shop));
    list.replaceChildren();
    for (const shop of data.shops.filter(item => visibleNames.has(item.shop))) {
      const shifts = (shop.shifts || []).filter(shift => shift.event_name && !(data.weekly_events || []).some(item => item.shop === shop.shop && item.event_name === shift.event_name) && !/活動[週周]|[週周]活動|[週周]表|更表/.test(shift.event_name) && (eventsRange === "all" || shift.date >= today)).sort((a,b) => a.date.localeCompare(b.date));
      if (!shifts.length) continue;
      const group = make("details", "event-shop"); group.dataset.shop = shop.shop; group.open = openShops.has(shop.shop);
      const heading = make("summary", "event-shop-heading");
      if (shop.profile_image) { const logo = make("img", "group-shop-logo"); logo.src = shop.profile_image; logo.alt = ""; logo.loading = "lazy"; heading.append(logo); }
      heading.append(make("span", null, shop.shop)); group.append(heading);
      const grid = make("div", "events-grid");
      for (const shift of shifts) {
        const result = card(shop, shift, shift.date).element;
        result.classList.add("event-calendar-card");
        result.querySelector(".card-date")?.remove();
        const head = result.querySelector(".card-head");
        const hours = head.querySelector(".time-badge");
        if (hours) { hours.classList.add("event-hours"); head.after(hours); }
        const calendar = make("time", "event-calendar");
        calendar.dateTime = shift.date;
        calendar.setAttribute("aria-label", `${shift.date} ${dateLabel(shift.date).weekday}`);
        const [year, month, day] = shift.date.split("-");
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        calendar.append(make("span", "event-calendar-month", `${months[Number(month) - 1]} ${year}`), make("strong", "event-calendar-day", String(Number(day))), make("span", "event-calendar-weekday", dateLabel(shift.date).weekday));
        head.append(calendar);
        grid.append(result);
      }
      group.append(grid); list.append(group);
    }
    if (!list.childElementCount) list.append(make("p", "shops-help", "暫時未有符合日期範圍嘅活動資料。"));
  }
  $("events-date-range").addEventListener("click", event => {
    const button = event.target.closest("[data-range]"); if (!button) return;
    eventsRange = button.dataset.range;
    for (const item of $("events-date-range").querySelectorAll("button")) { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); }
    renderEvents();
  });
  function renderShops() {
    const query = $("shop-search").value.trim().toLocaleLowerCase();
    const visibleShops = data.shops.filter(shop => visibleNames.has(shop.shop));
    const shops = visibleShops.filter(shop => `${shop.shop} ${shop.address || ""}`.toLocaleLowerCase().includes(query));
    $("shops-count").textContent = query ? `${shops.length} / ${visibleShops.length} 間店舖` : `全部 ${visibleShops.length} 間店舖`;
    $("shop-directory").replaceChildren(...shops.map(shop => HKCI.shopIntro(shop)));
    if (!shops.length) $("shop-directory").append(make("p", "shops-help", "搵唔到符合嘅店舖，試下其他店名或地址。"));
  }
  $("shop-search").addEventListener("input", renderShops);
  renderShops();
  $("export-feedback").addEventListener("click", HKCI.exportFeedback);
  window.addEventListener("hkcafeinfo:person", () => { returnView = document.body.dataset.view || "matrix"; search = ""; nodes.search.value = ""; savePage("matrix"); showView("matrix"); });
  window.addEventListener("hkcafeinfo:return-person", () => chooseView(returnView));
  for (const mode of ["events", "people"]) {
    const controls = document.getElementById(`${mode}-fold-controls`);
    const selector = mode === "events" ? ".event-shop" : ".people-shop-group";
    const sync = () => { const groups = [...document.querySelectorAll(selector)]; for (const button of controls.querySelectorAll("button")) { const active = groups.length > 0 && groups.every(group => group.open === (button.dataset.fold === "open")); button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); } };
    controls.addEventListener("click", event => { const button = event.target.closest("[data-fold]"); if (!button) return; document.querySelectorAll(selector).forEach(group => { group.open = button.dataset.fold === "open"; }); sync(); });
    document.getElementById(`${mode}-list`).addEventListener("toggle", sync, true);
    window.addEventListener("hkcafeinfo:view-change", sync);
  }
  renderPeople();
  renderDates();
  renderCards();
  nodes.dates.hidden = Boolean(search);
  updateDateScrollButtons();
  showView(search ? "matrix" : (["cards", "matrix", "events", "people", "shops"].includes(savedPage.mode) ? savedPage.mode : "matrix"));
  requestAnimationFrame(() => { if (Number.isFinite(savedPage.scrollY)) window.scrollTo(0, savedPage.scrollY); });
})();

(() => {
  "use strict";
  const hero = document.querySelector(".hero");
  const slides = [...hero.querySelectorAll(".hero-slide")];
  const dots = [...hero.querySelectorAll("[data-hero-slide]")];
  const pause = document.getElementById("hero-pause");
  let current = 0, timer;
  let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function schedule() {
    clearInterval(timer);
    if (!paused && !document.hidden && !hero.matches(":hover, :focus-within")) timer = setInterval(() => show(current + 1), 6000);
    pause.textContent = paused ? "▶" : "Ⅱ";
    pause.setAttribute("aria-label", paused ? "播放輪播" : "暫停輪播");
    pause.setAttribute("aria-pressed", String(paused));
  }
  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === current);
      slide.setAttribute("aria-hidden", String(i !== current));
      dots[i].setAttribute("aria-pressed", String(i === current));
    });
  }
  dots.forEach((dot, i) => dot.addEventListener("click", () => { show(i); schedule(); }));
  document.getElementById("hero-prev").addEventListener("click", () => { show(current - 1); schedule(); });
  document.getElementById("hero-next").addEventListener("click", () => { show(current + 1); schedule(); });
  pause.addEventListener("click", () => { paused = !paused; schedule(); });
  hero.addEventListener("mouseenter", () => clearInterval(timer));
  hero.addEventListener("mouseleave", schedule);
  hero.addEventListener("focusin", () => clearInterval(timer));
  hero.addEventListener("focusout", () => requestAnimationFrame(schedule));
  document.addEventListener("visibilitychange", schedule);
  schedule();
})();
