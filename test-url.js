const { testUrl } = require('./test.js');

testUrl(process.argv.slice(-1)[0]).then(result => console.log(result));
