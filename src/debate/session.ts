import { randomUUID } from 'crypto';
import { DebateConfig } from './config';

export interface DebateRound {
  roundNumber: number;
  responses: AgentResponse[];
  convergenceCheck?: ConvergenceAssessment;
}

export interface AgentResponse {
  model: string;
  content: string;
  timestamp: Date;
  error?: string;
}

export interface ConvergenceAssessment {
  isConverged: boolean;
  confidenceScore: number;  // 0-1
  reasoning: string;
}

export type DebateStatus = 'pending' | 'in_progress' | 'converged' | 'max_rounds_reached' | 'completed';

export interface DebateSession {
  id: string;
  config: DebateConfig;
  rounds: DebateRound[];
  status: DebateStatus;
  finalAnswer?: string;
  convergenceAssessment?: ConvergenceAssessment;
}

export class DebateSessionManager {
  /**
   * Creates a new debate session with unique ID generation
   * @param config - The debate configuration
   * @returns A new DebateSession with unique ID and pending status
   */
  static createSession(config: DebateConfig): DebateSession {
    return {
      id: randomUUID(),
      config,
      rounds: [],
      status: 'pending'
    };
  }
}