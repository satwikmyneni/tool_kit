"use strict";

const cdpPort = Number(process.argv[2] || 9333);
const origin = "http://127.0.0.1:5000";
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const samplePdfBase64 = "JVBERi0xLjcKJcK1wrYKJSBXcml0dGVuIGJ5IE11UERGIDEuMjguMgoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFIvSW5mbzw8L1Byb2R1Y2VyKE11UERGIDEuMjguMik+Pj4+CmVuZG9iagoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDIvS2lkc1s0IDAgUiA4IDAgUl0+PgplbmRvYmoKCjMgMCBvYmoKPDwvRm9udDw8L2hlbHYgNSAwIFI+Pj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDMwMCA0MDBdL1JvdGF0ZSAwL1Jlc291cmNlcyAzIDAgUi9QYXJlbnQgMiAwIFIvQ29udGVudHNbNiAwIFJdPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYS9FbmNvZGluZy9XaW5BbnNpRW5jb2Rpbmc+PgplbmRvYmoKCjYgMCBvYmoKPDwvTGVuZ3RoIDk3L0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp42hWHMQqEUAwF+5wiNzCJ5kVBLBa2sVtIt2y1+rHQwsbz++UxMzw66ZWkLHXKLtxW8qBmW/eLVTkLf0cXKAJugoL1qS0m3tVX8IehRG8SEgYPYKiO6ZczvZM+dANg+RajCmVuZHN0cmVhbQplbmRvYmoKCjcgMCBvYmoKPDwvRm9udDw8L2hlbHYgNSAwIFI+Pj4+CmVuZG9iagoKOCAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDQwMCAzMDBdL1JvdGF0ZSAwL1Jlc291cmNlcyA3IDAgUi9QYXJlbnQgMiAwIFIvQ29udGVudHNbOSAwIFJdPj4KZW5kb2JqCgo5IDAgb2JqCjw8L0xlbmd0aCA5Mi9GaWx0ZXIvRmxhdGVEZWNvZGU+PgpzdHJlYW0KeNoViSkOgEAMAH1f0R/QNj0MQZBgcCR1BMduECAwvJ/dTMbMwAtzAiM1GI1QmvnAcJX7Q2bMivto5OzhJhQa4VVITiHXkN6l3+LarngNdW7adOQKS8IGP0RGFfoKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDEwCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA0MiAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIG4gCjAwMDAwMDAxNzggMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzI2IDAwMDAwIG4gCjAwMDAwMDA0MTUgMDAwMDAgbiAKMDAwMDAwMDU4MCAwMDAwMCBuIAowMDAwMDAwNjIxIDAwMDAwIG4gCjAwMDAwMDA3MjggMDAwMDAgbiAKCnRyYWlsZXIKPDwvU2l6ZSAxMC9Sb290IDEgMCBSL0lEWzxDMkE0QzNCNTY1MTlDM0FGQzNBRkMzQUMzRjQxQzNCOD48NUFENUMzQkQxMEQ2NEMyRTYxRTIyNTBENzE1NjdENUY+XT4+CnN0YXJ0eHJlZgo4ODgKJSVFT0YK";

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

  async function waitFor(expression, timeout = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return true;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }

  async function attachSamplePdfs(selector, names = ["qa-preview.pdf"]) {
    return evaluate(`(() => {
      const binary = atob(${JSON.stringify(samplePdfBase64)});
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const transfer = new DataTransfer();
      ${JSON.stringify(names)}.forEach(name => transfer.items.add(new File([bytes], name, {type:'application/pdf'})));
      const input = document.querySelector(${JSON.stringify(selector)});
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
      return input.files.length;
    })()`);
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

  await navigate("/tools/pdf-splitter");
  await attachSamplePdfs("#utility-files");
  await waitFor("document.querySelectorAll('.pdf-page-card').length === 2");
  const splitPreview = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('.pdf-page-card')];
    document.querySelector('[data-pages-clear]').click();
    cards[1].querySelector('.btn-page-select').click();
    return {cards: cards.length, actualImages: cards.every(card => card.querySelector('img').src.startsWith('data:image/png;base64,')), pages: document.getElementById('pages').value, selectedText: cards[1].querySelector('.pdf-selected-label').textContent};
  })()`);
  if (splitPreview.cards !== 2 || !splitPreview.actualImages || splitPreview.pages !== "2" || splitPreview.selectedText !== "Selected") failures.push({ splitPreview });

  await navigate("/tools/reorder-pdf-pages");
  await attachSamplePdfs("#utility-files");
  await waitFor("document.querySelectorAll('.pdf-page-card').length === 2");
  const reorderState = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('.pdf-page-card')];
    const transfer = new DataTransfer();
    cards[0].dispatchEvent(new DragEvent('dragstart', {bubbles:true, dataTransfer:transfer}));
    cards[1].dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:transfer}));
    return {order: document.getElementById('pages').value, first: document.querySelector('.pdf-page-card strong').textContent};
  })()`);
  if (reorderState.order !== "2,1" || reorderState.first !== "Page 2") failures.push({ reorderState });

  await navigate("/tools/rotate-pdf");
  await attachSamplePdfs("#utility-files");
  await waitFor("document.querySelectorAll('.pdf-page-card').length === 2");
  const rotateState = await evaluate(`(() => {
    document.querySelector('[aria-label="Rotate page 1 clockwise"]').click();
    return {rotations: document.getElementById('rotations').value, transform: document.querySelector('.pdf-page-card img').style.transform, label: document.querySelector('.pdf-selected-label').textContent};
  })()`);
  if (rotateState.rotations !== '{"1":90}' || rotateState.transform !== "rotate(90deg)" || !rotateState.label.includes("90")) failures.push({ rotateState });

  await navigate("/tools/delete-pdf-pages");
  await attachSamplePdfs("#utility-files");
  await waitFor("document.querySelectorAll('.pdf-page-card').length === 2");
  const deleteState = await evaluate(`(() => { document.querySelector('.btn-page-select').click(); return {pages: document.getElementById('pages').value, label: document.querySelector('.pdf-selected-label').textContent, pressed: document.querySelector('.btn-page-select').getAttribute('aria-pressed')}; })()`);
  if (deleteState.pages !== "1" || deleteState.label !== "Delete" || deleteState.pressed !== "true") failures.push({ deleteState });

  await navigate("/tools/pdf-merger");
  await attachSamplePdfs("#pdf-files", ["first.pdf", "second.pdf"]);
  await waitFor("document.querySelectorAll('.pdf-merge-file').length === 2");
  await evaluate("document.querySelector('.pdf-merge-file [aria-label^=\"Show pages\"]').click()");
  await waitFor("document.querySelectorAll('.pdf-merge-preview img').length === 2");
  const mergerState = await evaluate(`({files: document.querySelectorAll('.pdf-merge-file').length, previews: document.querySelectorAll('.pdf-merge-preview img').length, pageText: document.querySelector('.pdf-merge-file .muted').textContent})`);
  if (mergerState.files !== 2 || mergerState.previews !== 2 || !mergerState.pageText.includes("2 pages")) failures.push({ mergerState });

  await navigate("/pdf-to-word");
  await attachSamplePdfs("#conversion-file");
  await evaluate("document.getElementById('document-conversion-form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}))");
  await waitFor("!document.querySelector('[data-result]').hidden", 15000);
  const conversionState = await evaluate(`({ready: !document.querySelector('[data-result]').hidden, download: document.querySelector('[data-download]').download, href: document.querySelector('[data-download]').href.startsWith('blob:')})`);
  if (!conversionState.ready || conversionState.download !== "converted-document.docx" || !conversionState.href) failures.push({ conversionState });

  await navigate("/");
  const themeControl = await evaluate(`(() => { const button = document.querySelector('[data-theme-toggle]'); return {text: button.textContent.trim(), icons: button.querySelectorAll('svg').length, label: button.getAttribute('aria-label'), width: button.getBoundingClientRect().width}; })()`);
  if (themeControl.text || themeControl.icons !== 2 || !themeControl.label.startsWith("Switch to") || themeControl.width !== 44) failures.push({ themeControl });

  const responsivePaths = ["/", "/tools", "/pdf-tools", "/tools/pdf-merger", "/tools/pdf-splitter", "/tools/reorder-pdf-pages", "/pdf-to-word", "/pdf-to-excel", "/pdf-to-powerpoint", "/word-to-pdf", "/jpg-to-pdf", "/tools/images-to-pdf", "/tools/image-resizer", "/tools/json-toolkit", "/tools/percentage-calculator", "/tools/typing-test", "/tools/expense-tracker"];
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
