/**
 * Small, dependency-free helpers for authored Canvas scenes.
 * Timelines stay as data while renderers focus only on painting pixels.
 */

export function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function loopTime(elapsedMs, durationMs) {
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return elapsed % duration;
}

export function getTimelineBeat(beats, elapsedMs, durationMs) {
  const time = loopTime(elapsedMs, durationMs);
  return beats.find(beat => time >= beat.start && time < beat.end) ?? beats[0] ?? null;
}

export function getBeatProgress(beat, elapsedMs, durationMs) {
  if (!beat || beat.end <= beat.start) return 0;
  const time = loopTime(elapsedMs, durationMs);
  return clamp((time - beat.start) / (beat.end - beat.start));
}

export function easeOutCubic(progress) {
  return 1 - Math.pow(1 - clamp(progress), 3);
}

export function lerp(from, to, progress) {
  return from + (to - from) * clamp(progress);
}

/** Return a deliberately stepped value suitable for 2–4 frame pixel animation. */
export function pixelStep(progress, steps = 4) {
  const safeSteps = Math.max(1, Math.floor(steps));
  return Math.floor(clamp(progress) * safeSteps) / safeSteps;
}

/** A short, deterministic shake offset that is safe to apply to integer pixels. */
export function screenShake(elapsedMs, start, end, magnitude = 0) {
  if (elapsedMs < start || elapsedMs >= end || magnitude <= 0) return { x: 0, y: 0 };
  const frame = Math.floor((elapsedMs - start) / 55);
  return {
    x: ((frame * 13) % 3 - 1) * magnitude,
    y: ((frame * 7) % 3 - 1) * magnitude
  };
}

/** Number of columns to reveal for an intentionally hard-edged pixel wipe. */
export function pixelWipeColumns(progress, columns = 16) {
  return Math.ceil(clamp(progress) * Math.max(1, Math.floor(columns)));
}