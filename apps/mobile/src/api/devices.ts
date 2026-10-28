import { deviceSchema } from '@futureetp/shared';
import type { DeviceRegistration } from '@futureetp/shared';
import { apiRequest } from './client';

export const registerDevice = (body: DeviceRegistration) =>
  apiRequest('/devices', deviceSchema, { method: 'PUT', body });
