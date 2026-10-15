/**
 * Single source of truth for the backend API location.
 *
 * Local development talks to the Express server on http://localhost:4000.
 * Production must point at the deployed API. Set PRODUCTION_API_BASE below to
 * the deployed origin (for example "https://sasta-leja-api.onrender.com/api").
 * Leave it empty only when the API is served from the same origin as the site
 * (for example behind a reverse proxy that forwards "/api" to the backend).
 */
(function () {
  var PRODUCTION_API_BASE = "";

  var LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

  function trimmed(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  var isLocalDev =
    window.location.protocol === "file:" ||
    LOCAL_HOSTS.indexOf(window.location.hostname) !== -1;

  // An explicit override (set before this script runs) always wins.
  var base = trimmed(window.SASTA_API_BASE);

  if (!base) {
    if (isLocalDev) {
      base = "http://localhost:4000/api";
    } else {
      base = trimmed(PRODUCTION_API_BASE) || window.location.origin + "/api";
    }
  }

  window.SASTA_API_BASE = base;
})();
