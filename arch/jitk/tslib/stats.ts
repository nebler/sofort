export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Middle value, or the mean of the two middle values (NaN when empty).
export function median(xs: number[]): number {
  const a = xs.slice().sort((a, b) => a - b);
  const n = a.length;
  return n % 2 ? a[Math.floor(n / 2)] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

// Least-squares line through (xs, ys), as bytes per VM plus fixed bytes.
export function fit(xs: number[], ys: number[]): any {
  const mx = mean(xs);
  const my = mean(ys);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < xs.length; i++) {
    numerator += (xs[i] - mx) * (ys[i] - my);
    denominator += (xs[i] - mx) ** 2;
  }
  const slope = numerator / denominator;
  const fixed = my - slope * mx;
  let total = 0;
  let residual = 0;
  for (let i = 0; i < xs.length; i++) {
    total += (ys[i] - my) ** 2;
    residual += (ys[i] - fixed - slope * xs[i]) ** 2;
  }
  return {
    bytes_per_vm: slope,
    fixed_bytes: fixed,
    r2: total ? 1 - residual / total : 1,
  };
}
