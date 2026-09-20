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
  default: () => ({
    data: {
      shared: {
        observer: 'author',
        assessments: [
          { host: 'gateway.example', wallets: ['wallet'], pass: true },
        ],
      },
      mixed: {
        assessments: [
          { host: 'passing.example', wallets: ['other-wallet'], pass: true },
          { host: 'z-failing.example', wallets: ['wallet'], pass: false },
          { host: 'a-failing.example', wallets: ['wallet'], pass: false },
        ],
      },
      missing: null,
    },
    isFetching: false,
    refetch: vi.fn(),
  }),
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
  });
});
