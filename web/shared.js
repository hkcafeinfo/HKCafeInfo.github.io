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
  window.HKCI = { instagram, handle, displayName, formatPersonTimes, personKey, identityKey, closed, closedNotice, eventArt, report, exportFeedback };
})();
