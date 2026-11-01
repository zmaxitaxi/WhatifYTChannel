import { describe, expect, it } from 'vitest';
import { sampleCamera, sampleJourney, sampleTimeline, type Checkpoint } from '../../web/src/journeyMotion';

describe('continuous journey', () => {
  const points = [
    { at: 0, position: [0, 6, 20] as [number, number, number], target: [0, 1, 0] as [number, number, number] },
    { at: .2, position: [10, 7, 19] as [number, number, number], target: [10, 1, 0] as [number, number, number] },
    { at: .7, position: [25, 6, 22] as [number, number, number], target: [25, 1, 0] as [number, number, number] },
    { at: 1, position: [40, 8, 20] as [number, number, number], target: [40, 1, 0] as [number, number, number] },
  ];
  it('passes each camera anchor without a velocity jump', () => {
    for (const node of points) expect(sampleCamera(points, node.at).position).toEqual(node.position);
    const e = 1e-5;
    for (const t of [.2, .7]) {
      const a = sampleCamera(points, t-e), b = sampleCamera(points, t), c = sampleCamera(points, t+e);
      for (let axis=0;axis<3;axis++) expect((b.position[axis]-a.position[axis])/e).toBeCloseTo((c.position[axis]-b.position[axis])/e, 1);
    }
  });
  it('reconstructs the same camera after backward seeking', () => {
    const before = sampleCamera(points, .345);
    sampleCamera(points, .98);
    expect(sampleCamera(points, .345)).toEqual(before);
  });
  const checkpoints: Checkpoint[] = [2026,2031,2036,2041,2046,2051].map((year,i)=>({frame:i*360,year,label:String(year)}));
  checkpoints.push({frame:2159,year:null,label:'Next?'});
  it('counts one graduate’s five-year renewals exactly at checkpoints', () => {
    for (let i=0;i<6;i++) {
      expect(sampleJourney(checkpoints,i*360,2160,5).renewals).toBe(i);
      if(i)expect(sampleJourney(checkpoints,i*360-1,2160,5).renewals).toBe(i-1);
    }
    expect(sampleJourney(checkpoints,2159,2160,5).renewals).toBe(5);
  });
  it('moves the red dot monotonically on every frame and reaches the endpoint', () => {
    let previous=-1;
    for(let frame=0;frame<2160;frame++){
      const state=sampleJourney(checkpoints,frame,2160,5);
      expect(state.progress).toBeGreaterThan(previous);
      previous=state.progress;
    }
    expect(previous).toBe(1);
  });
  it('preserves historical checkpoints without imposing degree-renewal arithmetic', () => {
    const history: Checkpoint[] = [
      {frame:0,year:1885,label:'The Charles River'},
      {frame:240,year:1891,label:'Graduates stay'},
      {frame:480,year:1939,label:'A Boston workshop'},
      {frame:720,year:1951,label:'Labs become neighbors'},
      {frame:960,year:1996,label:'Silicon Harbor'},
      {frame:1320,year:2026,label:'A shared city'},
      {frame:1800,year:2050,label:'Ideas and sunlight'},
      {frame:2159,year:null,label:'Next?'},
    ];
    for(let i=0;i<history.length;i++){
      const state=sampleTimeline(history,history[i].frame,2160);
      expect(state.activeIndex).toBe(i);
      expect(state.year).toBe(history[i].year??2050);
      expect(state).not.toHaveProperty('renewals');
    }
    const before=sampleTimeline(history,1173,2160);
    sampleTimeline(history,2159,2160);
    expect(sampleTimeline(history,1173,2160)).toEqual(before);
  });
});
