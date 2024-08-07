import { Input, SearchIcon, ToggleButton, useDesignSystemTheme } from '@databricks/design-system';
import { compact, mapValues, values } from 'lodash';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { ReduxState } from '../../../redux-types';
import type { RunInfoEntity } from '../../types';

import { RunsChartsTooltipWrapper } from '../runs-charts/hooks/useRunsChartsTooltip';
import { RunViewChartTooltipBody } from './RunViewChartTooltipBody';
import { RunsChartType, RunsChartsCardConfig } from '../runs-charts/runs-charts.types';
import type { RunsChartsRunData } from '../runs-charts/components/RunsCharts.common';
import type { ExperimentRunsChartsUIConfiguration } from '../experiment-page/models/ExperimentPageUIState';
import { RunsChartsSectionAccordion } from '../runs-charts/components/sections/RunsChartsSectionAccordion';
import { RunsChartsConfigureModal } from '../runs-charts/components/RunsChartsConfigureModal';
import {
  RunsChartsUIConfigurationContextProvider,
  useConfirmChartCardConfigurationFn,
  useInsertRunsChartsFn,
  useRemoveRunsChartFn,
  useReorderRunsChartsFn,
} from '../runs-charts/hooks/useRunsChartsUIConfiguration';
import { MLFLOW_MODEL_METRIC_NAME, MLFLOW_SYSTEM_METRIC_NAME, MLFLOW_SYSTEM_METRIC_PREFIX } from '../../constants';
import LocalStorageUtils from '../../../common/utils/LocalStorageUtils';
import { RunsChartsFullScreenModal } from '../runs-charts/components/RunsChartsFullScreenModal';
import { useIsTabActive } from '../../../common/hooks/useIsTabActive';
import { shouldEnableImageGridCharts, shouldEnableRunDetailsPageAutoRefresh } from '../../../common/utils/FeatureUtils';
import { usePopulateImagesByRunUuid } from '../experiment-page/hooks/usePopulateImagesByRunUuid';
import { DragAndDropProvider } from '../../../common/hooks/useDragAndDropElement';
import type { UseGetRunQueryResponseRunInfo } from './hooks/useGetRunQuery';

interface RunViewMetricChartsV2Props {
  metricKeys: string[];
  runInfo: RunInfoEntity | UseGetRunQueryResponseRunInfo;
  /**
   * Whether to display model or system metrics. This affects labels and tooltips.
   */
  mode: 'model' | 'system';
}

/**
 * Component displaying metric charts for a single run
 */
