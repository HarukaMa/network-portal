import Button from '@src/components/Button';
import useGateways from '@src/hooks/useGateways';
import useObservationReports from '@src/hooks/useObservationReports';
import useObserverToGatewayMap from '@src/hooks/useObserverToGatewayMap';
import { arweaveTxUrl } from '@src/utils/arweaveUrl';
import { NotebookText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const resultOrder = {
  Failed: 0,
  Loading: 1,
  'Not loaded': 2,
  Unavailable: 2,
  'Not assessed': 3,
  Passed: 4,
};

const ObservationReports = ({
  reports,
  epochIndex,
  gatewayAddress,
  observerAddress,
  failedObservers,
  captureShortfall,
}: {
  reports: Record<string, string>;
  epochIndex: number;
  gatewayAddress: string;
  observerAddress?: string;
  failedObservers?: string[];
  captureShortfall?: string;
}) => {
  const selectedReportId =
    observerAddress === undefined ? undefined : reports[observerAddress];
  const requestedReports =
    observerAddress !== undefined
      ? selectedReportId
        ? { [observerAddress]: selectedReportId }
        : {}
      : reports;
  const { data, loading, isFetching, loadReports } = useObservationReports(
    requestedReports,
    epochIndex,
  );
  const observerToGatewayMap = useObserverToGatewayMap();
  const { data: gateways } = useGateways();
  const navigate = useNavigate();

  if (observerAddress !== undefined && !reports[observerAddress]) {
    return (
      <div className="p-6 text-xs text-low">
        {captureShortfall ?? 'No report submitted for this epoch.'}
      </div>
    );
  }
  if (Object.keys(reports).length === 0) {
    return (
      <div className="p-6 text-xs text-low">
        {captureShortfall ?? 'No reports submitted for this epoch.'}
      </div>
    );
  }

  if (observerAddress !== undefined) {
    const id = reports[observerAddress];
    const report = data?.[id];
    if (!report) {
      return (
        <div className="p-6 text-xs text-low">
          {loading.has(id)
            ? 'Loading report...'
            : report === null
              ? 'Report details unavailable.'
              : 'Report not loaded.'}{' '}
          <button
            type="button"
            className="underline"
            disabled={loading.has(id)}
            onClick={() => loadReports([id])}
          >
            {loading.has(id)
              ? 'Loading...'
              : report === null
                ? 'Retry'
                : 'Load report'}
          </button>
        </div>
      );
    }
    const assessments = [...report.assessments].sort(
      (a, b) => Number(a.pass) - Number(b.pass) || a.host.localeCompare(b.host),
    );
    const failed = assessments.filter(({ pass }) => !pass).length;
    return (
      <>
        <div className="px-6 py-3 text-xs text-low">
          In report: <span className="text-red-500">{failed} failed</span>,{' '}
          <span className="text-green-500">
            {assessments.length - failed} passed
          </span>{' '}
          of {assessments.length} assessments.
        </div>
        {report.assessments.length === 0 && (
          <div className="px-6 py-3 text-xs text-low">
            No gateway assessments in this report.
          </div>
        )}
        {assessments.map(({ host, wallets, pass, reasons }) => (
          <div
            key={host}
            className="flex items-start gap-3 border-t border-grey-500 px-6 py-3 text-xs"
          >
            <div className="min-w-0 grow break-words">
              <div className="text-mid">{host}</div>
              {wallets.map((wallet) => (
                <Link
                  key={wallet}
                  className="block break-all text-low"
                  to={`/gateways/${wallet}`}
                >
                  {wallet}
                </Link>
              ))}
              {!pass && reasons.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-low">
                  {reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
            <span className={pass ? 'text-green-500' : 'text-red-500'}>
              {pass ? 'Passed' : 'Failed'}
            </span>
          </div>
        ))}
      </>
    );
  }

  const entries = Object.entries(reports)
    .map(([observer, id]) => {
      const report = data?.[id];
      const observerGateway = observerToGatewayMap?.[observer];
      const settings = observerGateway
        ? gateways?.[observerGateway]?.settings
        : undefined;
      const name = settings?.label?.trim() || settings?.fqdn;
      const assessments =
        report?.assessments.filter(({ wallets }) =>
          wallets.includes(gatewayAddress),
        ) ?? [];
      const result: keyof typeof resultOrder =
        loading.has(id) && !report
          ? 'Loading'
          : report === undefined
            ? 'Not loaded'
            : report === null
              ? 'Unavailable'
              : assessments.length === 0
                ? 'Not assessed'
                : assessments.every(({ pass }) => pass)
                  ? 'Passed'
                  : 'Failed';
      const reasons = [
        ...new Set(
          assessments
            .filter(({ pass }) => !pass)
            .flatMap(({ reasons }) => reasons),
        ),
      ];
      const submittedResult =
        failedObservers === undefined
          ? undefined
          : failedObservers.includes(observer)
            ? 'Failed'
            : 'Passed';
      const disagrees =
        submittedResult !== undefined &&
        (result === 'Passed' || result === 'Failed') &&
        result !== submittedResult;
      return {
        observer,
        id,
        observerGateway,
        name,
        result,
        reasons,
        submittedResult,
        disagrees,
      };
    })
    .sort(
      (a, b) =>
        resultOrder[a.result] - resultOrder[b.result] ||
        (a.name ?? a.observer).localeCompare(b.name ?? b.observer, undefined, {
          sensitivity: 'base',
        }) ||
        a.observer.localeCompare(b.observer),
    );
  const counts = {
    Failed: 0,
    Passed: 0,
    'Not assessed': 0,
    Unavailable: 0,
    'Not loaded': 0,
    Loading: 0,
  };
  for (const { result } of entries) counts[result]++;
  const unloadedIds = Object.values(reports).filter((id) => !data[id]);
  const failedIds = (failedObservers ?? [])
    .map((observer) => reports[observer])
    .filter((id) => id && !data[id]);
  return (
    <>
      {captureShortfall && (
        <div className="px-6 pt-3 text-xs text-low">{captureShortfall}</div>
      )}
      <div className="flex flex-wrap gap-4 px-6 pt-3 text-xs">
        <button
          type="button"
          className="text-link underline disabled:text-low disabled:no-underline"
          disabled={isFetching || failedIds.length === 0}
          onClick={() => loadReports(failedIds)}
          title={
            failedObservers === undefined
              ? 'Submitted results unavailable'
              : undefined
          }
        >
          Load failed reports
        </button>
        <button
          type="button"
          className="text-link underline disabled:text-low disabled:no-underline"
          disabled={isFetching || unloadedIds.length === 0}
          onClick={() => loadReports(unloadedIds)}
        >
          Load all reports
        </button>
      </div>
      <div className="px-6 py-3 text-xs text-low">
        Report results:{' '}
        <span className="text-red-500">{counts.Failed} failed</span>,{' '}
        <span className="text-green-500">{counts.Passed} passed</span>
        {counts['Not assessed'] > 0 &&
          `, ${counts['Not assessed']} not assessed`}
        {counts.Unavailable > 0 && `, ${counts.Unavailable} unavailable`}
        {counts['Not loaded'] > 0 && `, ${counts['Not loaded']} not loaded`}
        {counts.Loading > 0 && `, ${counts.Loading} loading`} of{' '}
        {entries.length} submissions.
        {Object.values(data ?? {}).some((report) => report === null) && (
          <button
            type="button"
            className="ml-2 underline"
            disabled={isFetching}
            onClick={() =>
              loadReports(Object.keys(data).filter((id) => data[id] === null))
            }
          >
            {isFetching ? 'Loading...' : 'Retry'}
          </button>
        )}
      </div>
      {entries.map(
        ({
          observer,
          id,
          observerGateway,
          name,
          result,
          reasons,
          submittedResult,
          disagrees,
        }) => (
          <div
            key={observer}
            className="flex flex-wrap items-center gap-2 border-t border-grey-500 px-6 py-3 text-xs"
          >
            {observerGateway ? (
              <Link
                className="min-w-0 grow basis-40 break-all text-low"
                to={`/gateways/${observerGateway}`}
              >
                {name && (
                  <span className="block break-words text-mid">{name}</span>
                )}
                <span className="block">{observer}</span>
              </Link>
            ) : (
              <span className="min-w-0 grow basis-40 break-all text-low">
                {observer}
              </span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <div className="text-right leading-5">
                <div
                  className={
                    result === 'Failed'
                      ? 'text-red-500'
                      : result === 'Passed'
                        ? 'text-green-500'
                        : 'text-low'
                  }
                >
                  {result === 'Not loaded' ? (
                    <button
                      type="button"
                      className="text-link hover:underline"
                      onClick={() => loadReports([id])}
                    >
                      Load report
                    </button>
                  ) : (
                    result
                  )}
                  {result === 'Unavailable' && (
                    <button
                      type="button"
                      className="ml-2 text-link hover:underline"
                      onClick={() => loadReports([id])}
                    >
                      Retry
                    </button>
                  )}
                </div>
                <div className="whitespace-nowrap text-[11px] text-low">
                  {submittedResult && `Submitted: ${submittedResult}`}
                </div>
              </div>
              <Button
                className="h-8 w-8 last:p-2"
                active={true}
                text={
                  <NotebookText className="size-3 text-mid" strokeWidth={1.5} />
                }
                onClick={() => {
                  if (observerGateway) {
                    navigate(`/gateways/${observerGateway}/reports/${id}`);
                  } else {
                    window.open(
                      arweaveTxUrl(id),
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }
                }}
                title="View Report"
              />
            </div>
            {disagrees && (
              <div className="w-full text-amber-400">
                Submitted result: {submittedResult}. Report: {result}.
              </div>
            )}
            {reasons.length > 0 && (
              <ul className="w-full list-disc pl-4 text-low">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        ),
      )}
    </>
  );
};

export default ObservationReports;
