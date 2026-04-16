const {
  PERF_POT_COLORS,
  RISK_IMPACT_COLORS,
  PERF_POT_LABELS,
  RISK_IMPACT_LABELS,
  clampRating,
  processEmployees,
  groupOutliers,
} = require('../lib');

// ─── clampRating ──────────────────────────────────────────────────────────────
describe('clampRating', () => {
  test('passes through values within range', () => {
    expect(clampRating(1)).toBe(1);
    expect(clampRating(2)).toBe(2);
    expect(clampRating(3)).toBe(3);
  });

  test('clamps to floor (1) for values below range', () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(-10)).toBe(1);
  });

  test('clamps to ceiling (3) for values above range', () => {
    expect(clampRating(4)).toBe(3);
    expect(clampRating(9)).toBe(3);
  });
});

// ─── Color specs ──────────────────────────────────────────────────────────────
describe('PERF_POT_COLORS', () => {
  test('(3,3) is green — high performance, high potential', () => {
    expect(PERF_POT_COLORS['3,3']).toBe('green');
  });
  test('(1,1) is red — low performance, low potential', () => {
    expect(PERF_POT_COLORS['1,1']).toBe('red');
  });
  test('(1,3) is yellow — low performance, high potential', () => {
    expect(PERF_POT_COLORS['1,3']).toBe('yellow');
  });
  test('(3,1) is yellow — high performance, low potential', () => {
    expect(PERF_POT_COLORS['3,1']).toBe('yellow');
  });
  test('(1,2) is red — low performance, mid potential', () => {
    expect(PERF_POT_COLORS['1,2']).toBe('red');
  });
  test('(2,3) is green — medium performance, high potential', () => {
    expect(PERF_POT_COLORS['2,3']).toBe('green');
  });
  test('(2,2) is uncolored — average on both dimensions', () => {
    expect(PERF_POT_COLORS['2,2']).toBeUndefined();
  });
  test('(3,2) is green — high performance, medium potential', () => {
    expect(PERF_POT_COLORS['3,2']).toBe('green');
  });
});

describe('RISK_IMPACT_COLORS', () => {
  test('(3,3) is red — high flight risk, high impact', () => {
    expect(RISK_IMPACT_COLORS['3,3']).toBe('red');
  });
  test('(3,2) is red — high flight risk, medium impact', () => {
    expect(RISK_IMPACT_COLORS['3,2']).toBe('red');
  });
  test('(2,3) is red — medium flight risk, high impact', () => {
    expect(RISK_IMPACT_COLORS['2,3']).toBe('red');
  });
  test('(1,3) is yellow — low flight risk, high impact', () => {
    expect(RISK_IMPACT_COLORS['1,3']).toBe('yellow');
  });
  test('(2,2) is uncolored — average on both dimensions', () => {
    expect(RISK_IMPACT_COLORS['2,2']).toBeUndefined();
  });
  test('(1,1) is uncolored', () => {
    expect(RISK_IMPACT_COLORS['1,1']).toBeUndefined();
  });
});

