import { Injectable, signal, computed } from '@angular/core';
import * as MorphCharts from 'morphcharts';
import { BayesData, FormConfig, LayoutConstants } from '../models/bayes-data.model';

@Injectable({
  providedIn: 'root'
})
export class MorphChartsService {
  private core: MorphCharts.Core | null = null;
  private renderer: MorphCharts.Renderers.Basic.Main | null = null;
  private sheet: MorphCharts.Layouts.Sheet | null = null;
  private transitionBuffer: any = null;
  private filter: Uint32Array | null = null;

  private readonly palette = new Uint8Array([
    0x10, 0xc0, 0xc0, 0xff, // Healthy (cyan)
    0xc0, 0x10, 0x10, 0xff  // Disease (red)
  ]);

  isTransitioning = signal(false);
  layoutIndex = signal(0);

  initialize(container: HTMLElement): void {
    this.core = new MorphCharts.Core({ container });
    this.core.config.modelDistance = 0.55;
    this.core.config.selectionColor = [0.9, 0.9, 0];
    this.core.config.axesGridBackgroundColor = [0.9, 0.9, 0.9];
    this.core.config.axesGridMajorColor = [0, 0, 0];
    this.core.reset(false);

    this.renderer = new MorphCharts.Renderers.Basic.Main({ antialias: true });
    this.core.renderer = this.renderer;

    this.sheet = new MorphCharts.Layouts.Sheet(this.core);
  }

  getLayoutConstants(count: number): LayoutConstants {
    const side = Math.ceil(Math.sqrt(count));
    return {
      minBoundsX: -0.5,
      maxBoundsX: side - 0.5,
      minBoundsY: -0.5,
      maxBoundsY: side - 0.5,
      padding: 0.1,
      thickness: 0.005,
      facetSpacingX: 0.25,
      facetSpacingY: 0.25,
      side
    };
  }

  updateConfig(config: FormConfig): void {
    if (this.core) {
      this.core.config.transitionDuration = config.transitionDuration;
      this.core.config.transitionStaggering = config.transitionStaggering;
    }
  }

  reset(): void {
    if (this.core) {
      this.core.reset(true);
    }
  }

  private updateFilter(ids: Uint32Array): void {
    if (!this.core || !this.renderer) return;

    if (this.filter !== ids) {
      this.filter = ids;
      const transitionBuffer2 = this.renderer.createTransitionBuffer(ids);

      if (this.transitionBuffer != null) {
        const previousTransitionBuffer = this.transitionBuffer;
        transitionBuffer2.previousBuffer.copyFrom(previousTransitionBuffer.previousBuffer);
        transitionBuffer2.previousBuffer.unitType = previousTransitionBuffer.previousBuffer.unitType;
        transitionBuffer2.previousBuffer.update();
        transitionBuffer2.previousPalette.copyFrom(previousTransitionBuffer.previousPalette);
      }

      this.transitionBuffer = transitionBuffer2;
      this.renderer.transitionBuffers = [this.transitionBuffer];
    }
  }

  layout(index: number, data: BayesData, config: FormConfig, useTransition: boolean): void {
    if (!this.core || !this.renderer) return;

    if (useTransition) {
      this.renderer.transitionBuffers[0]?.swap();
      this.renderer.swapAxes();
    }

    switch (index) {
      case 0:
        this.layout0(data, config);
        break;
      case 1:
        this.layout1(data, config);
        break;
      case 2:
        this.layout2(data, config);
        break;
      case 3:
        this.layout3(data, config);
        break;
    }

    if (useTransition) {
      this.renderer.transitionTime = 0;
      this.renderer.axesVisibility = MorphCharts.AxesVisibility.none;
      this.isTransitioning.set(true);
      this.runTransition(config);
    }

    this.layoutIndex.set(index);
  }

  private runTransition(config: FormConfig): void {
    if (!this.core || !this.renderer) return;

    const totalTime = config.transitionDuration + config.transitionStaggering;
    let transitionTime = 0;

    const animate = () => {
      if (!this.isTransitioning()) return;

      transitionTime += 1000 / 60;
      if (transitionTime > totalTime) {
        transitionTime = totalTime;
        this.isTransitioning.set(false);
      }

      if (this.renderer) {
        this.renderer.transitionTime = transitionTime / totalTime;
      }

      if (this.isTransitioning()) {
        requestAnimationFrame(animate);
      } else {
        if (this.renderer) {
          this.renderer.axesVisibility = MorphCharts.AxesVisibility.current;
        }
      }
    };

    requestAnimationFrame(animate);
  }

