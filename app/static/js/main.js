(function () {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");

  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  const search = document.querySelector("[data-tool-search]");
  if (!search) {
    return;
  }

  const cards = Array.prototype.slice.call(document.querySelectorAll("[data-tool-card]"));
  const empty = document.querySelector("[data-search-empty]");
  const status = document.querySelector("[data-search-status]");
  const blocks = Array.prototype.slice.call(document.querySelectorAll(".category-block"));

  function filterTools() {
    const query = search.value.trim().toLowerCase();
    const visibleSlugs = new Set();

    cards.forEach(function (card) {
      const haystack = [
        card.getAttribute("data-name") || "",
        card.getAttribute("data-description") || "",
        card.getAttribute("data-category") || "",
        card.getAttribute("data-keywords") || "",
      ].join(" ");
      const match = !query || haystack.indexOf(query) !== -1;
      card.hidden = !match;
      if (match) {
        visibleSlugs.add(card.getAttribute("data-slug") || card.getAttribute("data-name"));
      }
    });

    blocks.forEach(function (block) {
      const visibleCards = block.querySelectorAll("[data-tool-card]:not([hidden])");
      block.hidden = visibleCards.length === 0;
    });

    if (empty) {
      empty.hidden = visibleSlugs.size !== 0;
    }

    if (status) {
      if (!query) {
        status.textContent = "";
      } else if (visibleSlugs.size === 0) {
        status.textContent = "No matching tools.";
      } else {
        status.textContent = visibleSlugs.size + (visibleSlugs.size === 1 ? " tool found." : " tools found.");
      }
    }
  }

  search.addEventListener("input", filterTools);
})();
