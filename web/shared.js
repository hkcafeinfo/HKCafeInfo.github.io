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
  function displayName(name) { return String(name || "").replace(/ ⟦@[^⟧]+⟧$/u, ""); }
  function formatPersonTimes(value) { return String(value || "").replace(/、\s*/g, "\n"); }
  const roleCategoryOrder = ["活動職", "限定", "資深", "普通", "見習", "廚房"];
  const roleCategoryByShop = {
    "Aurelia Garden": { "活動職": ["活動出席精靈", "當日出席精靈"], "限定": ["限定精靈"], "普通": ["當值精靈"], "廚房": ["活動出席精靈兼花園守護", "當值精靈兼花園守護", "花園守護"] },
    "Baberu Cafe": { "活動職": ["生日主角及當值女僕"], "限定": ["限定出勤", "限定月下夜僕"], "普通": ["當值女僕"] },
    "Comma Cafe": { "普通": ["女僕"], "見習": ["見習女僕"] },
    "CosPlace Café": { "活動職": ["決賽日當值女僕", "活動出演陣容"], "限定": ["限定女僕"], "普通": ["出勤女僕", "當值執事"] },
    "Dear Devil": { "活動職": ["Guest／嘉賓", "活動嘉賓", "租場嘉賓"], "限定": ["限定女僕"], "普通": ["Butler", "Maid", "女僕"], "廚房": ["魔域管理員"] },
    "Elysium Cafe": { "活動職": ["值班醫護", "活動出席人員"], "限定": ["一日限定", "限定修女", "限定修士"], "資深": ["資深修女", "資深修士"], "普通": ["正式修女", "正式修士"], "見習": ["實習修女", "實習修士"], "廚房": ["廚娘"] },
    "Itotsuki Cafe": { "限定": ["限定當值"], "普通": ["女僕"], "廚房": ["Bartender"] },
    "Kaizoku House": { "活動職": ["活動嘉賓", "生誕活動人員"], "限定": ["限定女僕", "限定海盜"], "普通": ["Maid", "Pirate Maid"] },
    "Kirakira Maido": { "限定": ["限定魔法使"], "資深": ["魔法導師"], "普通": ["魔法使"] },
    "Maid Academy": { "活動職": ["一期生", "二期生", "活動出席花嫁", "活動嘉賓", "生誕主角", "私人活動嘉賓", "邀請嘉賓"], "限定": ["限定學妹"], "資深": ["學生會幹部", "學生會"], "普通": ["女僕研習生"], "見習": ["女僕實習生"] },
    "Maid Clinic": { "活動職": ["生誕主角", "生誕嘉賓"], "限定": ["限定護士"], "資深": ["資深護士"], "普通": ["當值護士", "當值女僕"], "見習": ["新生護士"] },
    "Maid Eidolon": { "限定": ["一日限定", "限定幽靈"], "普通": ["當值幽靈"] },
    "Maid Minori": { "限定": ["限定天使"], "普通": ["水色天使"], "廚房": ["廚師"] },
    "Maid Planet": { "活動職": ["當值人員"], "限定": ["一日限定", "限定侵略者"], "普通": ["當值"] },
    "Maidoll Mirage": { "限定": ["限定人偶"], "普通": ["女僕人偶"], "見習": ["新生人偶"] },
    "Mistia Luna": { "活動職": ["生誕當值嘉賓", "生誕當值女僕"], "限定": ["限定月亮女神", "限定當值女僕"], "普通": ["當值女僕"], "廚房": ["當值廚娘"] },
    "Queen’s Garden": { "活動職": ["活動出席居民", "限定嘉賓"], "限定": ["限定居民"], "普通": ["出沒居民", "影子精靈", "當值人員"] },
    "Sugar Factory Cafe": { "活動職": ["下午及晚上參演魔女", "下午場特邀魔女", "晚上場參演魔女", "當值女僕"] },
    "The Manor Cafe": { "活動職": ["一日限定表演者"], "限定": ["一日限定女僕", "限定女僕"], "普通": ["女僕"], "見習": ["試工女僕"] },
    "The Misty": { "限定": ["一日限定女僕", "限定女僕"], "普通": ["正式女僕"], "見習": ["實習女僕", "新人女僕"] }
  };
  function orderedRoleGroups(groups, shop) {
    const buckets = new Map(roleCategoryOrder.map((label) => [label, []]));
    const explicit = new Map(Object.entries(roleCategoryByShop[shop] || {}).flatMap(([category, roles]) => roles.map((role) => [role, category])));
    for (const entry of Object.entries(groups || {})) {
      const category = explicit.get(entry[0]) || "普通";
      buckets.get(category).push(entry);
    }
    return roleCategoryOrder.map((label) => [label, buckets.get(label)]).filter(([, entries]) => entries.length);
  }
  function personKey(shop, name) { return JSON.stringify([shop, name.trim().toLocaleLowerCase()]); }
  let conflicts;
  function identityKey(data, shop, name) {
    const account = data.person_accounts?.[shop]?.[name];
    const base = account?.person_id ? `person:${account.person_id}` : null;
    const username = handle(account?.instagram).toLocaleLowerCase();
    const key = base || (username ? `ig:${username}` : `name:${name.trim().toLocaleLowerCase()}`);
    if (!conflicts) {
      const appearances = new Map(); conflicts = new Set();
      for (const cafe of data.shops || []) for (const shift of cafe.shifts || [])
        for (const names of Object.values(shift.groups || {})) for (const person of names) {
          const info = data.person_accounts?.[cafe.shop]?.[person];
          const ig = handle(info?.instagram).toLocaleLowerCase();
          const identity = info?.person_id ? `person:${info.person_id}` : (ig ? `ig:${ig}` : `name:${person.trim().toLocaleLowerCase()}`);
          const dated = `${identity}|${shift.date}`;
          if (appearances.has(dated) && appearances.get(dated) !== cafe.shop) conflicts.add(identity);
          else appearances.set(dated, cafe.shop);
        }
    }
    return conflicts.has(key) ? `${key}|shop:${shop}` : key;
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
    const image = (data.event_images || []).find((item) => item.shop === shop.shop && item.event_name === event);
    if (!image || !/^data\/event_images\/[\w.-]+\.(?:jpg|jpeg|png|webp)$/i.test(image.image_path)) return;
    const dates = [...new Set((shop.shifts || []).filter((item) => item.event_name === event).map((item) => item.date))].sort();
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
    node.style.setProperty("--event-image", `url("../${image.image_path}")`);
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
  function shopIntro(shop) {
    const card = document.createElement("article"); card.className = "shop-intro";
    const title = document.createElement("h3"); title.textContent = shop.shop;
    if (shop.profile_image) { const img = document.createElement("img"); img.src = shop.profile_image; img.alt = ""; img.className = "shop-profile-photo"; img.loading = "lazy"; card.append(img); }
    card.append(title);
    const heading = document.createElement("h4"); heading.textContent = "營業時間"; card.append(heading);
    const hours = document.createElement("dl"); hours.className = "opening-hours";
    for (const line of (shop.opening_hours || "").split("\n").filter(Boolean)) {
      const match = line.match(/^(.+?)\s+((?:\d{2}:|休息).*)$/);
      const term = document.createElement("dt"), value = document.createElement("dd");
      term.textContent = match ? match[1] : "營業時間"; value.textContent = match ? match[2] : line;
      hours.append(term, value);
    }
    if (hours.childElementCount) card.append(hours);
    else { const pending = document.createElement("p"); pending.className = "hours-pending"; pending.textContent = "常規營業時間待確認，請查看店舖公告。"; card.append(pending); }
    if (shop.notice) { const note = document.createElement("p"); note.className = "shop-intro-note"; note.textContent = shop.notice; card.append(note); }
    const address = document.createElement("p"); address.className = "shop-intro-address"; address.textContent = shop.address || "地址待確認"; card.append(address);
    const links = document.createElement("div"); links.className = "shop-intro-links";
    for (const [url, label] of [[instagram(shop.profile), "Instagram ↗"], [instagram(shop.opening_hours_source), "營業時間來源 ↗"]]) {
      if (!url) continue;
      const a = document.createElement("a"); a.href = url; a.textContent = label; a.target = "_blank"; a.rel = "noopener noreferrer"; links.append(a);
    }
    card.append(links); return card;
  }
  window.HKCI = { shopIntro, instagram, handle, displayName, formatPersonTimes, orderedRoleGroups, personKey, identityKey, closed, closedNotice, eventArt, report, exportFeedback };
})();
