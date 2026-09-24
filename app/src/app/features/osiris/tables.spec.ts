import { CONFLICT_ZONES, SEVERITY_COLOR } from './conflict-zones';
import { NEWS_FEEDS, embedUrl, externalUrl } from './news-feeds';

const onGlobe = (p: { lat: number; lon: number }) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

describe('NEWS_FEEDS', () => {
  it('has unique ids and coordinates on the globe', () => {
    expect(new Set(NEWS_FEEDS.map((f) => f.id)).size).toBe(NEWS_FEEDS.length);
    expect(NEWS_FEEDS.every(onGlobe)).toBe(true);
  });

  it('stores YouTube channel ids, not urls', () => {
    for (const f of NEWS_FEEDS.filter((f) => f.channel)) expect(f.channel).toMatch(/^UC[\w-]{22}$/);
  });

  it('builds a nocookie embed url only for embeddable feeds', () => {
    const sky = NEWS_FEEDS.find((f) => f.id === 'skynews')!;
    expect(embedUrl(sky)).toBe('https://www.youtube-nocookie.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ&autoplay=1&mute=1');
    const nbc = NEWS_FEEDS.find((f) => f.id === 'nbcnews')!;
    expect(embedUrl(nbc)).toBeNull();
    expect(externalUrl(nbc)).toBe('https://www.youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg/live');
  });

  it('keeps a feed without a YouTube channel as an external link', () => {
    const rt = NEWS_FEEDS.find((f) => f.id === 'rt')!;
    expect(rt.channel).toBe('');
    expect(embedUrl(rt)).toBeNull();
    expect(externalUrl(rt)).toBe('https://rumble.com/c/RTNewsEN');
  });
});

describe('CONFLICT_ZONES', () => {
  it('has unique ids and coordinates on the globe', () => {
    expect(new Set(CONFLICT_ZONES.map((z) => z.id)).size).toBe(CONFLICT_ZONES.length);
    expect(CONFLICT_ZONES.every(onGlobe)).toBe(true);
  });

  it('has a colour for every severity in use', () => {
    for (const z of CONFLICT_ZONES) expect(SEVERITY_COLOR[z.severity]).toMatch(/^(#|rgba?\()/);
  });
});
