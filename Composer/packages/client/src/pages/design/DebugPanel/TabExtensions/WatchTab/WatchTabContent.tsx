// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { v4 as uuidv4 } from 'uuid';
import { ConversationActivityTrafficItem, Activity } from '@botframework-composer/types';
import { IIconProps } from 'office-ui-fabric-react/lib/Icon';
import { CommandBarButton } from 'office-ui-fabric-react/lib/Button';
import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode,
  Selection,
  IObjectWithKey,
  IDetailsRowProps,
  DetailsRow,
  IDetailsListStyles,
  IDetailsRowStyles,
} from 'office-ui-fabric-react/lib/DetailsList';
import formatMessage from 'format-message';
import produce from 'immer';

import { DebugPanelTabHeaderProps } from '../types';
import { rootBotProjectIdSelector, webChatTrafficState } from '../../../../../recoilModel';
import { WatchVariablePicker } from '../../WatchVariableSelector/WatchVariablePicker';
import { getMemoryVariables } from '../../../../../recoilModel/dispatchers/utils/project';
import { WatchDataPayload } from '../../WatchVariableSelector/utils/helpers';

import { WatchTabObjectValue } from './WatchTabObjectValue';

const contentContainer = css`
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
  width: 100%;
`;

const toolbar = css`
  display: flex;
  flex-flow: row nowrap;
  flex-shrink: 0;
  height: 24px;
  padding: 8px 16px;
`;

const content = css`
  display: flex;
  flex-flow: column nowrap;
  height: calc(100% - 40px);
  width: 100%;
`;

const undefinedValue = css`
  font-family: Segoe UI;
  font-size: 12px;
  font-style: italic;
  height: 16px;
  line-height: 16px;
`;

const watchTableStyles: Partial<IDetailsListStyles> = {
  root: {
    height: '100%',
    selectors: {
      '& > div[role="grid"]': {
        height: '100%',
      },
    },
  },
  contentWrapper: {
    overflowY: 'auto' as 'auto',
    // fill remaining space after table header row
    height: 'calc(100% - 60px)',
  },
};

const rowStyles: Partial<IDetailsRowStyles> = {
  cell: { minHeight: 32, padding: '8px 6px' },
  checkCell: {
    height: 32,
    minHeight: 32,
    selectors: {
      '& > div[role="checkbox"]': {
        height: 32,
      },
    },
  },
  root: { minHeight: 32 },
};

const addIcon: IIconProps = {
  iconName: 'Add',
};

const removeIcon: IIconProps = {
  iconName: 'Cancel',
};

const NameColumnKey = 'column1';
const ValueColumnKey = 'column2';
const watchTableColumns: IColumn[] = [
  { key: NameColumnKey, name: 'Name', fieldName: 'name', minWidth: 100, maxWidth: 200, isResizable: true },
  { key: ValueColumnKey, name: 'Value', fieldName: 'value', minWidth: 100, maxWidth: 360, isResizable: true },
];

const watchTableLayout: DetailsListLayoutMode = DetailsListLayoutMode.fixedColumns;

// this can be exported and used in other places
const getValueFromBotTraceScope = (delimitedProperty: string, botTrace: Activity) => {
  const propertySegments = delimitedProperty.split('.');
  const value = propertySegments.reduce(
    (accumulator: object | string | number | boolean | undefined, segment, index) => {
      // first try to grab the specified property off the root of the bot trace's memory
      if (index === 0) {
        return botTrace?.value[segment];
      }
      // if we are not on the root, try accessing the next value of the desired property
      if (typeof accumulator === 'object') {
        return accumulator[segment];
      } else {
        return undefined;
      }
    },
    undefined
  );
  return value;
};