  private layout0(data: BayesData, config: FormConfig): void {
    if (!this.core || !this.renderer || !this.sheet) return;

    const constants = this.getLayoutConstants(config.count);
    this.updateFilter(data.ids);
    if (!this.transitionBuffer) return;

    const layoutOptions = { side: constants.side };
    this.sheet.layout(this.transitionBuffer.currentBuffer, data.ids, layoutOptions);

    const vertexOptions = {
      minBoundsX: constants.minBoundsX,
      maxBoundsX: constants.maxBoundsX,
      minBoundsY: constants.minBoundsY,
      maxBoundsY: constants.maxBoundsY,
      padding: constants.padding,
      thickness: constants.thickness
    };
    this.sheet.update(this.transitionBuffer.currentBuffer, data.ids, vertexOptions);
    this.transitionBuffer.currentBuffer.unitType = MorphCharts.UnitType.block;
    this.transitionBuffer.currentPalette.colors = null;

    const axesOptions = {
      minBoundsX: this.sheet.minLayoutBoundsX,
      maxBoundsX: this.sheet.maxLayoutBoundsX,
      minBoundsY: this.sheet.minLayoutBoundsY,
      maxBoundsY: this.sheet.maxLayoutBoundsY,
      divisionsX: 1,
      divisionsY: 1,
      minorGridlinesX: 1,
      minorGridlinesY: 1,
      arePickDivisionsVisibleX: false,
      arePickDivisionsVisibleY: false,
      titleX: `${config.count} ${config.count == 1 ? "person" : "people"} `,
      headingX: `${(config.prior * 100).toFixed(1)}% have a disease, for which a test is ${Math.round(config.sensitivity * 100)}% sensitive and ${Math.round(config.specificity * 100)}% specific`,
      headingSizeX: this.core.config.axesTextTitleSize
    };

    const axes = MorphCharts.Axes.Cartesian2dAxesHelper.create(this.core, axesOptions);
    axes.zero[0] = -1;
    axes.zero[1] = -1;
    axes.isEdgeVisible[MorphCharts.Edge2D.bottom] = false;
    axes.isHeadingVisible[MorphCharts.Edge2D.top] = false;
    axes.setLabels(0, null as unknown as string[]);
    axes.setLabels(1, null as unknown as string[]);
    this.renderer.currentAxes = [this.renderer.createCartesian2dAxesVisual(axes)];
  }

  private layout1(data: BayesData, config: FormConfig): void {
    if (!this.core || !this.renderer || !this.sheet) return;

    const constants = this.getLayoutConstants(config.count);
    this.updateFilter(data.ids);
    if (!this.transitionBuffer) return;

    const facets = 2;
    const binIds = new Uint32Array(data.disease);
    const orderedIds = new Uint32Array(config.count);
    const facetIds = new Uint32Array(config.count);
    const offsets = new Uint32Array(facets);
    const counts = new Uint32Array(facets);

    const facetHelper = new MorphCharts.Helpers.FacetHelper(this.core);
    facetHelper.split1d(data.ids, facets, binIds, orderedIds, facetIds, offsets, counts);

    // Right-to-left
    for (let i = 0; i < config.count; i++) {
      binIds[i] = 1 - binIds[i];
    }

    // Layout per facet
    for (let facetId = 0; facetId < facets; facetId++) {
      const layoutOptions = {
        offset: offsets[facetId],
        count: counts[facetId],
        side: constants.side
      };
      this.sheet.layout(this.transitionBuffer.currentBuffer, orderedIds, layoutOptions);
    }

    const vertexOptions = {
      minBoundsX: constants.minBoundsX,
      maxBoundsX: constants.maxBoundsX,
      minBoundsY: constants.minBoundsY,
      maxBoundsY: constants.maxBoundsY,
      padding: constants.padding,
      thickness: constants.thickness,
      facetCoordsX: binIds,
      facetsX: 2,
      facetSpacingX: constants.facetSpacingX
    };
    this.sheet.update(this.transitionBuffer.currentBuffer, data.ids, vertexOptions);
    this.transitionBuffer.currentBuffer.unitType = MorphCharts.UnitType.block;
    this.transitionBuffer.currentPalette.colors = null;

    const facetScaling = this.sheet.facetScaling;
    const axesOptions = {
      minBoundsX: constants.minBoundsX,
      maxBoundsX: constants.maxBoundsX,
      minBoundsY: constants.minBoundsY,
      maxBoundsY: constants.maxBoundsY,
      divisionsX: 1,
      divisionsY: 1,
      minorGridlinesX: 1,
      minorGridlinesY: 1,
      arePickDivisionsVisibleX: false,
      arePickDivisionsVisibleY: false,
      titleSizeX: this.core.config.axesTextTitleSize * facetScaling,
      headingSizeX: this.core.config.axesTextTitleSize * facetScaling,
      scaling: facetScaling
    };

    this.renderer.currentAxes = [];
    for (let i = 0; i < 2; i++) {
      const axes = MorphCharts.Axes.Cartesian2dAxesHelper.create(this.core, axesOptions);
      axes.setHeading(0, i ? "healthy" : "disease");
      axes.setTitle(0, i
        ? `${data.healthyTotal} ${data.healthyTotal == 1 ? "person" : "people"} `
        : `${data.diseaseTotal} ${data.diseaseTotal == 1 ? "person" : "people"} (${config.count} total, ${(config.prior * 100).toFixed(1)}% with disease)`
      );
      axes.isHeadingVisible[MorphCharts.Edge2D.top] = false;
      axes.isEdgeVisible[MorphCharts.Edge2D.bottom] = false;
      axes.setLabels(0, null as unknown as string[]);
      axes.setLabels(1, null as unknown as string[]);
      axes.zero[0] = -1;
      axes.zero[1] = -1;
      axes.offsetX = this.sheet.offsetX(i);
      this.renderer.currentAxes.push(this.renderer.createCartesian2dAxesVisual(axes));
    }
  }

