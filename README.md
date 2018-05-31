In [fetch/747](https://github.com/whatwg/fetch/issues/747#issuecomment-393239732) it was suggested that browsers should send `Accept-Encoding: identity` along with range requests, else some servers ignore the range and return a 200. So, this is a test!

`data.json` contains all the URLs in [HTTP archive](https://httparchive.org/) that end in `mp3` or `mp4`, de-duped by host. **Warning:** These are media files from the internet, so many will be not safe for work.

Here's the query:

```sql
SELECT ANY_VALUE(url) as url FROM `httparchive.runs.2018_02_15_requests`
WHERE REGEXP_CONTAINS (url, r'\.(mp4|mp3)$')
GROUP BY req_host
```

The test makes requests to those URLs with the following headers:

```
Range: bytes=0-
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36
```

It makes a request without an `Accept-Encoding` header, then makes additional request for each of these headers:

```
Accept-Encoding: identity;q=1, *;q=0
Accept-Encoding: identity
Accept-Encoding: gzip, deflate, br
```

And records the status code & `Content-Encoding` header for each response, or `{err: true}` if the request timed out or failed.

The results are in `results/out.json`.

**Note:** The data is [ndjson](http://ndjson.org/). Also, some servers may be unstable and return different results each time.

# Running the test

Requires [Node](https://nodejs.org/en/) 10.2.1+.

```sh
# Generate results/out.json from data.json
node index.js
# Print the results for a particular URL
node test-url.js https://www.narita-airport.jp/files/bg.mp4
# Print results where the return is different depending on Accept-Encoding
node log-interesting-results.js
```
