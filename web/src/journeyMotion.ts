export type V3 = [number, number, number];
export type CameraPoint = { at: number; position: V3; target: V3 };
export type Checkpoint = { frame: number; year?: number | null; label: string };

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Nonuniform cubic Hermite interpolation preserves velocity through checkpoints. */
export function sampleCamera(path: CameraPoint[], progress: number) {
  const p = clamp(progress);
  let index = path.findIndex((node, i) => i < path.length - 1 && p >= node.at && p <= path[i + 1].at);
  if (index < 0) index = path.length - 2;
  const a = path[index], b = path[index + 1], dt = b.at - a.at, u = clamp((p - a.at) / dt);
  function channel(field: 'position' | 'target'): V3 {
    const previous = path[Math.max(0, index - 1)], next = path[Math.min(path.length - 1, index + 2)];
    return a[field].map((value, axis) => {
      const m0 = (b[field][axis] - previous[field][axis]) / (b.at - previous.at);
      const m1 = (next[field][axis] - a[field][axis]) / (next.at - a.at);
      return (2*u**3-3*u**2+1)*value + (u**3-2*u**2+u)*dt*m0
        + (-2*u**3+3*u**2)*b[field][axis] + (u**3-u**2)*dt*m1;
    }) as V3;
  }
  return { position: channel('position'), target: channel('target') };
}

export function sampleTimeline(checkpoints: Checkpoint[], frame: number, totalFrames: number) {
  const progress = clamp(frame / (totalFrames - 1));
  let activeIndex = 0;
  checkpoints.forEach((point, index) => { if (frame >= point.frame) activeIndex = index; });
  const active = checkpoints[activeIndex], next = checkpoints[Math.min(activeIndex + 1, checkpoints.length - 1)];
  const firstYear = checkpoints[0].year!;
  const priorYear = [...checkpoints.slice(0, activeIndex + 1)].reverse().find(point => point.year != null)!.year!;
  const fromYear = active.year ?? priorYear, toYear = next.year ?? fromYear;
  const u = next.frame > active.frame ? clamp((frame - active.frame) / (next.frame - active.frame)) : 0;
  const year = fromYear + (toYear - fromYear) * u;
  return { progress, activeIndex, year, firstYear };
}

export function sampleJourney(checkpoints: Checkpoint[], frame: number, totalFrames: number, interval: number) {
  const state = sampleTimeline(checkpoints, frame, totalFrames);
  return { ...state, renewals: Math.floor((state.year - state.firstYear + 1e-8) / interval) };
}
