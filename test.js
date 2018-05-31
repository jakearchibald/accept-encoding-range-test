const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const https = require('https');

const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36';
const acceptEncodingHeaders = [
  '', // Firefox
  'identity;q=1, *;q=0', // Chrome
  'identity', // Safari
  'gzip, deflate, br' // Edge
];

function promisifyGet (get) {
  return opts => new Promise((resolve, reject) => {
    const req = get(opts, response => {
      resolve(response);
      response.destroy();
    });
    req.on('error', e => reject(e));
    req.on('timeout', () => {
      reject(Error('timeout'));
      console.log('aborting');
      req.abort();
    });
    req.end();
  });
}

const httpGet = promisifyGet(http.get);
const httpsGet = promisifyGet(https.get);

function requestOptions (url) {
  return {
    hostname: url.hostname,
    path: url.pathname,
    timeout: 1000 * 10,
    headers: {
      'Range': 'bytes=0-',
      'User-Agent': ua
    }
  };
}

async function testUrl (unparsedUrl) {
  const url = new URL(unparsedUrl);
  const get = url.protocol === 'http:' ? httpGet : httpsGet;

  const baseOpts = requestOptions(url);

  const [acceptNone, acceptIdentityLong, acceptIdentity, acceptEncoding] = await Promise.all(acceptEncodingHeaders.map(async acceptEncodingHeader => {
    const opts = Object.assign({}, baseOpts);

    if (acceptEncodingHeader) opts.headers['Accept-Encoding'] = acceptEncodingHeader;

    try {
      const response = await get(opts);
      return {
        status: response.statusCode,
        encoding: response.headers['content-encoding'] || ''
      };
    } catch (err) {
      return {
        err: true
      };
    }
  }));

  return {
    url: unparsedUrl,
    acceptNone,
    acceptIdentityLong,
    acceptIdentity,
    acceptEncoding
  };
}

async function testFromJson () {
  const output = require('fs').createWriteStream(path.join(__dirname, 'results', 'out.json'), { encoding: 'utf8' });
  const data = (await fs.readFile(path.join(__dirname, 'data.json'), { encoding: 'utf8', flag: 'r' }))
    .split('\n').map(s => JSON.parse(s));

  let remaining = data.length;
  // Not real threads of course
  const threads = Array(5).fill();

  await Promise.all(
    threads.map(async () => {
      let item;

      while (item = data.pop()) {
        const result = await testUrl(item.url);
        output.write(JSON.stringify(result) + '\n');
        remaining--;
        console.log(remaining, 'remaining');
      }
    })
  );
}

module.exports = {
  testFromJson,
  testUrl
};
