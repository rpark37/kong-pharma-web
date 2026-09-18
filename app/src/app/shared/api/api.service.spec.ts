import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('returns API data and stays online', async () => {
    const promise = api.merchandiseKpis({ from: '2020-11-01' });
    const req = http.expectOne((r) => r.url === `${environment.apiBase}/merchandise/kpis`);
    expect(req.request.params.get('from')).toBe('2020-11-01');
    req.flush({ sessions: 1 });
    await expect(promise).resolves.toEqual({ sessions: 1 });
    expect(api.usingSnapshot()).toBe(false);
  });

  it('falls back to the JSON snapshot when the API is unreachable', async () => {
    const promise = api.aresSummary();
    http.expectOne(`${environment.apiBase}/ares/summary`).error(new ProgressEvent('error'));
    await Promise.resolve();
    const snap = http.expectOne('data/snapshot/ares__summary.json');
    snap.flush({ persons: 5 });
    await expect(promise).resolves.toEqual({ persons: 5 });
    expect(api.usingSnapshot()).toBe(true);
    expect(api.offline()).toBe(true);
  });
});
