const test = require('node:test');
const assert = require('node:assert/strict');
const { KEY, LIMIT, empty, parse, Store } = require('../assets/storage.js');

function memory(initial) {
  const values = new Map(initial === undefined ? [] : [[KEY, initial]]);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('first load saves only the app key; export and import round-trip', () => {
  const storage = memory();
  storage.setItem('other-app', 'keep');
  const store = new Store(() => storage);
  assert.deepEqual(store.load(), empty());
  assert.deepEqual(parse(JSON.stringify(store.data, null, 2)), empty());
  assert.deepEqual(parse('\uFEFF' + JSON.stringify(empty())), empty());
  assert.equal(storage.getItem('other-app'), 'keep');
  assert.deepEqual(new Store(() => storage).load(), empty());
});

test('reject invalid JSON, schema, version, extra fields and unsupported course data', () => {
  const values = ['{bad', 'null', '[]', '{}', JSON.stringify({ ...empty(), version: 99 }),
    JSON.stringify({ ...empty(), semesters: {} }), JSON.stringify({ ...empty(), extra: 1 }),
    JSON.stringify({ ...empty(), semesters: [{ id: 'sample' }] }),
    JSON.stringify({ ...empty(), selectedCourseId: 'missing' })];
  for (const value of values) assert.throws(() => parse(value));
  assert.throws(() => parse(' '.repeat(LIMIT + 1)), /2MB/);
});

test('damaged stored data remains intact until explicit recovery', () => {
  const storage = memory('{damaged');
  const store = new Store(() => storage);
  assert.throws(() => store.load());
  assert.equal(store.raw, '{damaged');
  assert.equal(storage.getItem(KEY), '{damaged');
  assert.equal(store.data, null);
  store.save(empty());
  assert.deepEqual(parse(storage.getItem(KEY)), empty());
});

test('quota and permission failures preserve the prior data and memory', () => {
  for (const name of ['QuotaExceededError', 'SecurityError']) {
    const original = JSON.stringify(empty(), null, 2);
    const storage = memory(original);
    const store = new Store(() => storage);
    store.load();
    storage.setItem = () => { const error = new Error('denied'); error.name = name; throw error; };
    assert.throws(() => store.save(empty()), error => error.code === 'storage');
    assert.equal(storage.getItem(KEY), original);
    assert.equal(store.raw, original);
    assert.deepEqual(store.data, empty());
  }
});

test('unavailable localStorage cannot be overwritten', () => {
  const store = new Store(() => { throw new Error('blocked'); });
  assert.throws(() => store.load(), /접근/);
  assert.equal(store.hasRead, false);
  assert.throws(() => store.save(empty()), /먼저/);
});

test('other-window changes are detected before writing', () => {
  const storage = memory();
  const store = new Store(() => storage);
  store.load();
  storage.setItem(KEY, 'changed elsewhere');
  assert.throws(() => store.save(empty()), error => error.code === 'conflict');
  assert.equal(storage.getItem(KEY), 'changed elsewhere');
});

test('invalid replacement never changes existing storage', () => {
  const storage = memory();
  const store = new Store(() => storage);
  store.load();
  const original = storage.getItem(KEY);
  assert.throws(() => store.save({ ...empty(), version: 2 }));
  assert.equal(storage.getItem(KEY), original);
});
