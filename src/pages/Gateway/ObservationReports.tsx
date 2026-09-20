import Button from '@src/components/Button';
import useGateways from '@src/hooks/useGateways';
import useObservationReports from '@src/hooks/useObservationReports';
import useObserverToGatewayMap from '@src/hooks/useObserverToGatewayMap';
import { arweaveTxUrl } from '@src/utils/arweaveUrl';
import { NotebookText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const resultOrder = {
  Failed: 0,
  Unavailable: 2,
  'Not assessed': 3,
  Passed: 4,
};

const ObservationReports = ({
  reports,
  epochIndex,
  gatewayAddress,
  observerAddress,
}: {
  reports: Record<string, string>;
  epochIndex: number;
  gatewayAddress: string;
  observerAddress?: string;
}) => {
  const selectedReportId =
    observerAddress === undefined ? undefined : reports[observerAddress];
  const requestedReports =
    observerAddress !== undefined
      ? selectedReportId
        ? { [observerAddress]: selectedReportId }
        : {}
      : reports;
  const { data, isFetching, refetch } = useObservationReports(
    requestedReports,
    epochIndex,
  );
  const observerToGatewayMap = useObserverToGatewayMap();
  const { data: gateways } = useGateways();
  const navigate = useNavigate();

  if (observerAddress !== undefined && !reports[observerAddress]) {
    return (
      <div className="p-6 text-xs text-low">
        No report submitted for this epoch.
      </div>
    );
  }
  if (Object.keys(reports).length === 0) {
    return (
      <div className="p-6 text-xs text-low">
        No reports submitted for this epoch.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-xs text-low">Loading report details...</div>
    );
  }

  if (observerAddress !== undefined) {
    const id = reports[observerAddress];
    const report = data?.[id];
    if (!report) {
      return (
        <div className="p-6 text-xs text-low">
          Report details unavailable.{' '}
          <button
            type="button"
            className="underline"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? 'Loading...' : 'Retry'}
          </button>{' '}
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
        {assessments.map(({ host, wallets, pass }) => (
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
      const result: keyof typeof resultOrder = !report
        ? 'Unavailable'
        : assessments.length === 0
          ? 'Not assessed'
          : assessments.every(({ pass }) => pass)
            ? 'Passed'
            : 'Failed';
      return { observer, id, observerGateway, name, result };
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
  };
  for (const { result } of entries) counts[result]++;
  return (
    <>
      <div className="px-6 py-3 text-xs text-low">
        Report results:{' '}
        <span className="text-red-500">{counts.Failed} failed</span>,{' '}
        <span className="text-green-500">{counts.Passed} passed</span>
        {counts['Not assessed'] > 0 &&
          `, ${counts['Not assessed']} not assessed`}
        {counts.Unavailable > 0 && `, ${counts.Unavailable} unavailable`} of{' '}
        {entries.length} submissions.
        {Object.values(data ?? {}).some((report) => report === null) && (
          <button
            type="button"
            className="ml-2 underline"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? 'Loading...' : 'Retry'}
          </button>
        )}
      </div>
      {entries.map(({ observer, id, observerGateway, name, result }) => (
        <div
          key={observer}
          className="flex flex-wrap items-center gap-2 border-t border-grey-500 px-6 py-3 text-xs"
        >
          {observerGateway ? (
            <Link
              className="min-w-0 grow break-all text-low"
              to={`/gateways/${observerGateway}`}
            >
              {name && (
                <span className="block break-words text-mid">{name}</span>
              )}
              <span className="block">{observer}</span>
            </Link>
          ) : (
            <span className="min-w-0 grow break-all text-low">{observer}</span>
          )}
          <div className="shrink-0 text-right">
            <div
              className={
                result === 'Failed'
                  ? 'text-red-500'
                  : result === 'Passed'
                    ? 'text-green-500'
                    : 'text-low'
              }
            >
              {result}
            </div>
          </div>
          <Button
            className="h-fit last:p-2"
            active={true}
            text={
              <NotebookText className="size-3 text-mid" strokeWidth={1.5} />
            }
            onClick={() => {
              if (observerGateway) {
                navigate(`/gateways/${observerGateway}/reports/${id}`);
              } else {
                window.open(arweaveTxUrl(id), '_blank', 'noopener,noreferrer');
              }
            }}
            title="View Report"
          />
        </div>
      ))}
    </>
  );
};

export default ObservationReports;
