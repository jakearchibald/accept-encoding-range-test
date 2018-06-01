import { decodeText, newlineSplit, parseJSON } from './transforms.js';
import { iterateStream } from './utils.js';

const output = document.querySelector('.output');

// state:
const data = [];
let filterType = 'diff';
let filteredData = [];
let stillFetching = true;

function filterData () {
  if (filterType === 'none') {
    filteredData = data.slice();
    return;
  }

  if (filterType === 'unexpected-encoding') {
    filteredData = data.filter(item =>
      item.acceptIdentityLong.encoding ||
      item.acceptIdentity.encoding
    );
    return;
  }

  if (filterType === 'chrome-vs-safari') {
    filteredData = data.filter(item =>
      item.acceptIdentityLong.status !== item.acceptIdentity.status
    );
    return;
  }

  // I'm only interested if one of the responses is a range
  filteredData = data.filter(item =>
    item.acceptNone.status === 206 ||
    item.acceptIdentityLong.status === 206 ||
    item.acceptIdentity.status === 206 ||
    item.acceptEncoding.status === 206
  );

  if (filterType === 'diff') {
    filteredData = filteredData.filter(item => {
      // Here's a really lazy way to look for differences:
      const acceptNone = JSON.stringify(item.acceptNone);
      return (
        acceptNone !== JSON.stringify(item.acceptIdentityLong) ||
        acceptNone !== JSON.stringify(item.acceptIdentity) ||
        acceptNone !== JSON.stringify(item.acceptEncoding)
      );
    });
    return;
  }

  if (filterType === 'enc-no-206') {
    filteredData = filteredData.filter(item =>
      (
        item.acceptNone.status === 206 ||
        item.acceptIdentityLong.status === 206 ||
        item.acceptIdentity.status === 206
      ) &&
      item.acceptEncoding.status !== 206
    );
    return;
  }

  if (filterType === 'no-enc-no-206') {
    filteredData = filteredData.filter(item =>
      (
        item.acceptNone.status !== 206 ||
        item.acceptIdentityLong.status !== 206 ||
        item.acceptIdentity.status !== 206
      ) &&
      item.acceptEncoding.status === 206
    );
    return;
  }
}

function filterOnChange (event) {
  const radios = Array.from(event.target.closest('fieldset').querySelectorAll('input[name=filter]'))
  const selected = radios.filter(el => el.checked)[0];
  filterType = selected.value;

  filterData();
  render();
}

const acceptEncodingTypes = [
  'acceptNone',
  'acceptIdentityLong',
  'acceptIdentity',
  'acceptEncoding'
];

const acceptEncodingTypesObjs = acceptEncodingTypes.map(t => ({name: t}));
const percentFormatter = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

function render () {
  hyperHTML(output)`
    <fieldset class="filter-type">
      <legend>Apply filter:</legend>
      <label class="option"><input type="radio" name="filter" onchange=${filterOnChange} value="none" checked=${filterType === 'none'}> None (slow).</label>
      <label class="option"><input type="radio" name="filter" onchange=${filterOnChange} value="diff" checked=${filterType === 'diff'}> Different results for URL.</label>
      <label class="option"><input type="radio" name="filter" onchange=${filterOnChange} value="enc-no-206" checked=${filterType === 'enc-no-206'}> Missing 206 specifically when encoding allowed.</label>
      <label class="option"><input type="radio" name="filter" onchange=${filterOnChange} value="no-enc-no-206" checked=${filterType === 'no-enc-no-206'}> Missing 206 specifically when encoding not allowed.</label>
      <label class="option"><input type="radio" name="filter" onchange=${filterOnChange} value="chrome-vs-safari" checked=${filterType === 'chrome-vs-safari'}> Differences between the identity & longer identity forms (Safari vs Chrome).</label>
      <label class="option"><input type="radio" name="filter" onchange=${filterOnChange} value="unexpected-encoding" checked=${filterType === 'unexpected-encoding'}> Unexpected encoding.</label>
    </fieldset>
    <p>
      Showing ${filteredData.length} of ${data.length} (${percentFormatter.format(filteredData.length / data.length * 100)}%)
      ${stillFetching ? '(still fetching)' : ''}
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th rowspan=2>URL</th>
          ${acceptEncodingTypesObjs.map(type => hyperHTML.wire(type, ':heading')`
            <th colspan=2>${type.name}</th>
          `)}
        </tr>
        <tr>
          ${acceptEncodingTypesObjs.map(type => hyperHTML.wire(type, ':sub-heading')`
            <th>Status</th>
            <th>Encoding</th>
          `)}
        </tr>
      </thead>
      ${filteredData.map(item => hyperHTML.wire(item)`
        <tr>
          <td class="origin"><a href=${item.url}>${new URL(item.url).origin}</a></td>
          ${acceptEncodingTypes.map(type => {
            const responseData = item[type];
            if (responseData.err) return hyperHTML.wire(responseData, ':single')`
              <td colspan=2 class="unexpected">Err</td>
            `;

            const unexpectedEncoding = type.startsWith('acceptIdentity') && responseData.encoding;

            return hyperHTML.wire(responseData, ':double')`
              <td class="${responseData.status !== 206 ? 'unexpected' : ''}">${responseData.status}</td>
              <td class="${unexpectedEncoding ? 'unexpected' : ''}">${responseData.encoding || ''}</td>
            `;
          })}
        </tr>
      `)}
    </table>
  `;
}

let pendingFrame;

async function main () {
  pendingFrame = requestAnimationFrame(() => {
    render();
  });

  const response = await self.prefetch;
  const stream = response.body
    .pipeThrough(decodeText())
    .pipeThrough(newlineSplit())
    .pipeThrough(parseJSON());

  for await (const item of iterateStream(stream)) {
    data.push(item);
    cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      filterData();
      render();
    });
  }

  stillFetching = false;
  render();
}

main();