export const RunViewMetricChartsV2Impl = ({
  runInfo,
  metricKeys,
  mode,
  chartUIState,
  updateChartsUIState,
}: RunViewMetricChartsV2Props & {
  chartUIState: ExperimentRunsChartsUIConfiguration;
  updateChartsUIState: (
    stateSetter: (state: ExperimentRunsChartsUIConfiguration) => ExperimentRunsChartsUIConfiguration,
  ) => void;
}) => {
  const { theme } = useDesignSystemTheme();
  const [search, setSearch] = useState('');
  const { formatMessage } = useIntl();

  const { compareRunCharts, compareRunSections } = chartUIState;

  const [fullScreenChart, setFullScreenChart] = useState<
    { config: RunsChartsCardConfig; title: string; subtitle: ReactNode } | undefined
  >(undefined);

  const metricsForRun = useSelector(({ entities }: ReduxState) => {
    return mapValues(entities.sampledMetricsByRunUuid[runInfo.runUuid ?? ''], (metricsByRange) => {
      return compact(
        values(metricsByRange)
          .map(({ metricsHistory }) => metricsHistory)
          .flat(),
      );
    });
  });

  const tooltipContextValue = useMemo(() => ({ runInfo, metricsForRun }), [runInfo, metricsForRun]);

  const { paramsByRunUuid, latestMetricsByRunUuid, tagsByRunUuid, imagesByRunUuid } = useSelector(
    (state: ReduxState) => ({
      paramsByRunUuid: state.entities.paramsByRunUuid,
      latestMetricsByRunUuid: state.entities.latestMetricsByRunUuid,
      tagsByRunUuid: state.entities.tagsByRunUuid,
      imagesByRunUuid: state.entities.imagesByRunUuid,
    }),
  );

  const [configuredCardConfig, setConfiguredCardConfig] = useState<RunsChartsCardConfig | null>(null);

  const reorderCharts = useReorderRunsChartsFn();

  const addNewChartCard = (metricSectionId: string) => (type: RunsChartType) =>
    setConfiguredCardConfig(RunsChartsCardConfig.getEmptyChartCardByType(type, false, undefined, metricSectionId));

  const insertCharts = useInsertRunsChartsFn();

  const startEditChart = (chartCard: RunsChartsCardConfig) => setConfiguredCardConfig(chartCard);

  const removeChart = useRemoveRunsChartFn();

  const confirmChartCardConfiguration = useConfirmChartCardConfigurationFn();

  const submitForm = (configuredCard: Partial<RunsChartsCardConfig>) => {
    confirmChartCardConfiguration(configuredCard);

    // Hide the modal
    setConfiguredCardConfig(null);
  };

  // Create a single run data object to be used in charts
  const chartData: RunsChartsRunData[] = useMemo(
    () => [
      {
        displayName: runInfo.runName ?? '',
        metrics: latestMetricsByRunUuid[runInfo.runUuid ?? ''] || {},
        params: paramsByRunUuid[runInfo.runUuid ?? ''] || {},
        tags: tagsByRunUuid[runInfo.runUuid ?? ''] || {},
        images: imagesByRunUuid[runInfo.runUuid ?? ''] || {},
        metricHistory: {},
        uuid: runInfo.runUuid ?? '',
        color: theme.colors.primary,
        runInfo,
      },
    ],
    [runInfo, latestMetricsByRunUuid, paramsByRunUuid, tagsByRunUuid, imagesByRunUuid, theme],
  );

  useEffect(() => {
    if ((!compareRunSections || !compareRunCharts) && chartData.length > 0) {
      const { resultChartSet, resultSectionSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
        runsData: chartData,
        enabledSectionNames: [mode === 'model' ? MLFLOW_MODEL_METRIC_NAME : MLFLOW_SYSTEM_METRIC_NAME],
        // Filter only model or system metrics
        filterMetricNames: (name) => {
          const isSystemMetric = name.startsWith(MLFLOW_SYSTEM_METRIC_PREFIX);
          return mode === 'model' ? !isSystemMetric : isSystemMetric;
        },
      });

      updateChartsUIState((current) => ({
        ...current,
        compareRunCharts: resultChartSet,
        compareRunSections: resultSectionSet,
      }));
    }
  }, [compareRunCharts, compareRunSections, chartData, mode, updateChartsUIState]);

  /**
   * Update charts with the latest metrics if new are found
   */
  useEffect(() => {
    updateChartsUIState((current) => {
      if (!current.compareRunCharts || !current.compareRunSections) {
        return current;
      }
      const { resultChartSet, resultSectionSet, isResultUpdated } = RunsChartsCardConfig.updateChartAndSectionConfigs({
        compareRunCharts: current.compareRunCharts,
        compareRunSections: current.compareRunSections,
        runsData: chartData,
        isAccordionReordered: current.isAccordionReordered,
        // Filter only model or system metrics
        filterMetricNames: (name) => {
          const isSystemMetric = name.startsWith(MLFLOW_SYSTEM_METRIC_PREFIX);
          return mode === 'model' ? !isSystemMetric : isSystemMetric;
        },
      });

      if (!isResultUpdated) {
        return current;
      }
      return {
        ...current,
        compareRunCharts: resultChartSet,
        compareRunSections: resultSectionSet,
      };
    });
  }, [chartData, updateChartsUIState, mode]);

  const isTabActive = useIsTabActive();
  const autoRefreshEnabled = chartUIState.autoRefreshEnabled && shouldEnableRunDetailsPageAutoRefresh() && isTabActive;

  usePopulateImagesByRunUuid({
    runUuids: [runInfo.runUuid ?? ''],
    runUuidsIsActive: [runInfo.status === 'RUNNING'],
    autoRefreshEnabled,
    enabled: shouldEnableImageGridCharts(),
  });

  return (
    <div
      css={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        css={{
          paddingBottom: theme.spacing.md,
          display: 'flex',
          gap: theme.spacing.sm,
          flex: '0 0 auto',
        }}
      >
        <Input
          role="searchbox"
          prefix={<SearchIcon />}
          value={search}
          allowClear
          onChange={(e) => setSearch(e.target.value)}
          placeholder={formatMessage({
            defaultMessage: 'Search metric charts',
            description: 'Run page > Charts tab > Filter metric charts input > placeholder',
          })}
        />
        {shouldEnableRunDetailsPageAutoRefresh() && (
          <ToggleButton
            pressed={chartUIState.autoRefreshEnabled}
            onPressedChange={(pressed) => {
              updateChartsUIState((current) => ({ ...current, autoRefreshEnabled: pressed }));
            }}
          >
            {formatMessage({
              defaultMessage: 'Auto-refresh',
              description: 'Run page > Charts tab > Auto-refresh toggle button',
            })}
          </ToggleButton>
        )}
      </div>
      <div
        css={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        <RunsChartsTooltipWrapper contextData={tooltipContextValue} component={RunViewChartTooltipBody}>
          <DragAndDropProvider>
            <RunsChartsSectionAccordion
              compareRunSections={compareRunSections}
              compareRunCharts={compareRunCharts}
              reorderCharts={reorderCharts}
              insertCharts={insertCharts}
              chartData={chartData}
              startEditChart={startEditChart}
              removeChart={removeChart}
              addNewChartCard={addNewChartCard}
              search={search}
              supportedChartTypes={[RunsChartType.LINE, RunsChartType.BAR, RunsChartType.IMAGE]}
              setFullScreenChart={setFullScreenChart}
              autoRefreshEnabled={autoRefreshEnabled}
              groupBy={null}
            />
          </DragAndDropProvider>
        </RunsChartsTooltipWrapper>
      </div>
      {configuredCardConfig && (
        <RunsChartsConfigureModal
          chartRunData={chartData}
          metricKeyList={metricKeys}
          paramKeyList={[]}
          config={configuredCardConfig}
          onSubmit={submitForm}
          onCancel={() => setConfiguredCardConfig(null)}
          groupBy={null}
          supportedChartTypes={[RunsChartType.LINE, RunsChartType.BAR, RunsChartType.IMAGE]}
        />
      )}
      <RunsChartsFullScreenModal
        fullScreenChart={fullScreenChart}
        onCancel={() => setFullScreenChart(undefined)}
        chartData={chartData}
        tooltipContextValue={tooltipContextValue}
        tooltipComponent={RunViewChartTooltipBody}
        autoRefreshEnabled={autoRefreshEnabled}
        groupBy={null}
      />
    </div>
  );
};

export const RunViewMetricChartsV2 = (props: RunViewMetricChartsV2Props) => {
  const persistenceIdentifier = `${props.runInfo.runUuid}-${props.mode}`;

  const localStore = useMemo(
    () => LocalStorageUtils.getStoreForComponent('RunPage', persistenceIdentifier),
    [persistenceIdentifier],
  );

  const [chartUIState, updateChartsUIState] = useState<ExperimentRunsChartsUIConfiguration>(() => {
    const defaultChartState: ExperimentRunsChartsUIConfiguration = {
      isAccordionReordered: false,
      compareRunCharts: undefined,
      compareRunSections: undefined,
      // Auto-refresh is enabled by default only if the flag is set
      autoRefreshEnabled: shouldEnableRunDetailsPageAutoRefresh(),
    };
    try {
      const persistedChartState = localStore.getItem('chartUIState');

      if (!persistedChartState) {
        return defaultChartState;
      }
      return JSON.parse(persistedChartState);
    } catch {
      return defaultChartState;
    }
  });

  useEffect(() => {
    localStore.setItem('chartUIState', JSON.stringify(chartUIState));
  }, [chartUIState, localStore]);

  return (
    <RunsChartsUIConfigurationContextProvider updateChartsUIState={updateChartsUIState}>
      <RunViewMetricChartsV2Impl {...props} chartUIState={chartUIState} updateChartsUIState={updateChartsUIState} />
    </RunsChartsUIConfigurationContextProvider>
  );
};
