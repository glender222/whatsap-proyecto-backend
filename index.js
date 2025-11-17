// Minimal entrypoint for compatibility with existing npm scripts
// Loads the application implemented in `src/app.js`.
try {
  require('./src/app.js');
} catch (err) {
  console.error('Failed to start application from ./src/app.js');
  console.error(err);
  process.exit(1);
}
