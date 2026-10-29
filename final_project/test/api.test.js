const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../index');
const api = require('../router/general');
let server, base, client;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  client = api.createBookClient(base);
});
after(() => new Promise(resolve => server.close(resolve)));
async function request(url, method = 'GET', body, cookie) {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
test('Axios returns all ten books, ISBN, all author matches and a title with spaces', async () => {
  assert.equal(Object.keys(await api.getAllBooks(undefined, client)).length, 10);
  let callbackBooks;
  await api.getAllBooks((error, data) => { assert.ifError(error); callbackBooks = data; }, client);
  assert.equal(Object.keys(callbackBooks).length, 10);
  assert.equal((await api.getBooksByISBN(1, client)).title, 'Things Fall Apart');
  assert.equal(Object.keys(await api.getBooksByAuthor('Unknown', client)).length, 4);
  assert.equal((await api.getBooksByTitle('Things Fall Apart', client))['1'].author, 'Chinua Achebe');
  await assert.rejects(api.getBooksByISBN('missing', client), error => error.response.status === 404);
  await assert.rejects(api.getBooksByAuthor('missing', client), error => error.response.status === 404);
  await assert.rejects(api.getBooksByTitle('missing', client), error => error.response.status === 404);
});
test('registration, authentication, review modification and per-user deletion', async () => {
  assert.deepEqual((await request('/review/1')).data, {});
  assert.equal((await request('/register', 'POST', {})).status, 400);
  const alice = { username: 'alice', password: 'example-password' };
  const bob = { username: 'bob', password: 'other-password' };
  assert.equal((await request('/register', 'POST', alice)).status, 201);
  assert.equal((await request('/register', 'POST', alice)).status, 409);
  assert.equal((await request('/register', 'POST', bob)).status, 201);
  assert.equal((await request('/customer/login', 'POST', { ...alice, password: 'wrong' })).status, 401);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'blocked' })).status, 401);
  assert.equal((await request('/customer/auth/review/1', 'DELETE')).status, 401);
  const a = await request('/customer/login', 'POST', alice);
  const b = await request('/customer/login', 'POST', bob);
  assert.equal(a.status, 200);
  assert.ok(a.cookie);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: '' }, a.cookie)).status, 400);
  assert.equal((await request('/customer/auth/review/missing', 'PUT', { review: 'x' }, a.cookie)).status, 404);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'First' }, a.cookie)).data.reviews.alice, 'First');
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'Bob review' }, b.cookie)).status, 200);
  const modified = await request('/customer/auth/review/1', 'PUT', { review: 'Updated' }, a.cookie);
  assert.equal(modified.data.message, 'Review successfully modified.');
  assert.equal(modified.data.reviews.alice, 'Updated');
  assert.equal(modified.data.reviews.bob, 'Bob review');
  const deleted = await request('/customer/auth/review/1', 'DELETE', undefined, a.cookie);
  assert.deepEqual(deleted.data.reviews, { bob: 'Bob review' });
  assert.equal((await request('/customer/auth/review/1', 'DELETE', undefined, a.cookie)).status, 404);
  assert.equal((await request('/customer/auth/review/1', 'DELETE', undefined, b.cookie)).status, 200);
  assert.deepEqual((await request('/review/1')).data, {});
  assert.equal((await request('/review/missing')).status, 404);
});
