import useObservationReports from '@src/hooks/useObservationReports';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ObservationReports from './ObservationReports';

vi.mock('@src/hooks/useGateways', () => ({
  default: () => ({
    data: {
      'author-gateway': {
        settings: { label: 'Named Gateway', fqdn: 'named.example' },
      },
      'other-gateway': { settings: { label: '', fqdn: 'other.example' } },
    },
  }),
}));

vi.mock('@src/hooks/useObserverToGatewayMap', () => ({
  default: () => ({ author: 'author-gateway', other: 'other-gateway' }),
}));
vi.mock('@src/utils/arweaveUrl', () => ({
  arweaveTxUrl: (id: string) => `https://gateway.example/${id}`,
}));

vi.mock('@src/hooks/useObservationReports', () => ({
  default: vi.fn(() => ({
    data: {
      shared: {
        observer: 'author',
        assessments: [
          {
            host: 'gateway.example',
            wallets: ['wallet'],
            pass: true,
            reasons: [],
          },
        ],
      },
      mixed: {
        assessments: [
          {
            host: 'passing.example',
            wallets: ['other-wallet'],
            pass: true,
            reasons: [],
          },
          {
            host: 'z-failing.example',
            wallets: ['wallet'],
            pass: false,
            reasons: ['Response code 503'],
          },
          {
            host: 'a-failing.example',
            wallets: ['wallet'],
            pass: false,
            reasons: [],
          },
        ],
      },
      missing: null,
    },
    isFetching: false,
    loading: new Set<string>(),
    loadReports: vi.fn(),
  })),
}));

