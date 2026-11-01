/**
 * Resolves the backend API base URL from Frontend/.env.
 *
 * There is no bundler in this project, so the .env file is fetched once when
 * the page loads and parsed in the browser. The value is exposed as
 * window.API_BASE_URL, and window.API_BASE_READY resolves with it so pages can
 * wait before sending their first request.
 *
 * If .env cannot be read (file:// pages, or a host that blocks dotfiles) the
 * loader keeps a safe fallback: the local API in development and
 * "<origin>/api" in production.
 */
(function () {
  var LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

  function trimmed(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function parseEnvFile(contents) {
    var values = {};
    String(contents || "").split(/\r?\n/).forEach(function (line) {
      var trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.charAt(0) === "#") return;

      var separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex === -1) return;

      var key = trimmedLine.slice(0, separatorIndex).trim();
      var value = trimmedLine.slice(separatorIndex + 1).trim();
      var isQuoted =
        (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
        (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'");
      if (isQuoted) value = value.slice(1, -1);

      values[key] = value;
    });
    return values;
  }

  var isLocalDev =
    window.location.protocol === "file:" ||
    LOCAL_HOSTS.indexOf(window.location.hostname) !== -1;

  var fallbackBase = isLocalDev
    ? "http://localhost:4000/api"
    : window.location.origin + "/api";

  window.API_BASE_URL = trimmed(window.API_BASE_URL) || fallbackBase;

  // Pages live in Frontend/Pages/, so .env is one directory up.
  window.API_BASE_READY = fetch("../.env", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Failed to load .env");
      return response.text();
    })
    .then(function (contents) {
      var configuredBase = trimmed(parseEnvFile(contents).API_BASE_URL);
      if (configuredBase) window.API_BASE_URL = configuredBase;
      return window.API_BASE_URL;
    })
    .catch(function () {
      return window.API_BASE_URL;
    });
})();
