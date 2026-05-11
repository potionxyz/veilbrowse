const EventEmitter = require('events');

// Shared event bus for Server-Sent Events.
// launcher.js emits; index.js broadcasts to connected SSE clients.
const bus = new EventEmitter();
bus.setMaxListeners(100);

module.exports = bus;