  private layout2(data: BayesData, config: FormConfig): void {
    if (!this.core || !this.renderer || !this.sheet) return;

    const constants = this.getLayoutConstants(config.count);
    this.updateFilter(data.ids);
    if (!this.transitionBuffer) return;

    const facetsX = 2;
    const facetsY = 2;
    const facets = facetsX * facetsY;
    const binIdsX = new Uint32Array(data.disease);
    const binIdsY = new Uint32Array(data.positiveTest);

    for (let i = 0; i < config.count; i++) {
      binIdsX[i] = 1 - binIdsX[i]; // Right-to-left
      binIdsY[i] = 1 - binIdsY[i]; // Top-to-bottom
    }

    const orderedIds = new Uint32Array(config.count);
    const facetIds = new Uint32Array(config.count);
    const offsets = new Uint32Array(facets);
    const counts = new Uint32Array(facets);

    const facetHelper = new MorphCharts.Helpers.FacetHelper(this.core);
    facetHelper.split2d(data.ids, facetsX, facetsY, binIdsX, binIdsY, orderedIds, facetIds, offsets, counts);

    // Layout per facet
    for (let facetId = 0; facetId < facets; facetId++) {
      const layoutOptions = {
        offset: offsets[facetId],
        count: counts[facetId],
        side: constants.side
      };
      this.sheet.layout(this.transitionBuffer.currentBuffer, orderedIds, layoutOptions);
    }

    const vertexOptions = {
      minBoundsX: constants.minBoundsX,
      maxBoundsX: constants.maxBoundsX,
      minBoundsY: constants.minBoundsY,
      maxBoundsY: constants.maxBoundsY,
      colors: data.positiveTest,
      minColor: 0,
      maxColor: 1,
      padding: constants.padding,
      thickness: constants.thickness,
      selected: data.truePositiveIds,
      facetCoordsX: binIdsX,
      facetCoordsY: binIdsY,
      facetsX: 2,
      facetsY: 2,
      facetSpacingX: constants.facetSpacingX,
      facetSpacingY: constants.facetSpacingY
    };
    this.sheet.update(this.transitionBuffer.currentBuffer, data.ids, vertexOptions);
    this.transitionBuffer.currentBuffer.unitType = MorphCharts.UnitType.block;
    this.transitionBuffer.currentPalette.colors = this.palette;

    const facetScaling = this.sheet.facetScaling;
    const axesOptions = {
      minBoundsX: constants.minBoundsX,
      maxBoundsX: constants.maxBoundsX,
      minBoundsY: constants.minBoundsY,
      maxBoundsY: constants.maxBoundsY,
      divisionsX: 1,
      divisionsY: 1,
      minorGridlinesX: 1,
      minorGridlinesY: 1,
      arePickDivisionsVisibleX: false,
      arePickDivisionsVisibleY: false,
      titleSizeX: this.core.config.axesTextTitleSize * facetScaling,
      headingSizeX: this.core.config.axesTextTitleSize * facetScaling,
      scaling: facetScaling
    };

    this.renderer.currentAxes = [];
    for (let i = 0; i < 4; i++) {
      const axes = MorphCharts.Axes.Cartesian2dAxesHelper.create(this.core, axesOptions);
      switch (i) {
        case 2:
          axes.setHeading(0, "disease, positive test");
          axes.setTitle(0, `${data.truePositiveIds.size} true positive${data.truePositiveIds.size == 1 ? "" : "s"} (${data.diseaseTotal} with disease, ${Math.round(config.sensitivity * 100)}% sensitive)`);
          break;
        case 3:
          axes.setHeading(0, "healthy, positive test");
          axes.setTitle(0, `${data.falsePositiveIds.size} false positive${data.falsePositiveIds.size == 1 ? "" : "s"} `);
          break;
        case 0:
          axes.setHeading(0, "disease, negative test");
          axes.setTitle(0, `${data.falseNegativeIds.size} false negative${data.falseNegativeIds.size == 1 ? "" : "s"} `);
          break;
        case 1:
          axes.setHeading(0, "healthy, negative test");
          axes.setTitle(0, `${data.trueNegativeIds.size} true negative${data.trueNegativeIds.size == 1 ? "" : "s"} (${data.healthyTotal} healthy, ${Math.round(config.specificity * 100)}% specific)`);
          break;
      }
      axes.isHeadingVisible[MorphCharts.Edge2D.top] = false;
      axes.isEdgeVisible[MorphCharts.Edge2D.bottom] = false;
      axes.setLabels(0, null as unknown as string[]);
      axes.setLabels(1, null as unknown as string[]);
      axes.zero[0] = -1;
      axes.zero[1] = -1;

      const facetX = i % 2;
      const facetY = 1 - Math.floor(i / 2);
      axes.offsetX = this.sheet.offsetX(facetX);
      axes.offsetY = this.sheet.offsetY(facetY);
      this.renderer.currentAxes.push(this.renderer.createCartesian2dAxesVisual(axes));
    }
  }

