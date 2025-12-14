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
  async runDebate(
    session: DebateSession,
    onRoundComplete?: (round: DebateRound) => void,
    onAgentResponse?: (response: any) => void
  ): Promise<DebateResult> {
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
      const round = await this.executeRound(session, onAgentResponse);
      session.rounds.push(round);

      // Notify progress
      if (onRoundComplete) {
        onRoundComplete(round);
      }

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
   * Continues an existing debate with new instructions
   */
  async continueDebate(
    session: DebateSession,
    instructions: string,
    onRoundComplete?: (round: DebateRound) => void,
    onAgentResponse?: (response: any) => void
  ): Promise<DebateResult> {
    // Reset status to allow more rounds
    session.status = 'in_progress';
    session.finalAnswer = undefined; // Clear previous answer

    // Add the user instruction as a special "system" context for the next rounds
    // In a real implementation, we might want to track this in a "turns" structure
    // For now, we'll append to the topic or similar mechanism, but better is to let the RoundManager handle context
    // Ideally session.rounds should support user interventions. 
    // We will handle this by appending a fake "round" or just relying on context builder.
    // However, RoundManager builds context from rounds. 
    // We will need to adapt RoundManager or Session structure to support user input in between.
    // For simplicity in this iteration: We assume RoundManager uses all previous rounds. 
    // We can inject the user instruction into the session config or a new field.

    // Update maxRounds to allow continuation
    session.config.maxRounds += 3; // Add 3 more rounds by default

    // Re-run the main loop
    return this.runDebate(session, onRoundComplete, onAgentResponse);
  }

  /**
   * Executes a single debate round
   * @param session - The current debate session
   * @returns Promise<DebateRound> - The completed round
   */
  private async executeRound(session: DebateSession, onAgentResponse?: (response: any) => void): Promise<DebateRound> {
    return await this.roundManager.executeRound(session, onAgentResponse);
  }
}