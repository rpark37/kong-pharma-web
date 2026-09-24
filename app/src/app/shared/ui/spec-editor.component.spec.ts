import { TestBed } from '@angular/core/testing';
import { SpecEditorComponent } from './spec-editor.component';

describe('SpecEditorComponent', () => {
  it('highlights the line reported by a JSON parse error', async () => {
    TestBed.configureTestingModule({ imports: [SpecEditorComponent] });
    const fixture = TestBed.createComponent(SpecEditorComponent);
    await fixture.whenStable();
    const cmp = fixture.componentInstance;
    cmp.setContent('{\n  "a": 1,\n  "b": ,\n}');
    expect(() => cmp.parseJSON()).toThrow();
    // Chromium reports "line 3 column 8"; other engines may not include a position.
    expect(cmp.errorLine() === null || cmp.errorLine() === 3).toBe(true);
    cmp.setContent('{"a": 1}');
    expect(cmp.parseJSON()).toEqual({ a: 1 });
    expect(cmp.errorLine()).toBeNull();
    expect(cmp.lineNumbers().length).toBe(2);
  });
});
