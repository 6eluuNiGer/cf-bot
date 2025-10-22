const isProd = process.env.NODE_ENV === 'production';

function ts() { return new Date().toISOString(); }

module.exports = {
  info: (...args) => console.log(ts(), '[INFO]', ...args),
  warn: (...args) => console.warn(ts(), '[WARN]', ...args),
  error: (...args) => console.error(ts(), '[ERROR]', ...args),
  debug: (...args) => { if (!isProd) console.log(ts(), '[DEBUG]', ...args); },
};
