(function () {
  "use strict";

  var KEYS = {
    favorites: "toolbox_favorite_tools",
    recent: "toolbox_recent_tools",
    preferences: "toolbox_preferences"
  };

  function readJSON(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) { /* storage is optional */ }
  }

  function uniqueStrings(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (item, index, values) {
      return typeof item === "string" && item && values.indexOf(item) === index;
    });
  }

  window.ToolboxAnalytics = {
    track: function (eventName, details) {
      var provider = document.body ? document.body.dataset.analyticsProvider : "";
      if (!provider) return;
      window.dispatchEvent(new CustomEvent("toolbox:analytics", {
        detail: { event: eventName, tool: (details || {}).tool || "" }
      }));
    }
  };

  var nav = document.querySelector("[data-nav]");
  var navToggle = document.querySelector("[data-nav-toggle]");
  if (nav && navToggle) {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var preferences = readJSON(KEYS.preferences, {});
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) preferences = {};
  var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var homepage = document.body && document.body.classList.contains("home-page");
  var theme = preferences.theme === "dark" || preferences.theme === "light" ? preferences.theme : (homepage || systemDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  var themeButton = document.querySelector("[data-theme-toggle]");
  function renderThemeButton() {
    if (!themeButton) return;
    var dark = document.documentElement.dataset.theme === "dark";
    themeButton.setAttribute("aria-pressed", dark ? "true" : "false");
    themeButton.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    themeButton.title = dark ? "Switch to light theme" : "Switch to dark theme";
  }
  if (themeButton) {
    renderThemeButton();
    themeButton.addEventListener("click", function () {
      theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      preferences.theme = theme;
      writeJSON(KEYS.preferences, preferences);
      renderThemeButton();
    });
  }

  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-tool-card]"));
  var favoriteSlugs = uniqueStrings(readJSON(KEYS.favorites, []));

  function renderFavorites() {
    document.querySelectorAll("[data-favorite]").forEach(function (button) {
      var selected = favoriteSlugs.indexOf(button.dataset.favorite) !== -1;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.classList.toggle("is-favorite", selected);
      var star = button.querySelector(".favorite-star path");
      if (star) star.setAttribute("fill", selected ? "currentColor" : "none");
      button.setAttribute("aria-label", (selected ? "Remove " : "Add ") + button.dataset.favorite.replace(/-/g, " ") + (selected ? " from favorites" : " to favorites"));
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-favorite]");
    if (!button) return;
    var slug = button.dataset.favorite;
    var index = favoriteSlugs.indexOf(slug);
    if (index === -1) favoriteSlugs.push(slug); else favoriteSlugs.splice(index, 1);
    writeJSON(KEYS.favorites, favoriteSlugs);
    renderFavorites();
    renderPersonalized();
  });

  var currentSlug = document.body ? document.body.dataset.toolSlug : "";
  var recent = readJSON(KEYS.recent, []);
  if (!Array.isArray(recent)) recent = [];
  recent = recent.filter(function (item) {
    return item && typeof item.slug === "string" && Number.isFinite(Number(item.timestamp));
  });
  if (currentSlug) {
    recent = recent.filter(function (item) { return item.slug !== currentSlug; });
    recent.unshift({ slug: currentSlug, timestamp: Date.now() });
    recent = recent.slice(0, 8);
    writeJSON(KEYS.recent, recent);
    window.ToolboxAnalytics.track("tool_open", { tool: currentSlug });
  }

  function firstCard(slug) {
    return cards.find(function (card) { return card.dataset.slug === slug; });
  }

  function fillGrid(grid, slugs) {
    if (!grid) return 0;
    grid.innerHTML = "";
    var count = 0;
    var limit = Number(grid.dataset.limit || 0);
    slugs.forEach(function (slug) {
      if (limit && count >= limit) return;
      var card = firstCard(slug);
      if (!card) return;
      var clone = card.cloneNode(true);
      clone.hidden = false;
      grid.appendChild(clone);
      count += 1;
    });
    return count;
  }

  function renderPersonalized() {
    document.querySelectorAll("[data-personalized]").forEach(function (wrapper) {
      var favoriteSection = wrapper.querySelector("[data-favorites-section]");
      var recentSection = wrapper.querySelector("[data-recent-section]");
      var favoriteCount = fillGrid(wrapper.querySelector("[data-favorites-grid]"), favoriteSlugs);
      var recentCount = fillGrid(wrapper.querySelector("[data-recent-grid]"), recent.map(function (item) { return item.slug; }));
      if (favoriteSection) favoriteSection.hidden = favoriteCount === 0;
      if (recentSection) recentSection.hidden = recentCount === 0;
      wrapper.hidden = favoriteCount + recentCount === 0;
    });
    renderFavorites();
  }
  renderPersonalized();

  var search = document.querySelector("[data-tool-search]");
  if (search) {
    var empty = document.querySelector("[data-search-empty]");
    var status = document.querySelector("[data-search-status]");
    var blocks = Array.prototype.slice.call(document.querySelectorAll(".category-block"));
    function filterTools() {
      var query = search.value.trim().toLocaleLowerCase();
      document.querySelectorAll("[data-personalized]").forEach(function (section) { section.hidden = Boolean(query); });
      var visibleSlugs = new Set();
      cards.forEach(function (card) {
        var haystack = ["name", "description", "category", "keywords"].map(function (key) {
          return card.getAttribute("data-" + key) || "";
        }).join(" ");
        var match = !query || haystack.indexOf(query) !== -1;
        card.hidden = !match;
        if (match) visibleSlugs.add(card.dataset.slug);
      });
      blocks.forEach(function (block) {
        block.hidden = block.querySelectorAll("[data-tool-card]:not([hidden])").length === 0;
      });
      document.querySelectorAll("[data-search-group]").forEach(function (group) {
        group.hidden = group.querySelectorAll("[data-tool-card]:not([hidden])").length === 0;
      });
      if (empty) empty.hidden = visibleSlugs.size !== 0;
      if (status) status.textContent = !query ? "" : (visibleSlugs.size ? visibleSlugs.size + (visibleSlugs.size === 1 ? " tool found." : " tools found.") : "No matching tools.");
    }
    search.addEventListener("input", filterTools);
    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.focus();
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
        event.preventDefault();
        search.focus();
      }
    });
  }

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/service-worker.js").catch(function () { /* optional enhancement */ });
    });
  }
})();