  private layout3(data: BayesData, config: FormConfig): void {
    if (!this.core || !this.renderer || !this.sheet) return;

    const constants = this.getLayoutConstants(config.count);
    this.updateFilter(data.positiveIds);
    if (!this.transitionBuffer) return;

    const layoutOptions = { side: constants.side };
    this.sheet.layout(this.transitionBuffer.currentBuffer, data.positiveIds, layoutOptions);

    const vertexOptions = {
      minBoundsX: constants.minBoundsX,
      maxBoundsX: constants.maxBoundsX,
      minBoundsY: constants.minBoundsY,
      maxBoundsY: constants.maxBoundsY,
      colors: data.positiveTest,
      minColor: 0,
      maxColor: 1,
      padding: constants.padding,
      thickness: constants.thickness,
      selected: data.truePositiveIds
    };
    this.sheet.update(this.transitionBuffer.currentBuffer, data.positiveIds, vertexOptions);
    this.transitionBuffer.currentBuffer.unitType = MorphCharts.UnitType.block;
    this.transitionBuffer.currentPalette.colors = this.palette;

    const totalPositive = data.truePositiveIds.size + data.falsePositiveIds.size;
    const probability = totalPositive > 0 ? (100 * data.truePositiveIds.size) / totalPositive : 0;
    const ratio = data.truePositiveIds.size > 0 ? Math.round(totalPositive / data.truePositiveIds.size) : 0;

    const axesOptions = {
      minBoundsX: constants.minBoundsX,
      maxBoundsX: constants.maxBoundsX,
      minBoundsY: constants.minBoundsY,
      maxBoundsY: constants.maxBoundsY,
      divisionsX: 1,
      divisionsY: 1,
      minorGridlinesX: 1,
      minorGridlinesY: 1,
      arePickDivisionsVisibleX: false,
      arePickDivisionsVisibleY: false,
      titleX: `${totalPositive} positive test${totalPositive == 1 ? "" : "s"} (${data.truePositiveIds.size} true positive${data.truePositiveIds.size == 1 ? "" : "s"}, ${data.falsePositiveIds.size} false positive${data.falsePositiveIds.size == 1 ? "" : "s"})`,
      headingX: `Probability of disease for positive test is ${data.truePositiveIds.size}\u00F7${totalPositive}=${probability.toFixed(1)}% (~1 in ${ratio})`,
      headingSizeX: this.core.config.axesTextTitleSize
    };

    const axes = MorphCharts.Axes.Cartesian2dAxesHelper.create(this.core, axesOptions);
    axes.isHeadingVisible[MorphCharts.Edge2D.top] = false;
    axes.isEdgeVisible[MorphCharts.Edge2D.bottom] = false;
    axes.setLabels(0, null as unknown as string[]);
    axes.setLabels(1, null as unknown as string[]);
    axes.zero[0] = -1;
    axes.zero[1] = -1;
    this.renderer.currentAxes = [this.renderer.createCartesian2dAxesVisual(axes)];
  }

  destroy(): void {
    this.core = null;
    this.renderer = null;
    this.sheet = null;
    this.transitionBuffer = null;
    this.filter = null;
  }
}
