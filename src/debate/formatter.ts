/**
 * Debate History Formatter
 * Formats debate results for display
 * Requirements: 7.1, 7.2, 7.3
 */

import { DebateResult } from './orchestrator';
import { DebateRound, AgentResponse, ConvergenceAssessment } from './session';

/**
 * Formats a complete debate history for display
 * Requirements: 7.1, 7.2, 7.3
 * 
 * @param result - The complete debate result
 * @returns Formatted string containing the full debate history
 */
export function formatDebateHistory(result: DebateResult): string {
  const { session, finalAnswer, totalRounds, convergenceAchieved } = result;
  const lines: string[] = [];

  // Header with topic and summary
  lines.push('='.repeat(80));
  lines.push(`DEBATE TOPIC: ${session.config.topic}`);
  lines.push('='.repeat(80));
  lines.push(`Total Rounds: ${totalRounds}`);
  lines.push(`Convergence Achieved: ${convergenceAchieved ? 'Yes' : 'No'}`);
  lines.push(`Participating Models: ${session.config.models.join(', ')}`);
  lines.push('');

  // Format each round (Requirements 7.1, 7.2)
  for (const round of session.rounds) {
    lines.push(`--- ROUND ${round.roundNumber} ---`);
    lines.push('');

    // Format agent responses with names and content (Requirement 7.2)
    for (const response of round.responses) {
      lines.push(`[${response.model.toUpperCase()}]`);
      if (response.error) {
        lines.push(`ERROR: ${response.error}`);
      } else {
        lines.push(response.content);
      }
      lines.push(`(Timestamp: ${response.timestamp.toISOString()})`);
      lines.push('');
    }

    // Include convergence assessment if available (Requirement 7.3)
    if (round.convergenceCheck) {
      lines.push('--- CONVERGENCE ASSESSMENT ---');
      lines.push(formatConvergenceAssessment(round.convergenceCheck));
      lines.push('');
    }
  }

  // Include final synthesized answer (Requirement 7.3)
  lines.push('='.repeat(80));
  lines.push('FINAL SYNTHESIZED ANSWER');
  lines.push('='.repeat(80));
  lines.push(finalAnswer);
  lines.push('');

  // Include final convergence assessment if different from last round
  if (session.convergenceAssessment && 
      (!session.rounds.length || 
       session.rounds[session.rounds.length - 1].convergenceCheck !== session.convergenceAssessment)) {
    lines.push('--- FINAL CONVERGENCE ASSESSMENT ---');
    lines.push(formatConvergenceAssessment(session.convergenceAssessment));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats a convergence assessment for display
 * @param assessment - The convergence assessment to format
 * @returns Formatted string
 */
function formatConvergenceAssessment(assessment: ConvergenceAssessment): string {
  const lines: string[] = [];
  lines.push(`Converged: ${assessment.isConverged ? 'Yes' : 'No'}`);
  lines.push(`Confidence Score: ${assessment.confidenceScore.toFixed(2)}`);
  lines.push(`Reasoning: ${assessment.reasoning}`);
  return lines.join('\n');
}