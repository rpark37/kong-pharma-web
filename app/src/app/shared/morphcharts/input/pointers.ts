// Ported from microsoft/morphcharts client/src/input/pointers.ts (MIT).
import { Manipulator } from './manipulator';

export class Pointers {
  private _element: HTMLElement | null = null;
  private readonly _manipulators: Record<string, Manipulator>;
  private _hoverX: number | null = null;
  private _hoverY: number | null = null;
  private _hoverId: number | null = null;
  private readonly _devicePixelRatio = 1;
  private readonly _listeners: Array<[string, EventListener]> = [];

  /** Hover position in css pixels, or null when the pointer left the element. */
  get hoverX(): number | null { return this._hoverX; }
  get hoverY(): number | null { return this._hoverY; }
  get hoverId(): number | null { return this._hoverId; }

  constructor(manipulators: Record<string, Manipulator>) {
    this._manipulators = manipulators;
  }

  initialize(element: HTMLElement): void {
    this._element = element;
    const add = (type: string, handler: (e: PointerEvent) => void) => {
      const listener = handler as EventListener;
      element.addEventListener(type, listener, { passive: true });
      this._listeners.push([type, listener]);
    };
    add('pointerdown', (e) => this._handlePointerDown(e));
    add('pointermove', (e) => this._handlePointerMove(e));
    add('pointerup', (e) => this._handlePointerUp(e));
    add('pointercancel', (e) => this._remove(e.pointerId));
    add('pointerleave', (e) => { this._resetHover(); this._remove(e.pointerId); });
    add('pointerout', (e) => { this._resetHover(); this._remove(e.pointerId); });
  }

  dispose(): void {
    for (const [type, listener] of this._listeners) this._element?.removeEventListener(type, listener);
    this._listeners.length = 0;
    this._element = null;
  }

  private _handlePointerDown(e: PointerEvent): void {
    this._element?.focus();
    const manipulator = new Manipulator();
    const id = e.pointerId;
    const x = e.offsetX * this._devicePixelRatio;
    const y = e.offsetY * this._devicePixelRatio;
    manipulator.id = id;
    manipulator.position[0] = x;
    manipulator.position[1] = y;
    manipulator.type = e.pointerType;
    manipulator.button = e.button;
    manipulator.shiftKey = e.shiftKey;
    manipulator.ctrlKey = e.ctrlKey;
    manipulator.altKey = e.altKey;
    manipulator.event = e;
    this._manipulators[id] = manipulator;
    this._hoverId = id;
    this._hoverX = x;
    this._hoverY = y;
  }

  private _handlePointerMove(e: PointerEvent): void {
    const x = e.offsetX * this._devicePixelRatio;
    const y = e.offsetY * this._devicePixelRatio;
    const id = e.pointerId;
    const manipulator = this._manipulators[id];
    if (manipulator) {
      manipulator.position[0] = x;
      manipulator.position[1] = y;
      manipulator.event = e;
    }
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      this._hoverId = id;
      this._hoverX = x;
      this._hoverY = y;
    }
  }

  private _handlePointerUp(e: PointerEvent): void {
    const manipulator = this._manipulators[e.pointerId];
    if (manipulator) manipulator.event = e;
    this._remove(e.pointerId);
  }

  private _resetHover(): void {
    this._hoverId = null;
    this._hoverX = null;
    this._hoverY = null;
  }

  private _remove(pointerId: number): void {
    if (this._manipulators[pointerId]) delete this._manipulators[pointerId];
  }
}
