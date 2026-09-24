// Ported from microsoft/morphcharts client/src/input/manipulationprocessor.ts (MIT).
import * as Core from '@microsoft/morphcharts-core';
import { Manipulator } from './manipulator';

export interface ManipulationProcessorOptions {
  dragToleranceSquared?: number;
  manipulatorMinRelativeDistanceSquared?: number;
}

/**
 * Turns raw pointer contacts into translation / scale / twist deltas. One finger drags,
 * two fingers pinch and twist, and the centroid tells the camera where to zoom toward.
 */
export class ManipulationProcessor {
  private readonly _previousCentroid: Core.Vector3 = [0, 0, 0];
  private readonly _centroid: Core.Vector3 = [0, 0, 0];
  private readonly _relativePositionToCentroid: Core.Vector3 = [0, 0, 0];
  private readonly _directionToCentroid: Core.Vector3 = [0, 0, 0];
  private readonly _previousDirectionToCentroid: Core.Vector3 = [0, 0, 0];
  private _previousCount = 0;
  private _manipulators: Record<string, Manipulator> = {};
  private _removedManipulators: number[] = [];
  private _count = 0;
  private _isDragging = false;
  readonly cumulativeTranslation: Core.Vector3 = [0, 0, 0];
  readonly translationDelta: Core.Vector3 = [0, 0, 0];
  minScale = 0;
  maxScale = Number.MAX_VALUE;
  cumulativeScale = 1;
  scaleDelta = 0;
  twistAxis: Core.Vector3 = [0, 0, 1];
  cumulativeTwist = 0;
  twistDelta = 0;
  readonly centroid: Core.Vector3 = [0, 0, 0];
  addManipulator: ((manipulator: Manipulator) => boolean) | null = null;
  removeManipulator: ((manipulator: Manipulator) => void) | null = null;
  prepareManipulation: (() => void) | null = null;
  beginManipulation: (() => void) | null = null;
  processManipulation: ((elapsedTime: number) => void) | null = null;
  endManipulation: (() => void) | null = null;
  get manipulators() { return this._manipulators; }
  get count() { return this._count; }
  get isDragging() { return this._isDragging; }

  dragToleranceSquared: number;
  manipulatorMinRelativeDistanceSquared: number;

  constructor(options?: ManipulationProcessorOptions) {
    this.dragToleranceSquared = options?.dragToleranceSquared ?? 100;
    this.manipulatorMinRelativeDistanceSquared = options?.manipulatorMinRelativeDistanceSquared ?? 100;
    this.initialize();
  }

  update(elapsedTime: number, manipulators: Record<string, Manipulator>): void {
    for (const key in this._manipulators) {
      const manipulator = this._manipulators[key];
      if (!manipulators[manipulator.id]) {
        this.removeManipulator?.(manipulator);
        this._removedManipulators.push(manipulator.id);
      }
    }
    if (this._removedManipulators.length > 0) {
      for (const id of this._removedManipulators) {
        delete this._manipulators[id];
        this._count--;
      }
      this._removedManipulators = [];
    }
    for (const key in manipulators) {
      const manipulator = manipulators[key];
      if (!this._manipulators[manipulator.id]) {
        if (!this.addManipulator || this.addManipulator(manipulator)) {
          manipulator.initialPosition[0] = manipulator.position[0];
          manipulator.initialPosition[1] = manipulator.position[1];
          manipulator.initialPosition[2] = manipulator.position[2];
          this._manipulators[manipulator.id] = manipulator;
          this._count++;
        }
      }
    }

    this.translationDelta[0] = 0;
    this.translationDelta[1] = 0;
    this.translationDelta[2] = 0;
    this.scaleDelta = 0;
    this.twistDelta = 0;

    if (this._count > 0) {
      if (this._previousCount > 0) {
        this.prepareManipulation?.();
        this._process();
        this.processManipulation?.(elapsedTime);
      } else {
        this.initialize();
        this.beginManipulation?.();
      }
    } else if (this._previousCount > 0) {
      this.endManipulation?.();
    }

    this._isDragging = (this._count === 1 && Core.vector3.lengthSquared(this.cumulativeTranslation) > this.dragToleranceSquared) || this._count > 1;
    this._previousCount = this._count;
  }

  initialize(): void {
    this.centroid[0] = 0; this.centroid[1] = 0; this.centroid[2] = 0;
    this.cumulativeTranslation[0] = 0; this.cumulativeTranslation[1] = 0; this.cumulativeTranslation[2] = 0;
    this.cumulativeScale = 1;
    this.cumulativeTwist = 0;
  }

