import { summarizeGatewayAssessment } from '@src/utils/gatewayAssessment';
import {
  type QueryClient,
  useMutation,
  useMutationState,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import { strFromU8 } from 'fflate';
import { downloadReport } from './useReport';

export interface ReportAssessment {
  host: string;
  wallets: string[];
  pass: boolean;
  reasons: string[];
}

export interface ObservationReport {
  assessments: ReportAssessment[];
}

export function readObservationReport(
  value: unknown,
  epochIndex: number,
): ObservationReport {
  const report = value as Record<string, unknown> | null;
  if (
    report?.epochIndex !== epochIndex ||
    !report.gatewayAssessments ||
    typeof report.gatewayAssessments !== 'object' ||
    Array.isArray(report.gatewayAssessments)
  ) {
    throw new Error('Report does not contain assessments for this epoch.');
  }

  const assessments = Object.entries(report.gatewayAssessments).map(
    ([host, assessment]) => {
      const wallets = assessment?.ownershipAssessment?.expectedWallets;
      if (
        typeof assessment?.pass !== 'boolean' ||
        !Array.isArray(wallets) ||
        wallets.length === 0 ||
        !wallets.every(
          (wallet) => typeof wallet === 'string' && wallet.length > 0,
        )
      ) {
        throw new Error('Report contains an invalid gateway assessment.');
      }
      return {
        host,
        wallets,
        pass: assessment.pass,
        reasons: summarizeGatewayAssessment(assessment)!.reasons,
      };
    },
  );
  return { assessments };
}

const reportQuery = (id: string, epochIndex: number) => ({
  queryKey: ['observationReport', epochIndex, id],
  queryFn: async () =>
    readObservationReport(
      JSON.parse(strFromU8(await downloadReport(id))),
      epochIndex,
    ),
  staleTime: 5 * 60 * 1000,
  retry: false as const,
});

export async function fetchObservationReports(
  reportIds: string[],
  epochIndex: number,
  queryClient: QueryClient,
): Promise<Record<string, ObservationReport | null>> {
  const pending = [...new Set(reportIds)];
  const results: Record<string, ObservationReport | null> = {};
  // Reports can be megabytes each. Limit simultaneous downloads and decoding.
  await Promise.all(
    Array.from({ length: Math.min(3, pending.length) }, async () => {
      for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
        try {
          results[id] = await queryClient.fetchQuery(
            reportQuery(id, epochIndex),
          );
        } catch {
          results[id] = null;
        }
      }
    }),
  );
  return results;
}

export default function useObservationReports(
  reports: Record<string, string>,
  epochIndex: number,
) {
  const queryClient = useQueryClient();
  const reportIds = [...new Set(Object.values(reports))].sort();
  const queries = useQueries({
    queries: reportIds.map((id) => ({
      ...reportQuery(id, epochIndex),
      enabled: false,
    })),
  });
  const mutationKey = ['loadObservationReports', epochIndex];
  const pending = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) => mutation.state.variables as string[],
  });
  const loader = useMutation({
    mutationKey,
    // Share the three-download limit across both panels and queued clicks.
    scope: { id: 'loadObservationReports' },
    mutationFn: (ids: string[]) =>
      fetchObservationReports(ids, epochIndex, queryClient),
  });
  const loading = new Set(pending.flat());
  const data: Record<string, ObservationReport | null | undefined> = {};
  reportIds.forEach((id, index) => {
    const query = queries[index];
    data[id] = query.data ?? (query.isError ? null : undefined);
  });
  return {
    data,
    loading,
    isFetching: loading.size > 0,
    loadReports: (ids: string[]) => {
      const requested = [...new Set(ids)].filter(
        (id) => reportIds.includes(id) && !data[id] && !loading.has(id),
      );
      if (requested.length > 0) loader.mutate(requested);
    },
  };
}
