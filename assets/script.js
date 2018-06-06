import { decodeText, newlineSplit, parseJSON } from './transforms.js';
import { filterData } from './utils.js';

const output = document.querySelector('.output');

// state:
const data = [];
let filterType = 'diff';
let filteredData = [];
let stillFetching = true;

function updateFilteredData () {
  filteredData = filterData(data, filterType);
}

function filterOnChange (event) {
  const radios = Array.from(event.target.closest('fieldset').querySelectorAll('input[name=filter]'))
  const selected = radios.filter(el => el.checked)[0];
  filterType = selected.value;

  updateFilteredData();
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
      Showing ${filteredData.length} of ${data.length} (${data.length ? percentFormatter.format(filteredData.length / data.length * 100) : 0}%)
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
        <tr>${
          [
            hyperHTML.wire(item, ':first')`
            <td class="origin"><a href=${item.url}>${new URL(item.url).origin}</a></td>`
          ].concat(acceptEncodingTypes.map(type => {
            const responseData = item[type];
            if (responseData.err)
              return hyperHTML.wire(responseData)`
              <td colspan=2 class="unexpected">Err</td>`;

            const unexpectedEncoding = type.startsWith('acceptIdentity') && responseData.encoding;
            return hyperHTML.wire(responseData)`
              <td class="${responseData.status !== 206 ? 'unexpected' : ''}">${responseData.status}</td>
              <td class="${unexpectedEncoding ? 'unexpected' : ''}">${responseData.encoding || ''}</td>
            `;
          }))
        }</tr>
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

  if ('TransformStream' in self) {
    // Progressive render using streams:
    const stream = response.body
      .pipeThrough(decodeText())
      .pipeThrough(newlineSplit())
      .pipeThrough(parseJSON());

    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      data.push(value);
      cancelAnimationFrame(pendingFrame);
      pendingFrame = requestAnimationFrame(() => {
        updateFilteredData();
        render();
      });
    }

    cancelAnimationFrame(pendingFrame);
    stillFetching = false;
    updateFilteredData();
    render();
  } else {
    // Just process all the data at once
    const text = await response.text();

    for (const item of text.split('\n')) {
      if (!item.trim()) continue;
      data.push(JSON.parse(item));
    }
    stillFetching = false;
    updateFilteredData();
    render();
  }
}

main();
