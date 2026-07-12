(function () {
  var searchIndex = null;
  var searchInput = document.getElementById("search-input");
  var searchResults = document.getElementById("search-results");
  var isSearchPage = document.querySelector("[data-search-page]") !== null;
  var searchContainer = document.querySelector(".search-container");
  var searchIndexUrl = searchContainer ? searchContainer.getAttribute("data-search-index") : "/search.json";
  var basePath = searchIndexUrl.replace(/search\.json$/, "");

  function sitePath(path) {
    return basePath.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
  }

  function fetchIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    return fetch(searchIndexUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        searchIndex = data;
        return searchIndex;
      });
  }

  function normalize(text) {
    if (!text) return "";
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  }

  function tokenize(text) {
    return normalize(text).split(/\s+/).filter(Boolean);
  }

  function scorePage(page, queryTokens) {
    var title = normalize(page.title);
    var tags = normalize((page.tags || []).join(" "));
    var content = normalize(page.content);
    var summary = normalize(page.summary);

    var score = 0;
    var matchedTokens = {};

    for (var t = 0; t < queryTokens.length; t++) {
      var token = queryTokens[t];

      if (title.indexOf(token) !== -1) {
        score += 10;
        matchedTokens[token] = true;
        if (title === token) score += 5;
        if (title.indexOf(" " + token) !== -1) score += 3;
      }
      if (tags.indexOf(token) !== -1) {
        score += 8;
        matchedTokens[token] = true;
      }
      if (summary.indexOf(token) !== -1) {
        score += 4;
        matchedTokens[token] = true;
      }
      if (content.indexOf(token) !== -1) {
        score += 1;
        matchedTokens[token] = true;
      }
    }

    var matchedCount = Object.keys(matchedTokens).length;
    if (matchedCount === 0) return -1;
    score = score * (matchedCount / queryTokens.length);
    return score;
  }

  function findExcerpt(content, queryTokens, maxLen) {
    maxLen = maxLen || 200;
    if (!content) return "";
    var lower = content.toLowerCase();
    var bestIdx = -1;

    for (var t = 0; t < queryTokens.length; t++) {
      var idx = lower.indexOf(queryTokens[t]);
      if (idx !== -1) {
        if (bestIdx === -1 || idx < bestIdx) bestIdx = idx;
      }
    }

    if (bestIdx === -1) {
      return content.substring(0, maxLen) + (content.length > maxLen ? "..." : "");
    }

    var start = Math.max(0, bestIdx - 80);
    var end = Math.min(content.length, bestIdx + maxLen - (bestIdx - start));
    var excerpt = (start > 0 ? "..." : "") + content.substring(start, end) + (end < content.length ? "..." : "");
    return excerpt;
  }

  function highlight(text, queryTokens) {
    if (!text) return "";
    var lower = text.toLowerCase();
    for (var t = 0; t < queryTokens.length; t++) {
      var token = queryTokens[t];
      var idx = lower.indexOf(token);
      if (idx !== -1) {
        var original = text.substring(idx, idx + token.length);
        text = text.substring(0, idx) + "<mark>" + original + "</mark>" + text.substring(idx + token.length);
        lower = text.toLowerCase();
      }
    }
    return text;
  }

  function search(query) {
    if (!query || query.trim().length < 2) return [];
    var tokens = tokenize(query);
    if (tokens.length === 0) return [];

    var results = [];
    for (var i = 0; i < searchIndex.length; i++) {
      var page = searchIndex[i];
      var score = scorePage(page, tokens);
      if (score > 0) {
        results.push({ page: page, score: score });
      }
    }

    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  function renderDropdownItem(result) {
    var page = result.page;
    var tokens = tokenize(searchInput ? searchInput.value : "");
    var excerpt = findExcerpt(page.content, tokens);
    var titleHtml = highlight(page.title, tokens);

    return '<a href="' + page.url + '" class="search-result-item">' +
      '<span class="search-result-title">' + titleHtml + '</span>' +
      '<span class="search-result-meta">' + page.date +
      (page.tags && page.tags.length ? ' &middot; ' + page.tags.join(", ") : "") + '</span>' +
      '<span class="search-result-excerpt">' + highlight(excerpt, tokens) + '</span>' +
      '</a>';
  }

  function renderFullItem(result) {
    var page = result.page;
    var tokens = tokenize(document.getElementById("search-page-input") ? document.getElementById("search-page-input").value : "");
    var excerpt = findExcerpt(page.content, tokens, 300);
    var titleHtml = highlight(page.title, tokens);

    return '<article class="search-full-item">' +
      '<h2><a href="' + page.url + '">' + titleHtml + '</a></h2>' +
      '<div class="search-full-meta">' + page.date +
      (page.tags && page.tags.length ? ' &middot; ' + page.tags.map(function(t) { return '<a href="' + sitePath("tags/" + t + "/") + '">' + t + '</a>'; }).join(", ") : "") + '</div>' +
      '<p class="search-full-excerpt">' + highlight(excerpt, tokens) + '</p>' +
      '</article>';
  }

  function showDropdown(query) {
    if (!searchResults) return;
    var results = search(query);
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-results-empty">No results found</div>';
      searchResults.classList.add("active");
      return;
    }

    var html = '<div class="search-results-list">';
    var count = Math.min(results.length, 8);
    for (var i = 0; i < count; i++) {
      html += renderDropdownItem(results[i]);
    }
    if (results.length > 8) {
      html += '<a href="' + sitePath("search/?q=" + encodeURIComponent(query)) + '" class="search-view-all">View all ' + results.length + ' results &rarr;</a>';
    }
    html += '</div>';
    searchResults.innerHTML = html;
    searchResults.classList.add("active");
  }

  function hideDropdown() {
    if (searchResults) {
      searchResults.classList.remove("active");
    }
  }

  function renderFullResults(query) {
    var container = document.getElementById("search-page-results");
    if (!container) return;
    var results = search(query);
    if (results.length === 0) {
      container.innerHTML = '<p class="search-results-empty">No results found for "' + query + '"</p>';
      return;
    }

    var html = '<p class="search-results-count">' + results.length + ' result' + (results.length !== 1 ? "s" : "") + ' for "' + query + '"</p>';
    for (var i = 0; i < results.length; i++) {
      html += renderFullItem(results[i]);
    }
    container.innerHTML = html;
  }

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name) || "";
  }

  function initDropdown() {
    if (!searchInput) return;

    var debounceTimer = null;
    searchInput.addEventListener("input", function () {
      var query = searchInput.value.trim();
      if (query.length < 2) {
        hideDropdown();
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        showDropdown(query);
      }, 300);
    });

    searchInput.addEventListener("focus", function () {
      var query = searchInput.value.trim();
      if (query.length >= 2) {
        showDropdown(query);
      }
    });

    document.addEventListener("click", function (e) {
      var container = document.querySelector(".search-container");
      if (container && !container.contains(e.target)) {
        hideDropdown();
      }
    });

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        hideDropdown();
        searchInput.blur();
      }
      if (e.key === "Enter") {
        var query = searchInput.value.trim();
        if (query.length >= 2) {
          window.location.href = sitePath("search/?q=" + encodeURIComponent(query));
        }
      }
    });
  }

  function initSearchPage() {
    var pageInput = document.getElementById("search-page-input");
    if (!pageInput) return;

    var query = getQueryParam("q");
    if (query) {
      pageInput.value = query;
      fetchIndex().then(function () {
        renderFullResults(query);
      });
    }

    var debounceTimer = null;
    pageInput.addEventListener("input", function () {
      var val = pageInput.value.trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (val.length < 2) {
          var container = document.getElementById("search-page-results");
          if (container) container.innerHTML = "";
          return;
        }
        renderFullResults(val);
      }, 300);
    });
  }

  fetchIndex().then(function () {
    if (isSearchPage) {
      initSearchPage();
    }
    initDropdown();
  });
})();
