// Ported from microsoft/morphcharts client/src/input/mousewheel.ts (MIT).
export class MouseWheel {
  private _previousTotal = 0;
  total = 0;
  delta = 0;
  private _element: HTMLElement | null = null;
  private readonly _onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.total += e.deltaY;
  };

  initialize(element: HTMLElement): void {
    this._element = element;
    element.addEventListener('wheel', this._onWheel, { passive: false });
  }

  update(): void {
    const total = this.total;
    this.delta = total - this._previousTotal;
    this._previousTotal = total;
  }

  reset(): void {
    this._previousTotal = 0;
    this.total = 0;
    this.delta = 0;
  }

  dispose(): void {
    this._element?.removeEventListener('wheel', this._onWheel);
    this._element = null;
  }
}
