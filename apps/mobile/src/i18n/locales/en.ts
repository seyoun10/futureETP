import type { Translation } from './ko';

export const en: Translation = {
  common: {
    retry: 'Retry',
    loading: 'Loading',
    back: 'Back',
  },
  commodities: {
    GC: 'Gold',
    SI: 'Silver',
    CL: 'Crude Oil',
    NG: 'Natural Gas',
  },
  commodity: {
    rotate: 'Rotate screen',
    tabs: {
      disparity: 'Disparity',
      curve: 'Curve',
      contracts: 'Contracts',
      etps: 'ETP',
    },
  },
  etp: {
    detailTitle: 'ETP details',
  },
  settings: {
    title: 'Settings',
    alerts: 'Alerts',
    accessKey: 'Access key',
    dataSources: 'Data sources',
    language: 'Language',
    upDownStyle: 'Up/down colors',
    upDownStyleKR: 'Korean',
    upDownStyleUS: 'US',
  },
  alertSettings: {
    title: 'Alert settings',
  },
  errors: {
    UNAUTHORIZED: 'The access key is missing or invalid.',
    RATE_LIMITED: 'Too many requests. Please try again shortly.',
    VALIDATION_FAILED: 'The input is invalid.',
    NOT_FOUND: 'Data not found.',
    INTERNAL: 'Something went wrong on the server. Please try again shortly.',
    NETWORK: 'Unable to connect to the network.',
    TIMEOUT: 'The server is taking too long. Please try again shortly.',
    SCHEMA_MISMATCH: 'The app and server versions do not match. Please update the app.',
  },
};
