// Multi-Model Debate System
// This file will be populated with the main debate orchestration logic
// Exports will be added as components are implemented

export { AIBuilderClient, type ChatRequest, type ChatResponse, type Message } from './client';
export { 
  type DebateConfig, 
  type ValidationError, 
  type ValidationResult,
  type AvailableModel,
  AVAILABLE_MODELS,
  validateDebateConfig,
  createDefaultConfig 
} from './config';
export { 
  DebateSessionManager,
  type DebateSession,
  type DebateRound,
  type AgentResponse,
  type ConvergenceAssessment,
  type DebateStatus
} from './session';
export { RoundManager } from './round-manager';
export { Moderator } from './moderator';
export { Synthesizer } from './synthesizer';
export { DebateOrchestrator, type DebateResult } from './orchestrator';
export { formatDebateHistory } from './formatter';