/**
 * DebateOrchestrator - Main controller for running debates
 * Coordinates the entire debate flow from session creation to final synthesis
 * Requirements: 4.2, 4.3, 5.3
 */

import { AIBuilderClient } from './client';
import { DebateConfig, validateDebateConfig } from './config';
import { DebateSession, DebateSessionManager, DebateRound, ConvergenceAssessment } from './session';
import { RoundManager } from './round-manager';
import { Moderator } from './moderator';
import { Synthesizer } from './synthesizer';

export interface DebateResult {
  session: DebateSession;
  finalAnswer: string;
  totalRounds: number;
  convergenceAchieved: boolean;
}

export class DebateOrchestrator {
  private client: AIBuilderClient;
  private roundManager: RoundManager;
  private moderator: Moderator;
  private synthesizer: Synthesizer;

  constructor(client: AIBuilderClient) {
    this.client = client;
    this.roundManager = new RoundManager(client);
    // Moderator and Synthesizer will be initialized with specific models from config
    this.moderator = new Moderator(client, 'deepseek'); // Default, will be overridden
    this.synthesizer = new Synthesizer(client, 'deepseek'); // Default, will be overridden
  }

  /**
   * Creates a new debate session with validated configuration
   * @param config - The debate configuration
   * @returns A new DebateSession
   * @throws Error if configuration is invalid
   */
  createSession(config: DebateConfig): DebateSession {
    const validation = validateDebateConfig(config);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Invalid debate configuration: ${errorMessages}`);
    }

    return DebateSessionManager.createSession(config);
  }

  /**
   * Runs a complete debate from start to finish
   * Requirements: 4.2, 4.3, 5.3
   * 
   * @param session - The debate session to run
   * @returns Promise<DebateResult> - Complete debate result with final answer
   */
  async runDebate(session: DebateSession): Promise<DebateResult> {
    // Initialize moderator and synthesizer with models from config
    this.moderator = new Moderator(this.client, session.config.moderatorModel);
    this.synthesizer = new Synthesizer(this.client, session.config.synthesizerModel);

    // Update session status to in_progress
    session.status = 'in_progress';

    let convergenceAchieved = false;
    let finalConvergenceAssessment: ConvergenceAssessment | undefined;

    // Execute rounds until convergence or max rounds (Requirements 4.2, 4.3)
    while (session.rounds.length < session.config.maxRounds && !convergenceAchieved) {
      // Execute the next round
      const round = await this.executeRound(session);
      session.rounds.push(round);

      // Evaluate convergence after the round (Requirement 4.2)
      const convergenceAssessment = await this.moderator.evaluateConvergence(
        session.config.topic,
        session.rounds,
        session.config.convergenceThreshold
      );

      // Store convergence assessment in the round
      round.convergenceCheck = convergenceAssessment;
      finalConvergenceAssessment = convergenceAssessment;

      // Check if convergence is achieved (Requirement 4.2)
      if (convergenceAssessment.isConverged) {
        convergenceAchieved = true;
        session.status = 'converged';
        break;
      }
    }

    // If we exited the loop due to max rounds, update status (Requirement 4.3)
    if (!convergenceAchieved && session.rounds.length >= session.config.maxRounds) {
      session.status = 'max_rounds_reached';
    }

    // Generate final synthesized answer (Requirement 5.3)
    const finalAnswer = await this.synthesizer.synthesize(
      session.config.topic,
      session.rounds
    );

    // Update session with final results
    session.finalAnswer = finalAnswer;
    session.convergenceAssessment = finalConvergenceAssessment;
    session.status = 'completed';

    return {
      session,
      finalAnswer,
      totalRounds: session.rounds.length,
      convergenceAchieved
    };
  }

  /**
   * Executes a single debate round
   * @param session - The current debate session
   * @returns Promise<DebateRound> - The completed round
   */
  private async executeRound(session: DebateSession): Promise<DebateRound> {
    return await this.roundManager.executeRound(session);
  }
}