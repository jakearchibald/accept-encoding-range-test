export function iterateStream (stream) {
  // Get a lock on the stream:
  const reader = stream.getReader();

  return {
    next () {
      // Stream reads already resolve with {done, value}, so
      // we can just call read:
      return reader.read();
    },
    return () {
      // Release the lock if the iterator terminates.
      reader.releaseLock();
      return {};
    },
    // for-await calls this on whatever it's passed, so
    // iterators tend to return themselves.
    [Symbol.asyncIterator] () {
      return this;
    }
  };
}

export function filterData (data, filterType) {
  if (filterType === 'none') {
    return data.slice();
  }

  if (filterType === 'unexpected-encoding') {
    return data.filter(item =>
      item.acceptIdentityLong.encoding ||
      item.acceptIdentity.encoding
    );
  }

  if (filterType === 'chrome-vs-safari') {
    return data.filter(item =>
      item.acceptIdentityLong.status !== item.acceptIdentity.status
    );
  }

  // I'm only interested if one of the responses is a range
  const filteredData = data.filter(item =>
    item.acceptNone.status === 206 ||
    item.acceptIdentityLong.status === 206 ||
    item.acceptIdentity.status === 206 ||
    item.acceptEncoding.status === 206
  );

  if (filterType === 'diff') {
    return filteredData.filter(item => {
      // Here's a really lazy way to look for differences:
      const acceptNone = JSON.stringify(item.acceptNone);
      return (
        acceptNone !== JSON.stringify(item.acceptIdentityLong) ||
        acceptNone !== JSON.stringify(item.acceptIdentity) ||
        acceptNone !== JSON.stringify(item.acceptEncoding)
      );
    });
  }

  if (filterType === 'enc-no-206') {
    return filteredData.filter(item =>
      (
        item.acceptNone.status === 206 ||
        item.acceptIdentityLong.status === 206 ||
        item.acceptIdentity.status === 206
      ) &&
      item.acceptEncoding.status !== 206
    );
  }

  if (filterType === 'no-enc-no-206') {
    return filteredData.filter(item =>
      (
        item.acceptNone.status !== 206 ||
        item.acceptIdentityLong.status !== 206 ||
        item.acceptIdentity.status !== 206
      ) &&
      item.acceptEncoding.status === 206
    );
  }
}
