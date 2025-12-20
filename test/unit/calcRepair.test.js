// import the pure function from your source
const { calcRepair } = require('../../src/inject/helper.js');

describe('calcRepair', () => {
  test('$5 part → multiplier 5', () => {
    expect(calcRepair(5, 0)).toBeCloseTo(29.99, 2);
  });
  test('$15 part → multiplier 2.5', () => {
    expect(calcRepair(15, 10)).toBeCloseTo(49.99, 2);
  });
  test('$200 part → multiplier 1.25', () => {
    expect(calcRepair(200, 50)).toBeCloseTo(299.99, 2);
  });
});