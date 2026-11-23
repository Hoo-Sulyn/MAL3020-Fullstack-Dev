// Browser origins allowed to call the API and open the Socket.IO connection:
// the Angular app on this computer, or on another computer in the same private network
// (home, hotel or university Wi-Fi), always on port 4200. Anything else is refused.
const allowedOrigin = new RegExp(
  '^http://(localhost|127\\.0\\.0\\.1|10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}):4200$'
);

function isAllowedOrigin(origin) {
  // Requests with no Origin header (curl, server-to-server, same-origin) are not cross-site.
  return !origin || allowedOrigin.test(origin);
}

/** For the `origin` option of the cors package and of Socket.IO. */
function corsOrigin(origin, callback) {
  callback(null, isAllowedOrigin(origin));
}

module.exports = { isAllowedOrigin, corsOrigin };
