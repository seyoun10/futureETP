import type { Translation } from './ko';

export const en: Translation = {
  common: {
    retry: 'Retry',
    loading: 'Loading',
  },
  settings: {
    language: 'Language',
    upDownStyle: 'Up/down colors',
    upDownStyleKR: 'Korean',
    upDownStyleUS: 'US',
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
