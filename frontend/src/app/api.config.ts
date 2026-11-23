/**
 * The API runs on port 3000 of the same computer that served this page. Using the page's own
 * host name (instead of a fixed "localhost") lets the site work from other computers on the
 * network, which would otherwise try to reach an API on themselves.
 */
export const API_ORIGIN = `${window.location.protocol}//${window.location.hostname}:3000`;
