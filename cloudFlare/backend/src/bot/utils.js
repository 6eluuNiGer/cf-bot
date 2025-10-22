function parseArgs(s) {
  const regex = /(\w+)=(".*?"|'.*?'|\S+)/g;
  const out = {}; let m;
  while ((m = regex.exec(s)) !== null) {
    const key = m[1]; let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

function validDomain(d) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d);
}

module.exports = { parseArgs, validDomain };
