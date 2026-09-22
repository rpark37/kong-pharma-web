import { Component, ElementRef, afterNextRender, model, output, signal, viewChild } from '@angular/core';

/**
 * Port of the MorphCharts client editor: a textarea with a line-number gutter that tracks the
 * caret line and highlights the line of the last JSON parse error.
 *
 * Shared: the MorphCharts page and the Vega chart gallery both edit specs with it.
 */
@Component({
  selector: 'app-spec-editor',
  template: `
    <div class="editor">
      <div class="lines" #lines aria-hidden="true">
        @for (n of lineNumbers(); track n) {
          <div [class.current]="n === currentLine()" [class.error]="n === errorLine()">{{ n }}</div>
        }
      </div>
      <textarea
        #content
        class="content"
        spellcheck="false"
        aria-label="Plot specification (JSON)"
        [value]="value()"
        (input)="onInput($any($event.target).value)"
        (scroll)="syncScroll()"
        (click)="trackCaret()"
        (keydown)="onKeydown($event)"
        (focus)="trackCaret()"
        (dragover)="$event.preventDefault()"
        (drop)="onDrop($event)"
      ></textarea>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 240px; }
    .editor { display: flex; height: 100%; border: 1px solid var(--hairline); border-radius: var(--radius-sm); overflow: hidden; background: var(--ink-3); font-family: var(--font-mono); font-size: 12px; line-height: 18px; }
    .lines { width: 44px; padding: 8px 0; text-align: right; color: var(--on-ink-faint); overflow: hidden; user-select: none; border-right: 1px solid var(--hairline); }
    .lines div { padding-right: 8px; }
    .lines .current { color: var(--teal); background: color-mix(in srgb, var(--teal) 8%, transparent); }
    .lines .error { color: var(--rose); background: rgba(179,38,30,0.18); }
    .content { flex: 1; margin: 0; padding: 8px; border: 0; outline: none; resize: none; background: transparent; color: var(--on-ink); font: inherit; white-space: pre; overflow: auto; tab-size: 2; }
    /* The rule above suppresses the default ring; a textarea must still show focus.
       Inset so the ring is not clipped by the scroll container. */
    .content:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
  `,
})
export class SpecEditorComponent {
  readonly value = model('');
  readonly changed = output<string>();
  readonly currentLine = signal(1);
  readonly errorLine = signal<number | null>(null);
  readonly lineNumbers = signal<number[]>([1, 2]);
  private readonly contentRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('content');
  private readonly linesRef = viewChild.required<ElementRef<HTMLDivElement>>('lines');
  readonly tabLength = 2;

  constructor() {
    afterNextRender(() => this.updateLines());
  }

  setContent(text: string): void {
    this.value.set(text);
    this.errorLine.set(null);
    this.updateLines(text);
    this.changed.emit(text);
  }

  onInput(text: string): void {
    this.value.set(text);
    this.errorLine.set(null);
    this.updateLines();
    this.changed.emit(text);
  }

  /** Parses the editor content; on failure highlights the reported line and rethrows. */
  parseJSON(): unknown {
    try {
      const json = JSON.parse(this.value());
      this.errorLine.set(null);
      return json;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const match = message.match(/line (\d+) column (\d+)/i);
      if (match) this.errorLine.set(parseInt(match[1], 10));
      throw error;
    }
  }

  syncScroll(): void {
    this.linesRef().nativeElement.scrollTop = this.contentRef().nativeElement.scrollTop;
  }

  trackCaret(): void {
    setTimeout(() => this.updateLines(), 0);
  }

  onKeydown(e: KeyboardEvent): void {
    const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
    if (nav.includes(e.key)) this.trackCaret();
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = this.contentRef().nativeElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const spaces = ' '.repeat(this.tabLength);
      ta.setRangeText(spaces, start, end, 'end');
      this.onInput(ta.value);
    }
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    if (!['.txt', '.json'].includes(ext)) return;
    const reader = new FileReader();
    reader.onload = (ev) => this.setContent((ev.target?.result as string) ?? '');
    reader.readAsText(file);
  }

  private updateLines(textOverride?: string): void {
    const ta = this.contentRef().nativeElement;
    const text = textOverride ?? ta.value;
    this.currentLine.set(text.substring(0, ta.selectionStart).split('\n').length);
    const total = text.split('\n').length + 1; // extra line pads for the horizontal scrollbar
    if (this.lineNumbers().length !== total) this.lineNumbers.set(Array.from({ length: total }, (_, i) => i + 1));
  }
}