describe('observation report results', () => {
  it('shows shared report verdicts while leaving unavailable results unknown', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          reports={{
            author: 'shared',
            other: 'shared',
            unavailable: 'missing',
          }}
        />
      </StaticRouter>,
    );
    expect(html.match(/>Passed</g)).toHaveLength(2);
    expect(html).toContain('Unavailable');
    expect(html).toContain('Named Gateway');
    expect(html).toContain('other.example');
    expect(html).toContain('/gateways/author-gateway');
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain(
      '0 failed, 2 passed, 1 unavailable of 3 submissions',
    );
  });

  it('shows the assessments in a submitted report even when its author differs', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          observerAddress="other"
          reports={{ other: 'shared' }}
        />
      </StaticRouter>,
    );
    expect(html).toContain('gateway.example');
    expect(html).toContain('Passed');
  });

  it('does not treat omission of a gateway as passing', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="absent-wallet"
          reports={{ author: 'shared' }}
        />
      </StaticRouter>,
    );
    expect(html).toContain('Not assessed');
    expect(html).not.toContain('Passed');
  });

  it('counts incomplete report results and sorts failures before unknown and passing results', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          reports={{
            other: 'shared',
            zFailure: 'mixed',
            aFailure: 'mixed',
            'missing-observer': 'missing',
            author: 'shared',
          }}
        />
      </StaticRouter>,
    );
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain(
      '2 failed, 2 passed, 1 unavailable of 5 submissions',
    );
    expect(text.indexOf('aFailure')).toBeLessThan(text.indexOf('zFailure'));
    expect(text).toContain('missing-observer');
    expect(text.indexOf('zFailure')).toBeLessThan(
      text.indexOf('missing-observer'),
    );
    expect(text.indexOf('missing-observer')).toBeLessThan(
      text.indexOf('Named Gateway'),
    );
    expect(text.indexOf('Named Gateway')).toBeLessThan(
      text.indexOf('other.example'),
    );
  });

  it('distinguishes omitted and unavailable report assessments without inferring votes', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="absent-wallet"
          reports={{ author: 'shared', unavailable: 'missing' }}
        />
      </StaticRouter>,
    );
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).not.toContain('Submitted votes');
    expect(text).not.toContain('Vote:');
    expect(text).toContain(
      'Report results: 0 failed, 0 passed, 1 not assessed, 1 unavailable of 2 submissions',
    );
    expect(text).toContain('Not assessed');
    expect(text).toContain('Unavailable');
    expect(text).not.toContain('Passed');
    expect(text).toContain('Retry');
  });

  it('counts outgoing report assessments and sorts failed hosts alphabetically first', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          observerAddress="author"
          reports={{ author: 'mixed' }}
        />
      </StaticRouter>,
    );
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain('2 failed, 1 passed of 3 assessments');
    expect(text.indexOf('a-failing.example')).toBeLessThan(
      text.indexOf('z-failing.example'),
    );
    expect(text.indexOf('z-failing.example')).toBeLessThan(
      text.indexOf('passing.example'),
    );
    expect(text).toContain('Response code 503');
  });

  it.each([
    ['shared', ['author'], 'Passed', 'Failed'],
    ['mixed', [], 'Failed', 'Passed'],
  ] as const)(
    'shows report/vote disagreements for %s',
    (report, failedObservers, result, vote) => {
      const html = renderToStaticMarkup(
        <StaticRouter location="/">
          <ObservationReports
            epochIndex={546}
            gatewayAddress="wallet"
            reports={{ author: report }}
            failedObservers={[...failedObservers]}
          />
        </StaticRouter>,
      );
      const text = html.replace(/<[^>]*>/g, '');
      expect(text).toContain(`Submitted result: ${vote}. Report: ${result}.`);
      expect(html).toContain(`>${result}</div>`);
      if (report === 'mixed') expect(text).toContain('Response code 503');
    },
  );

  it('keeps complete report rows when every archived vote passes', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          reports={{ author: 'shared', other: 'mixed', unavailable: 'missing' }}
          failedObservers={[]}
        />
      </StaticRouter>,
    );
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain(
      '1 failed, 1 passed, 1 unavailable of 3 submissions',
    );
    expect(text).toContain('Submitted result: Passed. Report: Failed.');
    expect(text).toContain('Named Gateway');
    expect(text).toContain('other.example');
    expect(text).toContain('unavailable');
  });

  it('shows incomplete archive capture without claiming no reports were submitted', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          reports={{}}
          captureShortfall="10 submitted; reports unavailable"
        />
      </StaticRouter>,
    );
    expect(html).toContain('10 submitted; reports unavailable');
    expect(html).not.toContain('No reports submitted');
  });

  it('renders all observer rows and submitted results before reports are loaded', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          reports={{ author: 'unread', other: 'also-unread' }}
          failedObservers={['author']}
        />
      </StaticRouter>,
    );
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain('Named Gateway');
    expect(text).toContain('other.example');
    expect(text).toContain('Submitted: Failed');
    expect(text).toContain('Submitted: Passed');
    expect(text).toContain('2 not loaded of 2 submissions');
    expect(text).not.toContain('Unavailable');
    expect(text).toContain('Load failed reports');
    expect(text).toContain('Load all reports');
  });

  it('renders a completed report while another is still loading', () => {
    vi.mocked(useObservationReports).mockReturnValueOnce({
      data: {
        complete: {
          assessments: [
            {
              host: 'old.example',
              wallets: ['wallet'],
              pass: true,
              reasons: [],
            },
          ],
        },
        pending: undefined,
      },
      loading: new Set(['pending']),
      isFetching: true,
      loadReports: vi.fn(),
    });
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          reports={{ author: 'complete', other: 'pending' }}
        />
      </StaticRouter>,
    );
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain('0 failed, 1 passed, 1 loading of 2 submissions');
    expect(html).toContain('>Passed</div>');
    expect(html).toContain('>Loading</div>');
  });

  it('leaves the outgoing report unloaded until requested', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <ObservationReports
          epochIndex={546}
          gatewayAddress="wallet"
          observerAddress="author"
          reports={{ author: 'unread' }}
        />
      </StaticRouter>,
    );
    expect(html).toContain('Report not loaded.');
    expect(html).toContain('Load report');
    expect(html).not.toContain('unavailable');
  });
});
