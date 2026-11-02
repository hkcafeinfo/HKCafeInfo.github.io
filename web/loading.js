(() => {
  "use strict";
  const data = window.MAID_ROSTERS;
  const cache = new Map(), pending = new Map(), waiting = [];
  let running = 0;
  const turn = () => new Promise(resolve => setTimeout(resolve, 0));
  const cancelled = () => new DOMException("Superseded render", "AbortError");
  function pump() {
    while (running < 2 && waiting.length) {
      const start = waiting.shift(); running++;
      start().finally(() => { running--; pump(); });
    }
  }
  function part(descriptor) {
    if (!descriptor) return Promise.resolve({});
    const { key, url } = descriptor;
    if (cache.has(key)) { const value = cache.get(key); cache.delete(key); cache.set(key, value); return Promise.resolve(value); }
    if (pending.has(key)) return pending.get(key).promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const request = { promise, resolve, reject, payload: null };
    pending.set(key, request);
    waiting.push(async () => {
      try {
        // Hashed script chunks work over HTTPS and when index.html is opened
        // directly from disk. Concurrent views share this one request.
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await new Promise((yes, no) => {
              const script = document.createElement("script");
              const finish = error => { clearTimeout(timer); script.remove(); error ? no(error) : yes(); };
              const timer = setTimeout(() => finish(new Error("更表載入逾時")), 15000);
              script.src = new URL(url, document.baseURI).href;
              script.onload = () => finish(request.payload ? null : new Error("更表資料未完整載入"));
              script.onerror = () => finish(new Error("暫時未能載入更表資料"));
              document.head.append(script);
            });
            break;
          } catch (error) { if (attempt) throw error; await turn(); }
        }
        cache.set(key, request.payload);
        while (cache.size > 4) cache.delete(cache.keys().next().value);
        resolve(request.payload);
      } catch (error) { reject(error); }
      finally { pending.delete(key); }
    });
    pump();
    return promise;
  }
  let catalogPromise;
  async function catalog() {
    if (!data?.format_version) return data;
    if (!catalogPromise) catalogPromise = part(data.catalog).then(value => { Object.assign(data, value); return value; }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  async function shops(dates, valid = () => true) {
    if (!data?.format_version) return data.shops;
    const selected = new Set(dates);
    const months = [...new Set(dates.map(date => date.slice(0, 7)))].filter(month => data.parts[month]);
    const result = data.shops.map(shop => ({ ...shop, shifts: [], unresolved: [], date_notices: [] }));
    // Two months at a time bounds transient payloads, including a five-year
    // archive. A caller requesting the entire archive owns that result only.
    for (let i = 0; i < months.length; i += 2) {
      if (!valid()) throw cancelled();
      const values = await Promise.all(months.slice(i, i + 2).map(month => part(data.parts[month])));
      if (!valid()) throw cancelled();
      for (const value of values) for (const shop of result) {
        for (const field of ["shifts", "unresolved", "date_notices"]) {
          for (const item of value[shop.shop]?.[field] || []) if (selected.has(item.date)) shop[field].push(item);
        }
      }
      await turn();
    }
    return result;
  }
  async function searchDates(query, person, range, today) {
    await catalog();
    if (!data.format_version) return dates().filter(day => range === "all" || day >= today);
    const wanted = person ? HKCI.identityKey(data, person.shop, person.name) : "";
    const months = new Set();
    for (const [shop, name, , values] of data.search_index) {
      if (person ? HKCI.identityKey(data, shop, name) === wanted : shop.toLocaleLowerCase().includes(query) || HKCI.matchesPerson(data, shop, name, query)) {
        for (const month of values) months.add(month);
      }
    }
    return data.dates.filter(day => months.has(day.slice(0, 7)) && (range === "all" || day >= today));
  }
  function dates() {
    return data.dates || [...new Set(data.shops.flatMap(shop => ["shifts", "unresolved", "date_notices"].flatMap(field => (shop[field] || []).map(item => item.date))))].sort();
  }
  const jobs = new WeakMap();
  function showError(container, retryTask, error) {
    const notice = document.createElement("p"); notice.className = "shops-help"; notice.setAttribute("role", "alert");
    notice.textContent = "資料暫時未能載入，請稍後重試。 ";
    const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "重試";
    retry.onclick = () => { notice.remove(); retryTask(); };
    const refresh = document.createElement("button"); refresh.type = "button"; refresh.textContent = "重新載入";
    refresh.onclick = () => window.location.reload();
    notice.append(retry, " ", refresh); container.append(notice);
    console.error(error);
  }
  async function render(container, task) {
    const token = {}; jobs.set(container, token);
    const valid = () => jobs.get(container) === token;
    container.setAttribute("aria-busy", "true");
    try { await task(valid); }
    catch (error) {
      if (!valid() || error.name === "AbortError" || container.closest("[hidden]")) return;
      // Failed requests never turn into an empty roster or '未找到更表'.
      showError(container, () => render(container, task), error);
    } finally {
      if (valid()) container.removeAttribute("aria-busy");
      window.dispatchEvent(new Event("hkcafeinfo:loaded"));
    }
  }
  async function each(items, build, valid = () => true) {
    let deadline = performance.now() + 8;
    for (const item of items) {
      if (!valid()) throw cancelled();
      build(item);
      if (performance.now() > deadline) { await turn(); deadline = performance.now() + 8; }
    }
  }
  const paging = new Map();
  function clear(container) {
    for (const [root, observer] of paging) if (root === container || container.contains(root)) { observer?.disconnect(); paging.delete(root); }
    for (const [node] of backgroundImages) if (node === container || container.contains(node)) { imageObserver?.unobserve(node); backgroundImages.delete(node); }
    container.replaceChildren();
  }
  async function batches(container, items, build, valid, size = 12) {
    let next = 0, busy = false;
    const failed = error => {
      if (!valid() || error.name === "AbortError") return;
      showError(container, () => append().catch(failed), error);
    };
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) append().catch(failed);
    }, { rootMargin: "600px" }) : null;
    paging.set(container, observer);
    async function append() {
      if (busy || !valid() || next >= items.length) return;
      busy = true; observer?.disconnect();
      try {
        // Complete grid rows together so lazy insertion cannot leave a visible
        // row at a different height from the existing equal-height cards.
        const style = getComputedStyle(container);
        const columns = style.display === "grid" ? Math.max(1, style.gridTemplateColumns.split(" ").length) : 1;
        const end = Math.min(items.length, next + Math.ceil(size / columns) * columns);
        while (next < end) {
          if (!valid()) throw cancelled();
          await build(items[next]); next++;
          await turn();
        }
      } finally { busy = false; }
      if (valid() && next < items.length && container.lastElementChild) {
        if (observer) observer.observe(container.lastElementChild);
        else await append();
      } else if (next >= items.length) paging.delete(container);
    }
    await append();
  }
  const backgroundImages = new Map();
  const imageObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const url = backgroundImages.get(entry.target);
      if (url) entry.target.style.setProperty("--event-image", `url("${url}")`);
      backgroundImages.delete(entry.target); imageObserver.unobserve(entry.target);
    }
  }, { rootMargin: "400px" }) : null;
  function image(node, path) {
    node.loading = "lazy"; node.decoding = "async";
    node.src = new URL(path, document.baseURI).href;
  }
  function background(node, path) {
    const url = new URL(path, document.baseURI).href;
    if (!imageObserver) { node.style.setProperty("--event-image", `url("${url}")`); return; }
    backgroundImages.set(node, url); imageObserver.observe(node);
  }
  window.HKCIData = { receive(key, value) { const request = pending.get(key); if (request) request.payload = value; },
    dates, shops, catalog, searchDates,
    stats: () => ({ cachedParts: cache.size, pendingParts: pending.size }) };
  window.HKCILoading = { render, clear, each, batches, image, background, turn, error: showError };
})();
