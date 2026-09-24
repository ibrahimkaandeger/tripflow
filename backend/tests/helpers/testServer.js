// Boots the real, unmodified Express app (src/app.js) on an OS-
// assigned ephemeral port (port 0) -- never a hardcoded port, so
// tests never collide with a dev server that happens to be running
// on 5000. This is the actual app: real middleware chain, real JWT
// verification, real permission/company-membership checks, real
// Postgres queries.
//
// src/app.js pulls in src/config/db.js, which builds its OWN pool
// from process.env.DB_NAME with no safety check of its own (it's
// production code -- it shouldn't know about test concerns). Without
// the require below, that pool's safety would depend entirely on
// every test file happening to require testDb.js *first* -- a
// convention, not a guarantee. Requiring it here, before app.js,
// makes the DB_NAME === "tripflow_test" guard run no matter what
// order a test file requires its helpers in.
require("./testDb");
const app = require("../../src/app");

function startTestServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0);

    server.on("listening", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });

    server.on("error", reject);
  });
}

module.exports = { startTestServer };
