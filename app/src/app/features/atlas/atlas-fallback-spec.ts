import { SYSTEMS, type Part } from './anatomy';

/** Vega treemap of the catalogue (systems → parts by bounding-box volume) for browsers without WebGPU. */
export function atlasTreemapSpec(parts: Part[]): Record<string, unknown> {
  const nodes: Array<{ id: string; parent?: string; name: string; system?: string; size?: number }> = [{ id: 'root', name: 'Human Atlas' }];
  for (const s of SYSTEMS) nodes.push({ id: s.id, parent: 'root', name: s.name, system: s.id });
  for (const p of parts) nodes.push({ id: p.id, parent: p.system, name: p.name, system: p.system, size: Math.max(1e-7, p.sx * p.sy * p.sz) });
  return {
    $schema: 'https://vega.github.io/schema/vega/v6.json',
    width: 900,
    height: 520,
    padding: 4,
    autosize: { type: 'fit', contains: 'padding' },
    title: { text: 'Structures by system (area = bounding-box volume)' },
    data: [
      { name: 'tree', values: nodes, transform: [{ type: 'stratify', key: 'id', parentKey: 'parent' }, { type: 'treemap', field: 'size', method: 'squarify', paddingInner: 1, paddingOuter: 3, size: [{ signal: 'width' }, { signal: 'height' }] }] },
      { name: 'leaves', source: 'tree', transform: [{ type: 'filter', expr: 'datum.size != null' }] },
      { name: 'groups', source: 'tree', transform: [{ type: 'filter', expr: 'datum.parent === "root"' }] },
    ],
    scales: [{ name: 'color', type: 'ordinal', domain: SYSTEMS.map((s) => s.id), range: SYSTEMS.map((s) => s.color) }],
    marks: [
      { type: 'rect', from: { data: 'leaves' }, encode: { enter: { fill: { scale: 'color', field: 'system' }, tooltip: { signal: "datum.name + ' · ' + datum.system" } }, update: { x: { field: 'x0' }, y: { field: 'y0' }, x2: { field: 'x1' }, y2: { field: 'y1' }, fillOpacity: { value: 0.85 } }, hover: { fillOpacity: { value: 1 } } } },
      { type: 'text', from: { data: 'groups' }, interactive: false, encode: { enter: { font: { value: 'Inter' }, fontSize: { value: 12 }, fontWeight: { value: 600 }, fill: { value: '#121c24' }, align: { value: 'center' }, baseline: { value: 'middle' } }, update: { x: { signal: '(datum.x0 + datum.x1) / 2' }, y: { signal: '(datum.y0 + datum.y1) / 2' }, text: { field: 'name' }, opacity: { signal: '(datum.x1 - datum.x0) > 60 ? 1 : 0' } } } },
    ],
  };
}
