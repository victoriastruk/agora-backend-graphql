import { Logger } from '@/utils/logger';

export interface AppConfig {
  port: number;
  logger: Logger;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  environment: string;
}

export interface ApiInfoResponse {
  message: string;
  version: string;
  docs: string;
  graphql: string;
  health: string;
}
