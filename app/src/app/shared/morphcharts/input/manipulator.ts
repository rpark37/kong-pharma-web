// Ported from microsoft/morphcharts client/src/input/manipulator.ts (MIT).
import type * as Core from '@microsoft/morphcharts-core';

export class Manipulator {
  id = 0;
  position: Core.Vector3 = [0, 0, 0];
  previousPosition: Core.Vector3 = [0, 0, 0];
  initialPosition: Core.Vector3 = [0, 0, 0];
  maxTranslationSquared = 0;
  holdOrigin: Core.Vector3 = [0, 0, 0];
  positionRelativeToCentroid: Core.Vector3 = [0, 0, 0];
  previousPositionRelativeToCentroid: Core.Vector3 = [0, 0, 0];
  rotationAxis: Core.Vector3 = [0, 0, 0];
  previousRotationAxis: Core.Vector3 = [0, 0, 0];
  button = 0;
  shiftKey = false;
  ctrlKey = false;
  altKey = false;
  pickedIndex = 0;
  type = '';
  isPersisted = false;
  isPicking = false;
  isPicked = false;
  holdBeginTime = 0;
  event: Event | null = null;
}
