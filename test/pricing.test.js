const test = require('node:test'), assert = require('node:assert');
const { estCommission, dedupeCheapest, priceOffers } = require('../src/pricing');
test('commission estimate', () => assert.strictEqual(estCommission(1000, { commissionPct: 0.012 }), 12));
test('dedupe keeps cheapest', () => {
  const o = [{ airlineCode: 'SV', from: 'A', to: 'B', date: 'd', departTime: '10:00', price: 200 }, { airlineCode: 'SV', from: 'A', to: 'B', date: 'd', departTime: '10:00', price: 150 }];
  assert.strictEqual(dedupeCheapest(o).length, 1); assert.strictEqual(dedupeCheapest(o)[0].price, 150);
});
test('no markup: shown price equals partner price; sorted; pax multiplies', () => {
  const r = priceOffers([{ airlineCode: 'A', from: 'x', to: 'y', date: 'd', departTime: '1', price: 400 }, { airlineCode: 'B', from: 'x', to: 'y', date: 'd', departTime: '1', price: 100 }], 2);
  assert.strictEqual(r[0].price, 100); assert.strictEqual(r[0].totalPrice, 200); assert.ok(r[0].price < r[1].price);
});
