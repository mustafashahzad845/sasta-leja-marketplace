/**
 * Frontend API configuration.
 *
 * This is the single place the frontend reads its API base URL from.
 * Change these two constants when the API location changes.
 *
 * Why not a .env file? A plain static frontend cannot read .env reliably:
 * the file is gitignored (so it is not deployed) and many static hosts refuse
 * to serve dotfiles. Fetching it at runtime caused the production 404s.
 *
 * A page may still define window.API_BASE_URL before this script runs to
 * override the value for a specific environment.
 */
(function () {
  var LOCAL_API_BASE_URL = "http://localhost:4000/api";
  var PRODUCTION_API_BASE_URL = "https://sasta-leja-marketplace-backend.vercel.app/api";

  var LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

  function trimmed(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  var isLocalDev =
    window.location.protocol === "file:" ||
    LOCAL_HOSTS.indexOf(window.location.hostname) !== -1;

  var override = trimmed(window.API_BASE_URL);
  var base = override || (isLocalDev ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL);

  window.API_BASE_URL = base;

  // Kept so pages can wait for the value without a race. The value is already
  // available synchronously, so this resolves immediately.
  window.API_BASE_READY = Promise.resolve(base);
})();
