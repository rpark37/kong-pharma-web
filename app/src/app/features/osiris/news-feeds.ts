import type { LatLon } from '../map/sites';

/**
 * Broadcasters with a 24/7 live stream, copied from OSIRIS's `LIVE_FEEDS`
 * (https://github.com/simplifaisoul/osiris, MIT). `embed` mirrors upstream's `embed_allowed`,
 * verified by them in 2026-09: YouTube refuses to iframe the others, so those open externally.
 * Only the channel id is stored; the two URL shapes are built below so they are written once.
 */
export interface NewsFeed extends LatLon {
  id: string;
  name: string;
  city: string;
  country: string;
  /** YouTube channel id, or '' when the stream is not on YouTube (`url` then carries the link). */
  channel: string;
  embed: boolean;
  url?: string;
}

export const NEWS_FEEDS: NewsFeed[] = [
  { id: 'nbcnews', name: 'NBC News NOW', city: 'New York', country: 'US', lat: 40.759, lon: -73.98, channel: 'UCeY0bbntWzzVIaj2z3QigXg', embed: false },
  { id: 'cbsnews', name: 'CBS News 24/7', city: 'New York', country: 'US', lat: 40.764, lon: -73.973, channel: 'UC8p1vwvWtl6T73JiExfWs1g', embed: false },
  { id: 'abcnews', name: 'ABC News Live', city: 'New York', country: 'US', lat: 40.763, lon: -73.979, channel: 'UCBi2mrWuNuyYy4gbM6fU18Q', embed: false },
  { id: 'bloomberg', name: 'Bloomberg TV', city: 'New York', country: 'US', lat: 40.756, lon: -73.988, channel: 'UC_vQ72b7v5n2938v9d5c80w', embed: false },
  { id: 'cspan', name: 'C-SPAN', city: 'Washington DC', country: 'US', lat: 38.897, lon: -77.036, channel: 'UCb--64Gl51jIEVE-GLDAVTg', embed: false },
  { id: 'cbc', name: 'CBC News', city: 'Toronto', country: 'CA', lat: 43.644, lon: -79.387, channel: 'UCKy1dAqELon0zgzZPOz9SVw', embed: false },
  { id: 'skynews', name: 'Sky News', city: 'London', country: 'GB', lat: 51.5, lon: -0.118, channel: 'UCoMdktPbSTixAyNGwb-UYkQ', embed: true },
  { id: 'france24en', name: 'France 24 EN', city: 'Paris', country: 'FR', lat: 48.83, lon: 2.28, channel: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', embed: true },
  { id: 'dwnews', name: 'DW News', city: 'Berlin', country: 'DE', lat: 52.508, lon: 13.376, channel: 'UCknLrEdhRCp1aegoMqRaCZg', embed: true },
  { id: 'aljazeera', name: 'Al Jazeera EN', city: 'Doha', country: 'QA', lat: 25.286, lon: 51.534, channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg', embed: true },
  { id: 'nhkworld', name: 'NHK World', city: 'Tokyo', country: 'JP', lat: 35.69, lon: 139.692, channel: 'UCSPEjw8F2nQDtmUKPFNF7_A', embed: true },
  { id: 'cna', name: 'CNA 24/7', city: 'Singapore', country: 'SG', lat: 1.29, lon: 103.852, channel: 'UC83jt4dlz1Gjl58fzQrrKZg', embed: true },
  { id: 'wion', name: 'WION', city: 'New Delhi', country: 'IN', lat: 28.614, lon: 77.209, channel: 'UC_gUM8rL-Lrg6O3adPW9K1g', embed: true },
  { id: 'cgtn', name: 'CGTN', city: 'Beijing', country: 'CN', lat: 39.904, lon: 116.407, channel: 'UCgrNz-aDmcr2uuto8_DL2jg', embed: false },
  { id: 'rt', name: 'RT News', city: 'Moscow', country: 'RU', lat: 55.755, lon: 37.617, channel: '', embed: false, url: 'https://rumble.com/c/RTNewsEN' },
];

/** The iframe src, or null when the broadcaster blocks embedding. nocookie keeps YouTube from setting cookies until play. */
export function embedUrl(f: NewsFeed): string | null {
  return f.embed && f.channel ? `https://www.youtube-nocookie.com/embed/live_stream?channel=${f.channel}&autoplay=1&mute=1` : null;
}

export function externalUrl(f: NewsFeed): string {
  return f.url ?? `https://www.youtube.com/channel/${f.channel}/live`;
}
