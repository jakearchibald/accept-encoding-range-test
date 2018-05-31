const fs = require('fs').promises;
const path = require('path');

async function main () {
  const data = (await fs.readFile(path.join(__dirname, 'results', 'out.json'), { encoding: 'utf8', flag: 'r' }))
    .split('\n').filter(s => s.trim()).map(s => JSON.parse(s));

  for (const entry of data) {
    // I'm only interested if one of the responses is a range
    if (
      entry.acceptNone.status !== 206 &&
      entry.acceptIdentityLong.status !== 206 &&
      entry.acceptIdentity.status !== 206 &&
      entry.acceptEncoding.status !== 206
    ) continue;

    // Here's a really lazy way to look for differences:
    const acceptNone = JSON.stringify(entry.acceptNone);
    if (
      acceptNone !== JSON.stringify(entry.acceptIdentityLong) ||
      acceptNone !== JSON.stringify(entry.acceptIdentity) ||
      acceptNone !== JSON.stringify(entry.acceptEncoding)
    ) console.log(entry);
  }
}

main();
