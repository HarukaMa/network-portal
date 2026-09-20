import { QueryClient } from '@tanstack/react-query';
import { strToU8 } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchObservationReports,
  readObservationReport,
} from './useObservationReports';
import { downloadReport } from './useReport';

vi.mock('./useReport', () => ({ downloadReport: vi.fn() }));

afterEach(() => vi.resetAllMocks());

const report = {
  epochIndex: 546,
  observerAddress: 'observer',
  gatewayAssessments: {
    'gateway.example': {
      pass: false,
      ownershipAssessment: { expectedWallets: ['wallet'] },
    },
  },
};

describe('historical report recovery', () => {
  it('keeps named failures when another report cannot be downloaded', async () => {
    vi.mocked(downloadReport).mockImplementation(async (id) => {
      if (id === 'missing') throw new Error('404');
      return strToU8(JSON.stringify(report));
    });
    const result = await fetchObservationReports(
      ['available', 'missing'],
      546,
      new QueryClient(),
    );
    expect(result.available?.assessments).toEqual([
      { host: 'gateway.example', wallets: ['wallet'], pass: false },
    ]);
    expect(result.missing).toBeNull();
  });

  it('downloads overlapping reports once and reuses them when another panel opens', async () => {
    vi.mocked(downloadReport).mockResolvedValue(
      strToU8(JSON.stringify(report)),
    );
    const client = new QueryClient();
    const [all, selected] = await Promise.all([
      fetchObservationReports(['shared', 'other'], 546, client),
      fetchObservationReports(['shared'], 546, client),
    ]);
    expect(all.shared?.assessments[0].pass).toBe(false);
    expect(selected.shared?.assessments[0].pass).toBe(false);
    await fetchObservationReports(['other'], 546, client);
    expect(downloadReport).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('rejects a report from another epoch', () => {
    expect(() => readObservationReport(report, 545)).toThrow();
  });

  it('rejects a missing result instead of treating it as a failure', () => {
    expect(() =>
      readObservationReport(
        {
          ...report,
          gatewayAssessments: {
            'gateway.example': {
              ownershipAssessment: { expectedWallets: ['wallet'] },
            },
          },
        },
        546,
      ),
    ).toThrow();
  });
});
