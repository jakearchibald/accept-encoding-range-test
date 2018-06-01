import {
  html,
  render
} from 'https://unpkg.com/lit-html/lib/lit-extended.js?module';
import {
  decodeText,
  newlineSplit,
  parseJSON
} from './transforms.js';
import {
  iterateStream,
  filterData
} from './utils.js';

const output = document.querySelector('.output');

// state:
const data = [];
let filterType = 'diff';
let filteredData = [];
let stillFetching = true;
const resultCache = new WeakMap();

function cacheResult(obj, callback) {
  if (resultCache.has(obj)) {
    return resultCache.get(obj);
  }
  const result = callback();
  const frag = document.createDocumentFragment();
  render(result, frag);
  const nodes = Array.from(frag.children);
  resultCache.set(obj, nodes);
  return nodes;
}

function updateFilteredData() {
  filteredData = filterData(data, filterType);
}

function filterOnChange(event) {
  const radios = Array.from(event.target.closest('fieldset').querySelectorAll('input[name=filter]'))
  const selected = radios.filter(el => el.checked)[0];
  filterType = selected.value;

  updateFilteredData();
  update();
}

const acceptEncodingTypes = [
  'acceptNone',
  'acceptIdentityLong',
  'acceptIdentity',
  'acceptEncoding'
];

const percentFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 2
});

function update() {
  render(html `
    <fieldset class="filter-type">
      <legend>Apply filter:</legend>
      <label class="option"><input type="radio" name="filter" on-change=${filterOnChange} value="none" checked=${filterType === 'none'}> None (slow).</label>
      <label class="option"><input type="radio" name="filter" on-change=${filterOnChange} value="diff" checked=${filterType === 'diff'}> Different results for URL.</label>
      <label class="option"><input type="radio" name="filter" on-change=${filterOnChange} value="enc-no-206" checked=${filterType === 'enc-no-206'}> Missing 206 specifically when encoding allowed.</label>
      <label class="option"><input type="radio" name="filter" on-change=${filterOnChange} value="no-enc-no-206" checked=${filterType === 'no-enc-no-206'}> Missing 206 specifically when encoding not allowed.</label>
      <label class="option"><input type="radio" name="filter" on-change=${filterOnChange} value="chrome-vs-safari" checked=${filterType === 'chrome-vs-safari'}> Differences between the identity & longer identity forms (Safari vs Chrome).</label>
      <label class="option"><input type="radio" name="filter" on-change=${filterOnChange} value="unexpected-encoding" checked=${filterType === 'unexpected-encoding'}> Unexpected encoding.</label>
    </fieldset>
    <p>
      Showing ${filteredData.length} of ${data.length} (${percentFormatter.format(filteredData.length / data.length * 100)}%)
      ${stillFetching ? '(still fetching)' : ''}
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th rowspan=2>URL</th>
          ${acceptEncodingTypes.map(type => html`
            <th colspan=2>${type}</th>
          `)}
        </tr>
        <tr>
          ${acceptEncodingTypes.map(type => html`
            <th>Status</th>
            <th>Encoding</th>
          `)}
        </tr>
      </thead>
      ${filteredData.map(item => cacheResult(item, () => html`
        <tr>
          <td class="origin"><a href=${item.url}>${new URL(item.url).origin}</a></td>
          ${acceptEncodingTypes.map(type => {
            const responseData = item[type];
            if (responseData.err) return html`
              <td colspan=2 class="unexpected">Err</td>
            `;

            const unexpectedEncoding = type.startsWith('acceptIdentity') && responseData.encoding;

            return html`
              <td class$=${responseData.status !== 206 ? 'unexpected' : ''}>${responseData.status}</td>
              <td class$=${unexpectedEncoding ? 'unexpected' : ''}>${responseData.encoding || ''}</td>
            `;
          })}
        </tr>
      `))}
    </table>
  `, output);
}

let pendingFrame;

async function main() {
  pendingFrame = requestAnimationFrame(() => {
    update();
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
      updateFilteredData();
      update();
    });
  }

  stillFetching = false;
  update();
}

main();
