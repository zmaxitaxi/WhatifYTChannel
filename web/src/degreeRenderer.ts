import type { ProductionSpec } from './generated/production';
import { buildDegreeWorld } from './degreeModels';
import { startContinuousRenderer } from './continuousRenderer';

export async function startDegreeRenderer(spec: ProductionSpec) {
  if (!spec.journey) throw new Error('Degree journey requires checkpoint metadata');
  const journey = spec.journey;
  return startContinuousRenderer(spec, {
    buildWorld: buildDegreeWorld,
    checkpoints: journey.checkpoints,
    subject: 'connected_degree_world',
    counter: {
      label: journey.counter_label,
      value: (year, firstYear) => Math.floor((year - firstYear + 1e-8) / journey.renewal_interval_years),
    },
  });
}
