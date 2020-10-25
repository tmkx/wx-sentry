import { User } from './user';

/**
 * @inheritDoc
 */
export interface Session extends SessionContext {
  /** JSDoc */
  update(context?: SessionContext): void;

  /** JSDoc */
  close(status?: SessionStatus): void;

  /** JSDoc */
  toJSON(): {
    init: boolean;
    sid: string;
    did?: string | number;
    timestamp: string;
    started: string;
    duration: number;
    status: SessionStatus;
    errors: number;
    attrs?: {
      release?: string;
      environment?: string;
      ip_address?: string;
    };
  };
}

/**
 * Session Context
 */
export interface SessionContext {
  sid?: string;
  did?: string;
  timestamp?: number;
  started?: number;
  duration?: number;
  status?: SessionStatus;
  release?: string;
  environment?: string;
  ipAddress?: string;
  errors?: number;
  user?: User | null;
}

/**
 * Session Status
 */
export enum SessionStatus {
  /** JSDoc */
  Ok = 'ok',
  /** JSDoc */
  Exited = 'exited',
  /** JSDoc */
  Crashed = 'crashed',
  /** JSDoc */
  Abnormal = 'abnormal',
}
