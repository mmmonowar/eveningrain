(function () {
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  var sun = "&#x2600;";
  var moon = "&#x263E;";
  var html = document.documentElement;

  function setIcon(theme) {
    btn.innerHTML = theme === "dark" ? sun : moon;
  }

  function setTheme(theme) {
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    setIcon(theme);
  }

  function toggle() {
    var current = html.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  }

  setIcon(html.getAttribute("data-theme") || "dark");
  btn.addEventListener("click", toggle);
})();
