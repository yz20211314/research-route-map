#!/usr/bin/env node
// Lightweight geometry check for deterministic 3–6 stage A4 layouts.
const checks = [3, 4, 5, 6].map((count) => {
  const startY = 140;
  const outcomeY = 1530;
  const gap = 18;
  const height = Math.floor((outcomeY - startY - gap * (count - 1)) / count);
  const lastY = startY + (count - 1) * (height + gap);
  return {
    count,
    group_height: height,
    last_bottom: lastY + height,
    fits: height >= 190 && lastY + height <= outcomeY
  };
});
const result = {ok: checks.every((item) => item.fits), supported_counts: checks};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