  private _process(): void {
    if (this._previousCount > 0) {
      let persisted = 0;
      for (const key in this._manipulators) if (this._manipulators[key].isPersisted) persisted++;
      const removed = this._previousCount - persisted;

      if (persisted > 0) {
        if (removed > 0) {
          this._centroid[0] = this._previousCentroid[0];
          this._centroid[1] = this._previousCentroid[1];
          this._centroid[2] = this._previousCentroid[2];
        } else {
          this._centroid[0] = 0; this._centroid[1] = 0; this._centroid[2] = 0;
          for (const key in this._manipulators) {
            const m = this._manipulators[key];
            if (m.isPersisted) {
              this._centroid[0] += m.position[0];
              this._centroid[1] += m.position[1];
              this._centroid[2] += m.position[2];
            }
          }
          this._centroid[0] /= persisted; this._centroid[1] /= persisted; this._centroid[2] /= persisted;
        }

        for (const key in this._manipulators) {
          const m = this._manipulators[key];
          if (!m.isPersisted) continue;
          m.maxTranslationSquared = Math.max(m.maxTranslationSquared, Core.vector3.distanceSquared(m.position, m.initialPosition));
          this.translationDelta[0] += m.position[0] - m.previousPosition[0];
          this.translationDelta[1] += m.position[1] - m.previousPosition[1];
          this.translationDelta[2] += m.position[2] - m.previousPosition[2];
          this._relativePositionToCentroid[0] = m.position[0] - this._centroid[0];
          this._relativePositionToCentroid[1] = m.position[1] - this._centroid[1];
          this._relativePositionToCentroid[2] = m.position[2] - this._centroid[2];
          const distanceToCentroidSquared = Core.vector3.lengthSquared(this._relativePositionToCentroid);
          if (distanceToCentroidSquared < this.manipulatorMinRelativeDistanceSquared) {
            this.scaleDelta += 1;
          } else {
            const distanceToCentroid = Math.sqrt(distanceToCentroidSquared);
            const previousDistanceToCentroid = Math.sqrt(Core.vector3.lengthSquared(m.previousPositionRelativeToCentroid));
            this.scaleDelta += distanceToCentroid / previousDistanceToCentroid;
            this._directionToCentroid[0] = this._relativePositionToCentroid[0] / distanceToCentroid;
            this._directionToCentroid[1] = this._relativePositionToCentroid[1] / distanceToCentroid;
            this._directionToCentroid[2] = this._relativePositionToCentroid[2] / distanceToCentroid;
            this._previousDirectionToCentroid[0] = m.previousPositionRelativeToCentroid[0] / previousDistanceToCentroid;
            this._previousDirectionToCentroid[1] = m.previousPositionRelativeToCentroid[1] / previousDistanceToCentroid;
            this._previousDirectionToCentroid[2] = m.previousPositionRelativeToCentroid[2] / previousDistanceToCentroid;
            this.twistDelta += Core.Angles.signedAngleBetweenVectors(this._previousDirectionToCentroid, this._directionToCentroid, this.twistAxis);
          }
        }

        this.translationDelta[0] /= persisted; this.translationDelta[1] /= persisted; this.translationDelta[2] /= persisted;
        this.cumulativeTranslation[0] += this.translationDelta[0];
        this.cumulativeTranslation[1] += this.translationDelta[1];
        this.cumulativeTranslation[2] += this.translationDelta[2];
        this.scaleDelta /= persisted;
        this.cumulativeScale = Core.Math.clamp(this.cumulativeScale * this.scaleDelta, this.minScale, this.maxScale);
        this.scaleDelta -= 1;
        this.twistDelta /= persisted;
        this.cumulativeTwist += this.twistDelta;
      }
    }

    this.centroid[0] = 0; this.centroid[1] = 0; this.centroid[2] = 0;
    for (const key in this._manipulators) {
      const m = this._manipulators[key];
      this.centroid[0] += m.position[0]; this.centroid[1] += m.position[1]; this.centroid[2] += m.position[2];
    }
    this.centroid[0] /= this._count; this.centroid[1] /= this._count; this.centroid[2] /= this._count;
    for (const key in this._manipulators) {
      const m = this._manipulators[key];
      m.positionRelativeToCentroid[0] = m.position[0] - this.centroid[0];
      m.positionRelativeToCentroid[1] = m.position[1] - this.centroid[1];
      m.positionRelativeToCentroid[2] = m.position[2] - this.centroid[2];
    }
    this._previousCentroid[0] = this.centroid[0]; this._previousCentroid[1] = this.centroid[1]; this._previousCentroid[2] = this.centroid[2];
    for (const key in this._manipulators) {
      const m = this._manipulators[key];
      m.isPersisted = true;
      m.previousPosition[0] = m.position[0]; m.previousPosition[1] = m.position[1]; m.previousPosition[2] = m.position[2];
      m.previousRotationAxis[0] = m.rotationAxis[0]; m.previousRotationAxis[1] = m.rotationAxis[1]; m.previousRotationAxis[2] = m.rotationAxis[2];
      m.previousPositionRelativeToCentroid[0] = m.positionRelativeToCentroid[0];
      m.previousPositionRelativeToCentroid[1] = m.positionRelativeToCentroid[1];
      m.previousPositionRelativeToCentroid[2] = m.positionRelativeToCentroid[2];
    }
  }
}
