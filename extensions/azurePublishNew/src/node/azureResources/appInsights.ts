// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AZURE_HOSTING_GROUP_NAME } from '../getResources';
import {
  ProvisionMethod,
  ProvisionWorkingSet,
  ResourceDefinition,
  ResourceProvisionService,
} from '../provisionService';

export const appInsightsDefinition: ResourceDefinition = {
  key: 'appInsights',
  description: 'Application Insights allows you to monitor and analyze usage and performance of your bot.',
  text: 'Application Insights',
  tier: 'Pay as you go',
  group: AZURE_HOSTING_GROUP_NAME,
};

const getAppInsightsProvisionMethod = (): ProvisionMethod => {
  return <TConfig>(config: TConfig, workingSet: ProvisionWorkingSet): ProvisionWorkingSet => {
    const provisionResult = { instrumentationKey: '', connectionString: '' };
    return {
      ...workingSet,
      appInsights: provisionResult,
    };
  };
};

export const getAppInsightsProvisionService = (): ResourceProvisionService => {
  return {
    getDependencies: () => ['appRegistration', 'botRegistration'],
    getRecommendationForProject: (project) => 'optional',
    provision: getAppInsightsProvisionMethod(),
  };
};