// ─── processEmployees ─────────────────────────────────────────────────────────
describe('processEmployees', () => {
  const validRow = (overrides = {}) => ({
    Name: 'Alice',
    Performance: '2',
    Potential: '2',
    'Risk of Loss': '2',
    'Impact of Loss': '2',
    ...overrides,
  });

  test('parses a valid row into the correct shape', () => {
    const { employees, errors } = processEmployees([
      validRow({ Name: 'Alice', Performance: '3', Potential: '1', 'Risk of Loss': '2', 'Impact of Loss': '3' }),
    ]);
    expect(employees).toHaveLength(1);
    expect(employees[0]).toEqual({ name: 'Alice', perf: 3, pot: 1, risk: 2, imp: 3 });
    expect(errors).toHaveLength(0);
  });

  test('returns empty arrays for empty input', () => {
    const { employees, errors } = processEmployees([]);
    expect(employees).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test('skips rows with no Name', () => {
    const { employees } = processEmployees([validRow({ Name: '' })]);
    expect(employees).toHaveLength(0);
  });

  test('skips rows with whitespace-only Name', () => {
    const { employees } = processEmployees([validRow({ Name: '   ' })]);
    expect(employees).toHaveLength(0);
  });

  test('trims whitespace from Name', () => {
    const { employees } = processEmployees([validRow({ Name: '  Bob  ' })]);
    expect(employees[0].name).toBe('Bob');
  });

  test('rejects values of 0 as out of range', () => {
    const { employees, errors } = processEmployees([validRow({ Performance: '0' })]);
    expect(employees).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  test('rejects values of 4 as out of range', () => {
    const { employees, errors } = processEmployees([validRow({ Potential: '4' })]);
    expect(employees).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  test('rejects non-numeric values', () => {
    const { employees, errors } = processEmployees([validRow({ 'Risk of Loss': 'high' })]);
    expect(employees).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  test('rows with missing rating columns default to 2', () => {
    const { employees, errors } = processEmployees([{ Name: 'Dave' }]);
    expect(employees).toHaveLength(1);
    expect(employees[0]).toMatchObject({ name: 'Dave', perf: 2, pot: 2, risk: 2, imp: 2 });
    expect(errors).toHaveLength(0);
  });

  test('accepts all valid boundary values (1 and 3)', () => {
    const { employees } = processEmployees([
      validRow({ Performance: '1', Potential: '3', 'Risk of Loss': '1', 'Impact of Loss': '3' }),
    ]);
    expect(employees[0]).toMatchObject({ perf: 1, pot: 3, risk: 1, imp: 3 });
  });

  test('processes multiple valid rows', () => {
    const { employees } = processEmployees([validRow({ Name: 'A' }), validRow({ Name: 'B' })]);
    expect(employees).toHaveLength(2);
  });

  test('returns valid rows and errors when input is mixed', () => {
    const { employees, errors } = processEmployees([
      validRow({ Name: 'Good' }),
      validRow({ Name: 'Bad', Performance: '5' }),
    ]);
    expect(employees).toHaveLength(1);
    expect(employees[0].name).toBe('Good');
    expect(errors).toHaveLength(1);
  });

  test('numeric string values are correctly parsed as integers', () => {
    const { employees } = processEmployees([validRow({ Performance: '3' })]);
    expect(typeof employees[0].perf).toBe('number');
    expect(employees[0].perf).toBe(3);
  });
});

// ─── groupOutliers ────────────────────────────────────────────────────────────
describe('groupOutliers', () => {
  const emp = (name, perf, pot) => ({ name, perf, pot, risk: 2, imp: 2 });

  const outliers = (emps) =>
    groupOutliers(emps, e => e.perf, e => e.pot, PERF_POT_COLORS, PERF_POT_LABELS, 'Performance', 'Potential');

  test('returns an entry for each highlighted box that has employees', () => {
    const result = outliers([emp('Alice', 3, 3), emp('Bob', 1, 1)]);
    expect(result).toHaveLength(2);
  });

  test('excludes employees in neutral (uncolored) boxes', () => {
    const result = outliers([emp('Neutral', 2, 2)]);
    expect(result).toHaveLength(0);
  });

  test('groups multiple employees in the same box together', () => {
    const result = outliers([emp('Alice', 3, 3), emp('Eve', 3, 3)]);
    expect(result).toHaveLength(1);
    expect(result[0].names).toEqual(['Alice', 'Eve']);
  });

  test('includes the correct coord string', () => {
    const result = outliers([emp('Alice', 3, 3)]);
    expect(result[0].coord).toBe('3,3');
  });

  test('includes the correct color', () => {
    const result = outliers([emp('Alice', 3, 3)]);
    expect(result[0].color).toBe('green');
  });

  test('maps color to the correct label', () => {
    const result = outliers([emp('Alice', 3, 3)]);
    expect(result[0].label).toBe('Star');
  });

  test('includes the correct chart name', () => {
    const result = outliers([emp('Alice', 3, 3)]);
    expect(result[0].chart).toBe('Performance vs. Potential');
  });

  test('returns empty array when no employees fall in colored boxes', () => {
    const result = outliers([emp('Mid', 2, 2)]);
    expect(result).toHaveLength(0);
  });

  test('works correctly for Risk/Impact chart', () => {
    const riskEmps = [{ name: 'FlightRisk', perf: 2, pot: 2, risk: 3, imp: 3 }];
    const result = groupOutliers(
      riskEmps,
      e => e.risk, e => e.imp,
      RISK_IMPACT_COLORS, RISK_IMPACT_LABELS,
      'Risk of Loss', 'Impact of Loss'
    );
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('red');
    expect(result[0].label).toBe('Retention Risk');
    expect(result[0].chart).toBe('Risk of Loss vs. Impact of Loss');
  });
});
