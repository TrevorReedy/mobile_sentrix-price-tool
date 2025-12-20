/**
 * @jest-environment jsdom
 */

// mock the URL that your script tests
delete window.location;
window.location = new URL('https://cpr.parts/replacement-parts/iphone-12-pro-max');

const { inject } = require('../../src/inject/notes.js');

test('injects textarea under h1', async () => {
  document.body.innerHTML = `<h1 class="category-title">iPhone 12 Pro Max</h1>`;

  await inject();
  expect(document.querySelector('textarea')).toBeTruthy();
});