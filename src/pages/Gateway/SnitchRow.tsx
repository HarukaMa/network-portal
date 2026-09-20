import { GatewayWithAddress } from '@ar.io/sdk/web';
import Button from '@src/components/Button';
import Dropdown from '@src/components/Dropdown';
import Placeholder from '@src/components/Placeholder';
import useEpochs from '@src/hooks/useEpochs';
import useObservations from '@src/hooks/useObservations';
import {
  CheckCircleIcon,
  CircleHelpIcon,
  NotebookText,
  XCircleIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ObservationReports from './ObservationReports';

const ReportedOnByCard = ({
  gateway,
}: { gateway?: GatewayWithAddress | null }) => {
  const { data: epochs } = useEpochs();
  const [selectedEpochIndex, setSelectedEpochIndex] = useState(0);
  const selectedEpoch = epochs?.[selectedEpochIndex];
  const { data: observations } = useObservations(selectedEpoch);
  const totalReports = Object.keys(observations?.reports ?? {}).length;
  const failureCount = gateway
    ? (observations?.failureSummaries[gateway.gatewayAddress]?.length ?? 0)
    : 0;
  const hasAttribution =
    observations?.hasGatewayAttribution && !!gateway && totalReports > 0;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-transparent-100-16 text-sm">
      <div className="border-b border-grey-500 bg-containerL3 px-6 py-3 text-xs text-low">
        Observations of this gateway
      </div>
      <div className="flex flex-wrap items-center gap-x-2 border-b border-grey-500 bg-containerL3 pb-3">
        {epochs ? (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2">
              <div className="min-w-0 px-6 py-1">
                {!observations ? (
                  <Placeholder className="h-4 w-40" />
                ) : hasAttribution ? (
                  <div className="text-mid">
                    Failed by{' '}
                    <span className="text-red-500">
                      {failureCount}/{totalReports}
                    </span>{' '}
                    observers
                  </div>
                ) : (
                  <div className="text-mid">
                    {totalReports} report{totalReports === 1 ? '' : 's'}{' '}
                    submitted
                  </div>
                )}
              </div>
              {(selectedEpochIndex !== 0 || gateway?.status !== 'leaving') && (
                <div className="mr-4 flex shrink-0 items-center">
                  {!observations ? (
                    <Placeholder className="h-4 w-16" />
                  ) : !hasAttribution ? (
                    <div className="flex items-center text-low">
                      <CircleHelpIcon className="mr-1 size-4" />
                      <span>Report details</span>
                    </div>
                  ) : failureCount <= totalReports / 2 ? (
                    <div className="flex items-center text-green-500">
                      <CheckCircleIcon className="mr-1 size-4" />
                      <span>
                        {selectedEpochIndex === 0 ? 'Passing' : 'Passed'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-500">
                      <XCircleIcon className="mr-1 size-4" />
                      <span>
                        {selectedEpochIndex === 0 ? 'Failing' : 'Failed'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ml-auto shrink-0 pr-3">
              <Dropdown
                options={epochs.map((epoch, index) => ({
                  label:
                    index === 0 ? 'Current Epoch' : `Epoch ${epoch.epochIndex}`,
                  value: index.toString(),
                }))}
                onChange={(e) => setSelectedEpochIndex(Number(e.target.value))}
                value={selectedEpochIndex.toString()}
              />
            </div>
          </>
        ) : (
          <Placeholder className="m-4 h-4" />
        )}
      </div>
      <div className="h-80 overflow-hidden overflow-y-auto scrollbar scrollbar-thin">
        {observations && gateway && selectedEpoch && (
          <ObservationReports
            reports={observations.reports}
            epochIndex={selectedEpoch.epochIndex}
            gatewayAddress={gateway.gatewayAddress}
          />
        )}
      </div>
    </div>
  );
};

const ReportedOnCard = ({
  gateway,
}: { gateway?: GatewayWithAddress | null }) => {
  const { data: epochs } = useEpochs();
  const [selectedEpochIndex, setSelectedEpochIndex] = useState(0);
  const selectedEpoch = epochs?.[selectedEpochIndex];
  const { data: observations } = useObservations(selectedEpoch);
  const navigate = useNavigate();
  const address = gateway?.observerAddress;
  const reportId = address ? observations?.reports[address] : undefined;
  const selectedForObservation =
    !!reportId ||
    selectedEpoch?.prescribedObservers?.some(
      (observer) => observer.observerAddress === address,
    );
  const reportedOnCount =
    address && observations
      ? (observations.totalsByObserver[address]?.failed ??
        (observations.hasGatewayAttribution
          ? Object.values(observations.failureSummaries).filter((observers) =>
              observers.includes(address),
            ).length
          : undefined))
      : undefined;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-transparent-100-16 text-sm">
      <div className="border-b border-grey-500 bg-containerL3 px-6 py-3 text-xs text-low">
        Observations this gateway made
      </div>
      <div className="flex flex-wrap items-center gap-x-2 border-b border-grey-500 bg-containerL3 pb-3">
        {epochs ? (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2">
              <div className="min-w-0 py-1 pl-6">
                {!observations ? (
                  <Placeholder className="h-4 w-48" />
                ) : reportId ? (
                  <div className="text-mid">
                    Submitted failures for{' '}
                    <span className="text-red-500">
                      {reportedOnCount ?? '-'}
                    </span>{' '}
                    gateways
                  </div>
                ) : (
                  <div className="text-low">
                    {selectedForObservation
                      ? 'No report submitted'
                      : 'Not Selected for Observation'}
                  </div>
                )}
              </div>
              {reportId && (
                <Button
                  className="ml-3 mr-2 h-fit last:p-2"
                  active={true}
                  text={
                    <NotebookText
                      className="size-3 text-mid"
                      strokeWidth={1.5}
                    />
                  }
                  onClick={() =>
                    navigate(
                      `/gateways/${gateway?.gatewayAddress}/reports/${reportId}`,
                    )
                  }
                  title="View Report"
                />
              )}
            </div>
            <div className="ml-auto shrink-0 pr-3">
              <Dropdown
                options={epochs.map((epoch, index) => ({
                  label:
                    index === 0 ? 'Current Epoch' : `Epoch ${epoch.epochIndex}`,
                  value: index.toString(),
                }))}
                onChange={(e) => setSelectedEpochIndex(Number(e.target.value))}
                value={selectedEpochIndex.toString()}
              />
            </div>
          </>
        ) : (
          <Placeholder className="m-4 h-4" />
        )}
      </div>
      <div className="h-80 overflow-hidden overflow-y-auto scrollbar scrollbar-thin">
        {observations && gateway && selectedEpoch && (
          <ObservationReports
            reports={observations.reports}
            epochIndex={selectedEpoch.epochIndex}
            gatewayAddress={gateway.gatewayAddress}
            observerAddress={gateway.observerAddress}
          />
        )}
      </div>
    </div>
  );
};

const SnitchRow = ({ gateway }: { gateway?: GatewayWithAddress | null }) => (
  <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
    <ReportedOnByCard gateway={gateway} />
    <ReportedOnCard gateway={gateway} />
  </div>
);

export default SnitchRow;
