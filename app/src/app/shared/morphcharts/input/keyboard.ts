// Ported from microsoft/morphcharts client/src/input/keyboard.ts (MIT).
export class Keyboard {
  private readonly _pressedKeys = new Set<string>();
  private readonly _previousPressedKeys = new Set<string>();

  initialize(element: HTMLElement): void {
    element.addEventListener('keydown', (e) => this._pressedKeys.add(e.key));
    element.addEventListener('keyup', (e) => this._pressedKeys.delete(e.key));
  }

  isKeyDown(key: string): boolean {
    return this._pressedKeys.has(key);
  }

  wasKeyReleased(key: string): boolean {
    if (this._pressedKeys.has(key)) {
      if (!this._previousPressedKeys.has(key)) {
        this._previousPressedKeys.add(key);
        return true;
      }
    } else {
      this._previousPressedKeys.delete(key);
    }
    return false;
  }
}