export const WatchTabContent: React.FC<DebugPanelTabHeaderProps> = ({ isActive }) => {
  const currentProjectId = useRecoilValue(rootBotProjectIdSelector);
  const rawWebChatTraffic = useRecoilValue(webChatTrafficState(currentProjectId ?? ''));
  const [watchedVars, setWatchedVars] = useState<Record<string, string>>({});
  const [selectedVars, setSelectedVars] = useState<IObjectWithKey[]>();
  const [memoryVariablesPayload, setMemoryVariablesPayload] = useState<WatchDataPayload>({
    kind: 'property',
    data: { properties: [] },
  });

  const watchedVarsSelection = useMemo(
    () =>
      new Selection({
        onSelectionChanged: () => {
          setSelectedVars(watchedVarsSelection.getSelection());
        },
        selectionMode: SelectionMode.multiple,
      }),
    []
  );

  // get memory scope variables for the bot
  useEffect(() => {
    if (currentProjectId) {
      const abortController = new AbortController();
      (async () => {
        try {
          const variables = await getMemoryVariables(currentProjectId, { signal: abortController.signal });
          setMemoryVariablesPayload({ kind: 'property', data: { properties: variables } });
        } catch (e) {
          // error can be due to abort
        }
      })();
    }
  }, [currentProjectId]);

  const mostRecentBotState = useMemo(() => {
    const botStateTraffic = rawWebChatTraffic.filter(
      (t) => t.trafficType === 'activity' && t.activity.type === 'trace' && t.activity.name === 'BotState'
    ) as ConversationActivityTrafficItem[];
    if (botStateTraffic.length) {
      return botStateTraffic[botStateTraffic.length - 1];
    }
  }, [rawWebChatTraffic]);

  const onSelectPath = useCallback(
    (variableId: string, path: string) => {
      // TODO: if the variable path is already being watched, no-op
      setWatchedVars({
        ...watchedVars,
        [variableId]: path,
      });
    },
    [watchedVars]
  );

  // we need to refresh the details list every time a new bot state comes in
  const refreshedWatchedVars = useMemo(() => {
    return Object.entries(watchedVars).map(([key, value]) => {
      return {
        key,
        value,
      };
    });
  }, [mostRecentBotState, watchedVars]);

  const renderRow = useCallback((props?: IDetailsRowProps) => {
    if (props) {
      return <DetailsRow {...props} styles={rowStyles} />;
    }
    return null;
  }, []);

  const renderColumn = useCallback(
    (item: { key: string; value: string }, index: number | undefined, column: IColumn | undefined) => {
      if (column && index !== undefined) {
        if (column.key === NameColumnKey) {
          // render picker
          return (
            <WatchVariablePicker
              key={item.key}
              path={item.value}
              payload={memoryVariablesPayload}
              variableId={item.key}
              onSelectPath={onSelectPath}
            />
          );
        } else if (column.key === ValueColumnKey) {
          // render the value display
          if (mostRecentBotState) {
            const value = getValueFromBotTraceScope(item.value, mostRecentBotState?.activity);
            if (value !== null && typeof value === 'object') {
              // render monaco view
              return <WatchTabObjectValue value={value} />;
            } else if (value === undefined) {
              // render undefined indicator
              return <span css={undefinedValue}>undefined</span>;
            } else {
              // render primitive view
              return <span>{String(value)}</span>;
            }
          } else {
            // no bot trace available;
            // render undefined indicator
            return <span css={undefinedValue}>undefined</span>;
          }
        }
      }
      return null;
    },
    [mostRecentBotState, memoryVariablesPayload, watchedVars]
  );

  const onClickAdd = useCallback(() => {
    setWatchedVars({
      ...watchedVars,
      [uuidv4()]: '',
    });
  }, [watchedVars]);

  const onClickRemove = () => {
    const updated = produce(watchedVars, (draftState) => {
      if (selectedVars?.length) {
        selectedVars.map((item: IObjectWithKey) => {
          delete draftState[item.key as string];
        });
      }
    });
    setWatchedVars(updated);
  };

  if (isActive) {
    return (
      <div css={contentContainer}>
        <div css={toolbar}>
          <CommandBarButton iconProps={addIcon} text={formatMessage('Add property')} onClick={onClickAdd} />
          <CommandBarButton iconProps={removeIcon} text={formatMessage('Remove from list')} onClick={onClickRemove} />
        </div>
        <div css={content}>
          <DetailsList
            columns={watchTableColumns}
            items={refreshedWatchedVars}
            layoutMode={watchTableLayout}
            selection={watchedVarsSelection}
            selectionMode={SelectionMode.multiple}
            styles={watchTableStyles}
            onRenderItemColumn={renderColumn}
            onRenderRow={renderRow}
          />
        </div>
      </div>
    );
  } else {
    return null;
  }
};