(function () {
  function initNavbarScrollShadow() {
    var navbar = document.getElementById("mainNavbar");
    if (!navbar) return;

    function onScroll() {
      if (window.scrollY > 10) navbar.classList.add("navbar-scrolled");
      else navbar.classList.remove("navbar-scrolled");
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavbarScrollShadow);
  } else {
    initNavbarScrollShadow();
  }
})();

