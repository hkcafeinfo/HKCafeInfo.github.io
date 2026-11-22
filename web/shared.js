(() => {
  "use strict";
  const key = "hkcafeinfo-person-feedback-v1";
  function instagram(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && ["instagram.com", "www.instagram.com"].includes(url.hostname) ? url.href : null;
    } catch { return null; }
  }
  function handle(value) {
    const url = instagram(value);
    return url ? `@${new URL(url).pathname.split("/").filter(Boolean)[0]}` : "";
  }
  function cancellationSource(value) {
    const source = String(value || "").trim();
    if (/^data\/cancellation_images\/[A-Za-z0-9._-]+$/i.test(source)) return `/${source}`;
    try { const url = new URL(source); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; }
    catch { return ""; }
  }
  function staffTerm(shop) { return shop === "Itotsuki Cafe" ? "店員" : "女僕"; }
  function roleLabel(shop, role) { return shop === "Itotsuki Cafe" ? String(role).replace(/女僕/g, "店員") : role; }
  function displayName(name) { return String(name || "").replace(/ ⟦@[^⟧]+⟧$/u, ""); }
  function primaryInstagramAccount(info, accounts = []) {
    const normalize = value => String(value || '').trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').replace(/^@+/, '').split(/[/?#]/)[0].toLowerCase();
    const available = accounts.filter(account => account.status !== 'former' && normalize(account.handle));
    const preferred = normalize(info?.primary_instagram);
    return available.find(account => preferred && normalize(account.handle) === preferred)
      || available.find(account => account.status === 'current') || available[0] || null;
  }
  function personNames(values, accounts = []) {
    const handles = new Set(accounts.map(account => handle(instagram(
      String(account.handle || "").startsWith("http") ? account.handle : `https://www.instagram.com/${String(account.handle || "").replace(/^@/, "")}/`
    )).replace(/^@/, "").toLocaleLowerCase()));
    const labels = new Map();
    for (const value of values) {
      const label = displayName(value).trim();
      if (label) labels.set(label.normalize("NFKC").toLocaleLowerCase(), label);
    }
    const names = [...labels.values()].filter(label => !/^@|^https?:\/\//i.test(label) && !(/[._0-9]/.test(label) && handles.has(label.toLocaleLowerCase())));
    return names.length ? names : [...labels.values()].slice(0, 1);
  }
  function formatPersonTimes(value) { return String(value || "").replace(/、\s*/g, "\n"); }
  const roleCategoryOrder = ["限定", "嘉賓", "高級", "正式", "見習", "其他", "廚房"];
  const roleCategoryByShop = {
    "Maid Academy": {
      "限定": [
        "限定學妹",
        "一日交流生"
      ],
      "高級": [
        "校長",
        "學生會總幹事",
        "學生會幹部",
        "學生會"
      ],
      "正式": [
        "女僕研習生",
        "女僕",
        "學妹",
        "學弟"
      ],
      "見習": [
        "女僕實習生"
      ]
    },
    "Maid Clinic": {
      "限定": [
        "限定護士",
        "限定醫生"
      ],
      "正式": [
        "當值護士",
        "當值醫生"
      ],
      "見習": [
        "新生護士"
      ]
    },
    "Elysium Cafe": {
      "限定": [
        "一日限定",
        "限定Dr.",
        "限定Nurse",
        "限定修女",
        "限定修士"
      ],
      "高級": [
        "資深修女",
        "資深修士"
      ],
      "正式": [
        "正式修女",
        "正式修士"
      ],
      "見習": [
        "實習修士",
        "實習修女"
      ],
      "廚房": [
        "廚娘"
      ]
    },
    "Aurelia Garden": {
      "限定": [
        "限定精靈"
      ],
      "正式": [
        "當值精靈",
        "女僕",
        "當值精靈兼花園守護"
      ],
      "廚房": [
        "花園守護"
      ]
    },
    "Maidoll Mirage": {
      "限定": [
        "限定人偶"
      ],
      "正式": [
        "女僕人偶"
      ],
      "見習": [
        "新生人偶"
      ]
    },
    "Maid Planet": {
      "限定": [
        "一日限定侵略者"
      ],
      "正式": [
        "當值人員"
      ],
      "廚房": [
        "廚星人"
      ]
    },
    "Dear Devil": {
      "限定": [
        "限定人偶"
      ],
      "正式": [
        "Butler",
        "女僕",
        "執事"
      ],
      "廚房": [
        "魔域管理員"
      ]
    },
    "Baberu Cafe": {
      "限定": [
        "限定女僕",
        "限定執事",
        "限定月下執事",
        "限定月下夜僕"
      ],
      "正式": [
        "當值女僕"
      ]
    },
    "Maid Eidolon": {
      "限定": [
        "限定幽靈"
      ],
      "正式": [
        "當值幽靈"
      ]
    },
    "The Misty": {
      "限定": [
        "一日限定女僕",
        "一日限定迷霧女僕",
        "限定女僕"
      ],
      "正式": [
        "正式女僕"
      ],
      "見習": [
        "實習女僕",
        "新人女僕"
      ]
    },
    "CosPlace Café": {
      "限定": [
        "限定女僕"
      ],
      "正式": [
        "出勤女僕",
        "活動出演陣容"
      ]
    },
    "Kaizoku House": {
      "限定": [
        "限定女僕",
        "限定活動嘉賓",
        "限定海盜"
      ],
      "高級": [
        "生誕主角"
      ],
      "正式": [
        "Pirate Maid"
      ]
    },
    "Queen’s Garden": {
      "限定": [
        "限定嘉賓",
        "限定居民"
      ],
      "正式": [
        "出沒居民",
        "女僕",
        "當值人員",
        "影子精靈",
        "試煉者"
      ]
    },
    "Comma Cafe": {
      "正式": [
        "女僕"
      ],
      "見習": [
        "見習女僕"
      ]
    },
    "Sugar Factory Cafe": {
      "限定": [
        "特邀魔女"
      ],
      "正式": [
        "參演魔女",
        "當值女僕"
      ]
    },
    "The Manor Cafe": {
      "限定": [
        "一日限定女僕",
        "一日限定表演者",
        "限定女僕"
      ],
      "正式": [
        "女僕"
      ],
      "見習": [
        "試工女僕"
      ]
    },
    "Maid Minori": {
      "限定": [
        "一日限定水色天使",
        "限定天使"
      ],
      "正式": [
        "水色天使"
      ],
      "見習": [
        "一期生測試"
      ],
      "廚房": [
        "廚娘",
        "廚師"
      ],
      "其他": [
        "👩🏻‍🍳"
      ]
    },
    "Mistia Luna": {
      "限定": [
        "限定月亮女神",
        "限定當值女僕"
      ],
      "正式": [
        "當值女僕"
      ],
      "廚房": [
        "當值廚娘"
      ]
    },
    "Kirakira Maido": {
      "限定": [
        "限定魔法使"
      ],
      "高級": [
        "魔法導師"
      ],
      "正式": [
        "魔法使"
      ]
    },
    "Itotsuki Cafe": {
      "限定": [
        "限定キャスト",
        "限定當值"
      ],
      "正式": [
        "出勤予定",
        "女僕"
      ],
      "廚房": [
        "Bartender"
      ]
    },
    "Maid Jinja": {
      "限定": [
        "限定小巫女"
      ],
      "正式": [
        "當值小巫女"
      ]
    }
  };
  function canonicalRole(role) {
    const label = String(role || "").trim();
    return /^guest$/i.test(label) ? "Guest" : label;
  }
  function orderedRoleGroups(groups, shop) {
    const buckets = new Map(roleCategoryOrder.map((label) => [label, []]));
    const explicit = new Map(Object.entries(roleCategoryByShop[shop] || {}).flatMap(([category, roles]) => roles.map((role) => [canonicalRole(role), category])));
    const merged = new Map();
    for (const [rawRole, names] of Object.entries(groups || {})) {
      const role = canonicalRole(rawRole);
      if (!merged.has(role)) merged.set(role, new Set());
      for (const name of names) merged.get(role).add(name);
    }
    for (const [role, names] of merged) {
      const kitchen = /^(廚房|廚房職|廚房人員|廚師|廚娘|當值廚娘|kitchen|chef|bartender)$/i.test(role);
      const category = explicit.get(role) || (kitchen ? "廚房" : role === "Guest" ? "嘉賓" : "其他");
      buckets.get(category).push([role, [...names]]);
    }
    return roleCategoryOrder.map((label) => [label, buckets.get(label)]).filter(([, entries]) => entries.length);
  }
  function personKey(shop, name) { return JSON.stringify([shop, name.trim().toLocaleLowerCase()]); }
  function accountHandle(info) {
    const accounts = [...(info?.work_instagram_accounts || []), ...(info?.instagram_accounts || [])];
    const account = accounts.find((item) => item.status === "current") || accounts[0];
    const value = String(account?.handle || "").trim();
    return (handle(value).replace(/^@/, "") || value.replace(/^@+/, "")).toLocaleLowerCase();
  }
  // Search ranks are lexicographic: exact field, token coverage, match kind,
  // then surplus characters. Attendance/popularity never influence relevance.
  function normalizeSearch(value) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
  }
  function searchRank(fields, query) {
    const q = normalizeSearch(query);
    if (!q) return [0, 0, 0, 0];
    const entries = [['name', 0], ['aliases', 1], ['handles', 2], ['related', 6]].flatMap(([key, kind]) =>
      (Array.isArray(fields[key]) ? fields[key] : [fields[key]]).filter(Boolean).map(value => ({
        value: normalizeSearch(value).replace(kind === 2 ? /^@+/u : /$^/u, ''), kind
      })));
    const tokens = [...new Set(q.split(' '))];
    let covered = 0, best = [9, Infinity];
    for (const token of tokens) {
      let matched = false;
      for (const entry of entries) {
        const term = entry.kind === 2 ? token.replace(/^@+/u, '') : token;
        if (!term || !entry.value.includes(term)) continue;
        matched = true;
        const kind = entry.kind === 6 ? 6 : entry.kind === 2 ? 5 : entry.value.startsWith(term) ? 3 : 4;
        const extra = entry.value.length - term.length;
        if (kind < best[0] || kind === best[0] && extra < best[1]) best = [kind, extra];
      }
      if (matched) covered++;
    }
    const exact = entries.filter(e => e.kind < 6 && e.value === (e.kind === 2 ? q.replace(/^@+/u, '') : q));
    if (exact.length) return [Math.min(...exact.map(e => e.kind)), 0, 0, 0];
    return covered ? [3, tokens.length - covered, ...best] : null;
  }
  function compareSearchRanks(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  }
  function rankSearch(items, query, fields, tieBreak = () => 0) {
    if (!normalizeSearch(query)) return [...items];
    return items.map((item, index) => ({item, index, rank: searchRank(fields(item), query)}))
      .filter(row => row.rank).sort((a, b) => compareSearchRanks(a.rank, b.rank) || tieBreak(a.item, b.item) || a.index - b.index)
      .map(row => row.item);
  }
  function personSearchFields(data, shop, name) {
    const local = data.person_accounts?.[shop]?.[name] || {};
    const shared = data.people_by_id?.[local.person_id] || data.people?.[name] || {};
    const accounts = [...(local.work_instagram_accounts || []), ...(local.instagram_accounts || []), ...(shared.instagram_accounts || [])];
    const cafe = data.shops?.find(item => item.shop === shop);
    return { name: shared.display_name || displayName(name), aliases: [displayName(name), ...(shared.names || [])],
      handles: accounts.map(a => a.handle), related: [shop, ...(cafe?.aliases || [])] };
  }
  function matchesPerson(data, shop, name, query) {
    return Boolean(searchRank(personSearchFields(data, shop, name), query));
  }
  let conflicts;
  function personIdentity(data, shop, name) {
    const account = data.person_accounts?.[shop]?.[name];
    const username = accountHandle(account);
    return account?.person_id ? `person:${account.person_id}`
      : (username ? `ig:${username}` : `name:${JSON.stringify([shop, name.trim().toLocaleLowerCase()])}`);
  }
  function identityKey(data, shop, name) {
    const key = personIdentity(data, shop, name);
    // An explicit UID remains one person even when two recorded shifts clash.
    // Keep both dated sources on their card; a schedule conflict is not a new identity.
    if (data.person_accounts?.[shop]?.[name]?.person_id) return key;
    if (data.identity_conflicts) {
      if (!conflicts) conflicts = new Set(data.identity_conflicts);
      return conflicts.has(key) ? `${key}|shop:${shop}` : key;
    }
    if (!conflicts) {
      const appearances = new Map(); conflicts = new Set();
      for (const cafe of data.shops || []) for (const shift of cafe.shifts || [])
        for (const names of Object.values(shift.groups || {})) for (const person of names) {
          const identity = personIdentity(data, cafe.shop, person);
          const dated = `${identity}|${shift.date}`;
          if (appearances.has(dated) && appearances.get(dated) !== cafe.shop) conflicts.add(identity);
          else appearances.set(dated, cafe.shop);
        }
    }
    return conflicts.has(key) ? `${key}|shop:${shop}` : key;
  }
  function missingRosterText(date) {
    const timezone = window.MAID_ROSTERS?.timezone || "Asia/Hong_Kong";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
    return date > "2026-10-20" && date < today
      ? "老細沒有更新這一天的更表"
      : "未找到更表";
  }
  function dateNotice(shop, date) {
    return (shop.date_notices || []).find((item) => item.date === date);
  }
  function dateNoticeView(item) {
    const node = document.createElement("div");
    node.className = "dated-roster-notice";
    for (const text of [item.title, item.detail]) {
      const line = document.createElement("div");
      line.textContent = text;
      node.append(line);
    }
    try {
      const url = new URL(item.source);
      if (url.protocol === "https:" && url.hostname === "www.instagram.com") {
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "來源 ↗";
        node.append(link);
      }
    } catch { /* optional source */ }
    return node;
  }
  function closed(shop, date) {
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    return (shop.closed_weekdays || []).includes(day);
  }
  function closedNotice(shop) {
    const node = document.createElement("div");
    node.className = "closed-notice";
    const main = document.createElement("span");
    main.className = "closed-main";
    const illustration = document.createElement("span");
    illustration.className = "closed-illustration";
    illustration.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = "是日公休";
    main.append(illustration, title);
    const weekdayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const weekdays = [...new Set(shop.closed_weekdays || [])].sort((a, b) => a - b);
    if (weekdays.length) {
      const ranges = [];
      for (const day of weekdays) {
        const previous = ranges.at(-1);
        if (previous && day === previous[1] + 1) previous[1] = day;
        else ranges.push([day, day]);
      }
      const weekdayText = ranges.map(([start, end]) => start === end
        ? weekdayNames[start]
        : `${weekdayNames[start]}至${weekdayNames[end]}`).join("、");
      const detail = document.createElement("small");
      detail.className = "closed-weekdays";
      detail.textContent = `逢${weekdayText}休息`;
      main.append(detail);
    }
    node.append(main);
    try {
      const url = new URL(shop.source);
      if (url.protocol === "https:" && url.hostname === "www.instagram.com") {
        const link = document.createElement("a");
        link.className = "closed-source";
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "來源 ↗";
        node.append(link);
      }
    } catch { /* optional source */ }
    return node;
  }
  function eventArt(data, shop, shift, node) {
    const event = shift?.event_name;
    const indexed = shift && Object.hasOwn(shift, "event_art");
    const image = indexed ? shift.event_art : (data.event_images || []).find((item) => item.shop === shop.shop && item.event_name === event);
    if (!image || !/^data\/event_images\/[\w.-]+\.(?:jpg|jpeg|png|webp)$/i.test(image.image_path)) return;
    const dates = indexed ? [] : [...new Set((shop.shifts || []).filter((item) => item.event_name === event).map((item) => item.date))].sort();
    let streak = [];
    for (const date of dates) {
      const previous = streak.at(-1);
      if (previous && (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${previous}T12:00:00Z`)) !== 86400000) {
        if (streak.length >= 3 && streak.includes(shift.date)) return;
        streak = [];
      }
      streak.push(date);
    }
    if (streak.length >= 3 && streak.includes(shift.date)) return;
    node.classList.add("has-event-art");
    HKCILoading.background(node, image.image_path);
    node.style.setProperty("--event-opacity", String(Math.min(0.24, Math.max(0.04, Number(image.opacity) || 0.12))));
  }
  function getFeedback() {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  }
  function report(shop, name) {
    const answer = prompt(`回報 ${name}（${shop}）嘅 Instagram 連結，或者描述資料錯誤：`);
    if (!answer?.trim()) return;
    const item = { shop, person: name, report: answer.trim(), submitted_at: new Date().toISOString(), status: "待審" };
    try { localStorage.setItem(key, JSON.stringify([...getFeedback(), item])); alert("已存喺呢個瀏覽器。請用「匯出回報 CSV」交畀管理員；公開版會再接收件服務。"); }
    catch { alert("呢個瀏覽器無法儲存回報。"); }
  }
  function exportFeedback() {
    const rows = getFeedback();
    if (!rows.length) { alert("暫時冇回報資料。"); return; }
    const fields = ["shop", "person", "report", "submitted_at", "status"];
    const csv = "\ufeff" + [fields.join(","), ...rows.map((row) => fields.map((field) => `"${String(row[field] || "").replaceAll('"', '""')}"`).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "人物資料待審回報.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function appendTimeText(node, value) {
    const text = String(value || "");
    const pattern = /(?:(?:[A-Za-zＡ-Ｚａ-ｚ0-9一二三四五六七八九十]+場|午場|晚場|早場)\s*)?(?:(?:翌日|次日))?\d{1,2}:\d{2}\s*[–－—-]\s*(?:(?:翌日|次日))?\d{1,2}:\d{2}/g;
    let start = 0;
    for (const match of text.matchAll(pattern)) {
      node.append(document.createTextNode(text.slice(start, match.index)));
      const time = document.createElement("span"); time.className = "hybrid-time-range"; time.textContent = match[0]; node.append(time);
      start = match.index + match[0].length;
    }
    node.append(document.createTextNode(text.slice(start)));
    return node;
  }
  function addressLink(shop, className = "") {
    const node = document.createElement(shop.address ? "a" : "span");
    node.className = className;
    node.textContent = shop.address || "地址待確認";
    if (shop.address) {
      node.classList.add("hybrid-address-link");
      const label = document.createElement("span"); label.className = "hybrid-address-label"; label.textContent = shop.address;
      node.replaceChildren(label);
      node.insertAdjacentHTML("afterbegin", '<svg class="hybrid-map-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>');
      node.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("香港 " + shop.address);
      node.target = "_blank"; node.rel = "noopener noreferrer";
    }
    return node;
  }
  function shopIntro(shop) {
    const card = document.createElement("article"); card.className = "shop-intro";
    const shopHeading = document.createElement("div"); shopHeading.className = "shop-intro-heading";
    if (shop.profile_image) { const img = document.createElement("img"); HKCILoading.image(img, shop.profile_image); img.alt = ""; img.className = "shop-profile-photo"; shopHeading.append(img); }
    const shopCopy = document.createElement("div"); shopCopy.className = "shop-intro-copy";
    const title = document.createElement("h3"); title.textContent = shop.shop; shopCopy.append(title); shopHeading.append(shopCopy); card.append(shopHeading);
    const profileUrl = instagram(shop.profile);
    if (profileUrl) {
      const account = document.createElement("a"); account.className = "shop-intro-ig"; account.href = profileUrl;
      account.textContent = handle(profileUrl); account.target = "_blank"; account.rel = "noopener noreferrer"; shopCopy.append(account);
      account.insertAdjacentHTML('afterbegin', '<svg class="shop-intro-ig-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>');
    }
    const address = document.createElement("p"); address.className = "shop-intro-address"; address.append(addressLink(shop)); shopCopy.append(address);
    const heading = document.createElement("h4"); heading.textContent = "營業時間"; card.append(heading);
    const hours = document.createElement("dl"); hours.className = "opening-hours";
    const openingHourRows = String(shop.opening_hours || "")
      .replace(/\\+n/g, "\n")
      .replace(/(\d{1,2}:\d{2})\s*(?=星期|週|周)/g, "$1\n")
      .split(/[\n;；]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const line of openingHourRows) {
      // Split each day/rule at the first time or closed marker. Older data can
      // omit the space before the time (for example「星期六20:00後…」).
      const match = line.match(/^(.+?)(?=\s*(?:休息|\d{1,2}:\d{2}))\s*(休息|\d{1,2}:\d{2}.*)$/);
      const term = document.createElement("dt"), value = document.createElement("dd");
      term.textContent = match ? match[1].trim() : "營業時間"; appendTimeText(value, match ? match[2].trim() : line);
      const row = document.createElement("div"); row.className = "shop-hours-row";
      row.append(term, value); hours.append(row);
    }
    if (hours.childElementCount) card.append(hours);
    else { const pending = document.createElement("p"); pending.className = "hours-pending"; pending.textContent = "常規營業時間待確認，請查看店舖公告。"; card.append(pending); }
    if (shop.notice) { const note = document.createElement("p"); note.className = "shop-intro-note"; note.textContent = shop.notice; card.append(note); }
    const sourceUrl = instagram(shop.opening_hours_source);
    if (sourceUrl) {
      const footer = document.createElement("div"); footer.className = "shop-intro-source";
      const source = document.createElement("a"); source.href = sourceUrl; source.textContent = "來源 ↗";
      source.target = "_blank"; source.rel = "noopener noreferrer"; footer.append(source); card.append(footer);
    }
    return card;
  }
  function rosterSourceEntries(shift, onlyName = "") {
    const allRecords = shift?.attendance_records || [];
    const records = onlyName ? allRecords.filter(record => record.name === onlyName) : allRecords;
    const localEvidencePath = value => {
      const path = String(value || "").replace(/^\/+/, "");
      return /^data\/(?:story_evidence|cancellation_images)\/[A-Za-z0-9._-]+$/i.test(path) ? path : "";
    };
    const sourceKey = value => {
      const url = instagram(value);
      if (!url) {
        const path = localEvidencePath(value);
        return path ? `asset:${path}` : "";
      }
      const parsed = new URL(url);
      return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
    };
    const facts = record => [record.name, record.role, record.type, record.hours, record.event_name, record.notes]
      .map(value => value || "").join("\u0000");
    const groupBySource = sourceRecords => {
      const grouped = new Map();
      for (const record of sourceRecords) {
      const key = sourceKey(record.source);
      if (key) {
          if (!grouped.has(key)) grouped.set(key, { url: instagram(record.source), facts: new Set(), records: [] });
          grouped.get(key).facts.add(facts(record));
          grouped.get(key).records.push(record);
        }
      }
      return grouped;
    };
    const allBySource = groupBySource(allRecords);
    const bySource = onlyName ? groupBySource(records) : allBySource;
    const primary = instagram(shift?.source) || bySource.values().next().value?.url || "";
    const primaryKey = sourceKey(primary);
    // Decide which post is the main roster from the complete shift. A person-card
    // row is scoped to one name, but that must not make their personal post look
    // like the main roster simply because it is the only source left in scope.
    const sourceCoverage = [...allBySource].map(([key, item]) => [key, new Set(item.records.map(record => record.name).filter(Boolean)).size]);
    const maxCoverage = Math.max(0, ...sourceCoverage.map(([, count]) => count));
    const mainRosterKey = sourceCoverage.find(([key, count]) => key === primaryKey && count === maxCoverage)?.[0]
      || sourceCoverage.find(([, count]) => count === maxCoverage && count > 0)?.[0]
      || primaryKey;
    const primaryFacts = allBySource.get(primaryKey)?.facts || new Set();
    const selected = new Map();
    const add = (url, record, status = "") => {
      const key = sourceKey(url);
      if (!key) return;
      const target = instagram(url) || (localEvidencePath(url) ? `/${localEvidencePath(url)}` : "");
      if (!selected.has(key)) selected.set(key, { url: target, records: [], statuses: new Set() });
      const entry = selected.get(key);
      if (record && !entry.records.includes(record)) entry.records.push(record);
      if (status) entry.statuses.add(status);
    };
    if (primary && (!onlyName || bySource.has(primaryKey))) {
      const primaryRecords = bySource.get(primaryKey)?.records || records.filter(record => !record.source);
      primaryRecords.forEach(record => add(primary, record));
      if (!primaryRecords.length) add(primary, null);
    }
    for (const [key, item] of bySource) {
      if (key !== primaryKey && [...item.facts].some(fact => !primaryFacts.has(fact))) item.records.forEach(record => add(item.url, record));
    }
    // Story additions, absences, and explicit cancellations are distinct changes,
    // so retain their source even when the base roster source is already listed.
    for (const record of records) {
      const status = record.story_status === "extra" ? "加更" : record.story_status === "absent" ? "缺席" : record.cancelled ? "取消" : "";
      if (status) add(record.story_source || record.cancellation_source, record, status);
    }
    const shortNames = names => {
      const unique = [...new Set(names.filter(Boolean))];
      if (!unique.length) return "";
      if (onlyName) return unique[0];
      if (unique.length > 2) return `${unique.length}人`;
      return unique.join("、");
    };
    return [...selected.values()].map(entry => {
      const entryKey = sourceKey(entry.url);
      const categorySet = new Set(entry.records.map(record => {
        const storyKey = sourceKey(record.story_source);
        const cancellationKey = sourceKey(record.cancellation_source);
        if (storyKey === entryKey && record.story_status === "extra") return "加更";
        if (storyKey === entryKey && record.story_status === "absent") return "缺席";
        if (cancellationKey === entryKey && record.cancelled) return "取消";
        const type = String(record.type || "");
        const role = String(record.role || "");
        if (type.includes("限定") || role.includes("限定")) return "限定";
        if (type.includes("活動")) return "活動";
        return "當值";
      }));
      for (const status of entry.statuses) categorySet.add(status);
      const nameText = shortNames(entry.records.map(record => record.name));
      const namesFor = predicate => [...new Set(entry.records.filter(predicate).map(record => record.name).filter(Boolean))].join("、");
      const sourceNames = [...new Set(entry.records.filter(record => sourceKey(record.source) === entryKey).map(record => record.name).filter(Boolean))];
      const extraNames = namesFor(record => record.story_status === "extra" && sourceKey(record.story_source) === entryKey);
      const absentNames = namesFor(record => record.story_status === "absent" && sourceKey(record.story_source) === entryKey);
      const markers = [];
      if (extraNames) markers.push(`➕${extraNames}`);
      if (absentNames) markers.push(`➖${absentNames}`);
      const kind = extraNames && absentNames ? "mixed" : extraNames ? "extra" : absentNames ? "absent" : "normal";
      const dutyLabel = entryKey === mainRosterKey ? "當值" : sourceNames.length ? `${sourceNames.join("&")}當值` : "更表";
      const label = `${markers.join("　") || dutyLabel} ↗`;
      const description = `${[...categorySet].join("、") || "更表來源"}${sourceNames.length ? `：${sourceNames.join("、")}` : nameText ? `：${nameText}` : ""}`;
      const proof = entry.records.find(record => sourceKey(record.story_source) === entryKey
        && record.story_source_backup && record.story_source_expires_at);
      const backupUrl = proof && /^data\/story_evidence\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|mp4|mov)$/i.test(proof.story_source_backup)
        ? `/${proof.story_source_backup}` : "";
      const expiresAt = proof?.story_source_expires_at || "";
      const expired = expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.now() >= Date.parse(expiresAt);
      return { url: entry.url, href: expired && backupUrl ? backupUrl : entry.url,
        backupUrl, expiresAt, label, description, kind };
    });
  }
  function rosterSources(shift) {
    return rosterSourceEntries(shift).map(entry => entry.href || entry.url);
  }
  function rosterSourceLinks(shift, className = "roster-source-links", onlyName = "") {
    const entries = rosterSourceEntries(shift, onlyName);
    if (!entries.length) return null;
    const wrap = document.createElement("span"); wrap.className = className;
    entries.forEach(entry => {
      const link = document.createElement("a"); link.href = entry.href || entry.url;
      link.classList.add(`source-${entry.kind}`);
      link.target = "_blank"; link.rel = "noopener noreferrer";
      if (entry.backupUrl) {
        link.dataset.storySourceUrl = entry.url;
        link.dataset.storyBackupUrl = entry.backupUrl;
        link.dataset.storyExpiresAt = entry.expiresAt;
      }
      link.textContent = entry.label;
      link.title = entry.description;
      link.setAttribute("aria-label", `${entry.description}，開啟 Instagram 貼文`);
      wrap.append(link);
    });
    return wrap;
  }
  function storyAttendanceTag(tag, status, source, linkSource = true) {
    const wrapper = document.createElement('span');
    wrapper.className = 'person-attendance story-linked ' + status;
    const label = status === 'absent' ? '缺席' : '加更';
    const href = linkSource ? cancellationSource(source) : null;
    const marker = document.createElement(href ? 'a' : 'span');
    marker.className = 'story-linked-status';
    marker.textContent = label;
    marker.setAttribute('aria-label', tag.textContent + '：' + label + (href ? '，查看來源' : ''));
    if (href) { marker.href = href; marker.target = '_blank'; marker.rel = 'noopener noreferrer'; }
    wrapper.append(tag, marker);
    return wrapper;
  }
  // Let mobile browsers follow Instagram universal links in the current tab,
  // so iOS / Android can hand them to the installed Instagram app.
  document.addEventListener("click", event => {
    const anchor = event.target.closest?.("a[href]");
    if (!anchor) return;
    const expiresAt = Date.parse(anchor.dataset.storyExpiresAt || "");
    if (anchor.dataset.storyBackupUrl && Number.isFinite(expiresAt)) {
      anchor.href = Date.now() >= expiresAt ? anchor.dataset.storyBackupUrl : anchor.dataset.storySourceUrl;
    }
    const url = instagram(anchor.href);
    const phone = /iPhone|iPod|Android.*Mobile|Mobile.*Android/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && /iPad/i.test(navigator.userAgent));
    if (url && phone) {
      anchor.href = url;
      anchor.removeAttribute("target");
    }
  }, true);
  window.HKCI = { normalizeSearch, searchRank, compareSearchRanks, rankSearch, personSearchFields, canonicalRole, primaryInstagramAccount, appendTimeText, staffTerm, roleLabel, storyAttendanceTag, addressLink, shopIntro, instagram, handle, displayName, personNames, matchesPerson, formatPersonTimes, orderedRoleGroups, personKey, identityKey, dateNotice, dateNoticeView, missingRosterText, rosterSources, rosterSourceLinks, closed, closedNotice, eventArt, cancellationSource, report, exportFeedback };
})();
