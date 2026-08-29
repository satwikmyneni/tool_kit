"use strict";

const cdpPort = Number(process.argv[2] || 9333);
const origin = "http://127.0.0.1:5000";
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function connect() {
  const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page");
  if (!target) throw new Error("No Chrome page target was available.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const operation = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) operation.reject(new Error(message.error.message)); else operation.resolve(message.result);
      return;
    }
    (listeners.get(message.method) || []).forEach((listener) => listener(message.params || {}));
  });
  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  function once(method, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const handler = (params) => {
        clearTimeout(timer);
        listeners.set(method, (listeners.get(method) || []).filter((item) => item !== handler));
        resolve(params);
      };
      listeners.set(method, (listeners.get(method) || []).concat(handler));
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
    });
  }
  function on(method, handler) {
    listeners.set(method, (listeners.get(method) || []).concat(handler));
  }
  return { socket, send, once, on };
}

async function main() {
  const client = await connect();
  const failures = [];
  const consoleErrors = [];
  let currentPath = "about:blank";
  client.on("Runtime.exceptionThrown", (event) => consoleErrors.push(`${currentPath}: ${event.exceptionDetails.text}`));
  client.on("Runtime.consoleAPICalled", (event) => {
    if (event.type === "error") consoleErrors.push(`${currentPath}: console.error`);
  });
  client.on("Log.entryAdded", (event) => {
    if (event.entry && event.entry.level === "error") consoleErrors.push(`${currentPath}: ${event.entry.text}`);
  });
  await Promise.all([client.send("Page.enable"), client.send("Runtime.enable"), client.send("Log.enable")]);

  async function evaluate(expression, returnByValue = true) {
    const response = await client.send("Runtime.evaluate", { expression, returnByValue, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }

  async function navigate(path) {
    currentPath = path;
    const loaded = client.once("Page.loadEventFired");
    const response = await client.send("Page.navigate", { url: origin + path });
    if (response.errorText) throw new Error(`${path}: ${response.errorText}`);
    await loaded;
    await delay(30);
  }

  const sitemap = await fetch(origin + "/sitemap.xml").then((response) => response.text());
  const paths = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => new URL(match[1]).pathname);
  for (const path of paths) {
    try {
      await navigate(path);
      const state = await evaluate(`({
        title: document.title,
        h1: Boolean(document.querySelector('h1')),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        status: performance.getEntriesByType('navigation')[0]?.responseStatus || 200
      })`);
      if (!state.title || !state.h1 || state.overflow || state.status >= 400) failures.push({ path, state });
    } catch (error) {
      failures.push({ path, error: error.message });
    }
  }

  await evaluate("localStorage.removeItem('toolbox_favorite_tools')");
  await navigate("/tools");
  const discovery = await evaluate(`(() => {
    const search = document.querySelector('[data-tool-search]');
    search.value = 'json';
    search.dispatchEvent(new Event('input', {bubbles:true}));
    const visible = [...document.querySelectorAll('.category-block [data-tool-card]')].filter(card => !card.hidden).map(card => card.dataset.slug);
    const favorite = document.querySelector('[data-favorite="json-toolkit"]');
    favorite.click();
    document.querySelector('[data-theme-toggle]').click();
    return {
      visible,
      favorite: JSON.parse(localStorage.getItem('toolbox_favorite_tools') || '[]').includes('json-toolkit'),
      theme: document.documentElement.dataset.theme
    };
  })()`);
  if (!discovery.visible.includes("json-toolkit") || discovery.visible.some((slug) => !["json-toolkit", "jwt-decoder"].includes(slug)) || !discovery.favorite || !["light", "dark"].includes(discovery.theme)) failures.push({ discovery });

  await navigate("/tools/json-toolkit");
  const jsonResult = await evaluate(`(() => {
    document.getElementById('dev-input').value = '{"ok":true,"items":[1,2]}';
    document.querySelector('#client-tool form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
    return document.querySelector('[data-client-result]').textContent;
  })()`);
  if (!jsonResult.includes('"ok": true')) failures.push({ jsonResult });

  await navigate("/tools/password-generator");
  const passwordState = await evaluate(`(() => {
    document.getElementById('length').value = '32';
    document.querySelector('#client-tool form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
    return {text: document.querySelector('[data-client-result] pre').textContent, recent: JSON.parse(localStorage.getItem('toolbox_recent_tools') || '[]')[0]?.slug};
  })()`);
  if (passwordState.text.length !== 32 || passwordState.recent !== "password-generator") failures.push({ passwordState });

  await navigate("/tools/percentage-calculator");
  const calculatorResult = await evaluate(`(() => {
    document.getElementById('mode').value = 'change'; document.getElementById('first').value = '80'; document.getElementById('second').value = '100';
    document.querySelector('#client-tool form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
    return document.querySelector('[data-client-result]').textContent;
  })()`);
  if (!calculatorResult.includes("25%")) failures.push({ calculatorResult });

  await navigate("/");
  const personalized = await evaluate(`({recent: !document.querySelector('[data-recent-section]').hidden, favorite: !document.querySelector('[data-favorites-section]').hidden})`);
  if (!personalized.recent || !personalized.favorite) failures.push({ personalized });

  const responsivePaths = ["/", "/tools", "/pdf-tools", "/tools/pdf-splitter", "/tools/images-to-pdf", "/tools/image-resizer", "/tools/json-toolkit", "/tools/percentage-calculator", "/tools/typing-test", "/tools/expense-tracker"];
  for (const width of [320, 375, 768, 1440]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    for (const path of responsivePaths) {
      await navigate(path);
      const overflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
      if (overflow) failures.push({ path, width, error: "horizontal overflow" });
    }
  }
  await client.send("Emulation.clearDeviceMetricsOverride");
  client.socket.close();

  const result = { pagesChecked: paths.length, responsiveChecks: responsivePaths.length * 4, failures, consoleErrors };
  process.stdout.write(JSON.stringify(result, null, 2));
  if (failures.length || consoleErrors.length) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(error.stack || error.message);
  process.exitCode = 1;
});
