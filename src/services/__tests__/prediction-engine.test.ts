import { describe, it, expect } from "vitest";
import { mean, calculateConfidence, calculatePrediction } from "../prediction-engine";

describe("mean", () => {
  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });

  it("calculates average correctly", () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(mean([5])).toBe(5);
  });
});

describe("calculatePrediction", () => {
  it("uses 60/40 weighting when both datasets exist", () => {
    // weekday avg = 30, recent avg = 20
    // predicted = 0.6 * 30 + 0.4 * 20 = 18 + 8 = 26
    const result = calculatePrediction([30, 30, 30], [20, 20, 20]);
    expect(result).toBe(26);
  });

  it("uses only recent data when no weekday data", () => {
    const result = calculatePrediction([], [10, 20, 30]);
    expect(result).toBe(20);
  });

  it("uses only weekday data when no recent data", () => {
    const result = calculatePrediction([10, 20], []);
    expect(result).toBe(15);
  });

  it("returns 0 when both datasets are empty", () => {
    expect(calculatePrediction([], [])).toBe(0);
  });

  it("weekday data has more influence than recent data", () => {
    // High weekday, low recent → prediction closer to weekday
    const highWeekday = calculatePrediction([100, 100], [10, 10]);
    // 0.6 * 100 + 0.4 * 10 = 64
    expect(highWeekday).toBe(64);

    // Low weekday, high recent → prediction still weighted toward weekday
    const lowWeekday = calculatePrediction([10, 10], [100, 100]);
    // 0.6 * 10 + 0.4 * 100 = 46
    expect(lowWeekday).toBe(46);

    expect(highWeekday).toBeGreaterThan(lowWeekday);
  });
});

describe("calculateConfidence", () => {
  it("returns low confidence with few data points", () => {
    const conf = calculateConfidence([10], [20]);
    expect(conf).toBeLessThanOrEqual(0.3);
  });

  it("returns moderate confidence with 5-14 data points", () => {
    const conf = calculateConfidence([10, 20, 30], [10, 20, 30, 40]);
    expect(conf).toBeGreaterThan(0.3);
    expect(conf).toBeLessThanOrEqual(0.5);
  });

  it("returns good confidence with 15-29 data points", () => {
    const weekday = Array(8).fill(20);
    const recent = Array(8).fill(20);
    const conf = calculateConfidence(weekday, recent);
    expect(conf).toBeGreaterThan(0.5);
    expect(conf).toBeLessThanOrEqual(0.7);
  });

  it("returns high confidence with 30+ data points", () => {
    const weekday = Array(15).fill(20);
    const recent = Array(15).fill(20);
    const conf = calculateConfidence(weekday, recent);
    expect(conf).toBeGreaterThan(0.7);
  });

  it("reduces confidence when data has high variance", () => {
    const stable = calculateConfidence([20, 20, 20, 20], [20, 20, 20, 20]);
    const volatile = calculateConfidence([5, 50, 10, 40], [5, 50, 10, 40]);
    expect(stable).toBeGreaterThan(volatile);
  });
});
