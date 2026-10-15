const app = require("./app");

const MIN_SECRET_LENGTH = 32;
const secret = process.env.JWT_SECRET || "";

// Never run without a secret. In production a short/guessable secret is
// also fatal; in development it is only a warning so a local .env keeps
// working.
if (!secret) {
  console.error("JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}
if (secret.length < MIN_SECRET_LENGTH) {
  if (process.env.NODE_ENV === "production") {
    console.error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production. Refusing to start.`);
    process.exit(1);
  }
  console.warn(`Warning: JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Use a long random value.`);
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`TripFlow API ${PORT} portunda çalışıyor.`);
});
