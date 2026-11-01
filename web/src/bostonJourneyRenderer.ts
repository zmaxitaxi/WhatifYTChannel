import type { ProductionSpec } from './generated/production';
import { buildBostonJourneyWorld } from './bostonJourneyModels';
import { startContinuousRenderer } from './continuousRenderer';

export async function startBostonJourneyRenderer(spec: ProductionSpec) {
  if (!spec.history_journey) throw new Error('Boston journey requires checkpoint metadata');
  return startContinuousRenderer(spec, {
    buildWorld: buildBostonJourneyWorld,
    checkpoints: spec.history_journey.checkpoints,
    subject: 'connected_boston_waterfront',
    sunrise: true,
  });
}
