/**
 * Unit tests for formatDebateHistory function
 * Requirements: 7.1, 7.2, 7.3
 */

import { formatDebateHistory } from '../../src/debate/formatter';
import { DebateResult } from '../../src/debate/orchestrator';
import { DebateSession, DebateRound, AgentResponse, ConvergenceAssessment } from '../../src/debate/session';
import { DebateConfig } from '../../src/debate/config';

describe('formatDebateHistory', () => {
  it('should format complete debate history with all required elements', () => {
    // Create test data
    const config: DebateConfig = {
      topic: 'What is the best programming language?',
      models: ['deepseek', 'gpt-5'],
      maxRounds: 3,
      convergenceThreshold: 0.8,
      moderatorModel: 'deepseek',
      synthesizerModel: 'deepseek'
    };

    const responses1: AgentResponse[] = [
      {
        model: 'deepseek',
        content: 'I believe Python is the best programming language due to its simplicity and versatility.',
        timestamp: new Date('2024-01-01T10:00:00Z')
      },
      {
        model: 'gpt-5',
        content: 'JavaScript is superior because of its ubiquity in web development.',
        timestamp: new Date('2024-01-01T10:01:00Z')
      }
    ];

    const responses2: AgentResponse[] = [
      {
        model: 'deepseek',
        content: 'While JavaScript is popular, Python\'s readability makes it better for beginners.',
        timestamp: new Date('2024-01-01T10:02:00Z')
      },
      {
        model: 'gpt-5',
        content: 'Both languages have their merits, but JavaScript\'s ecosystem is unmatched.',
        timestamp: new Date('2024-01-01T10:03:00Z')
      }
    ];

    const convergenceAssessment: ConvergenceAssessment = {
      isConverged: true,
      confidenceScore: 0.85,
      reasoning: 'Both agents acknowledge the strengths of both languages and show understanding of each other\'s points.'
    };

    const rounds: DebateRound[] = [
      {
        roundNumber: 1,
        responses: responses1
      },
      {
        roundNumber: 2,
        responses: responses2,
        convergenceCheck: convergenceAssessment
      }
    ];

    const session: DebateSession = {
      id: 'test-session-123',
      config,
      rounds,
      status: 'completed',
      finalAnswer: 'Both Python and JavaScript are excellent programming languages with distinct advantages.',
      convergenceAssessment
    };

    const result: DebateResult = {
      session,
      finalAnswer: 'Both Python and JavaScript are excellent programming languages with distinct advantages.',
      totalRounds: 2,
      convergenceAchieved: true
    };

    // Format the debate history
    const formatted = formatDebateHistory(result);

    // Verify all required elements are present (Requirements 7.1, 7.2, 7.3)
    
    // Topic and summary information
    expect(formatted).toContain('DEBATE TOPIC: What is the best programming language?');
    expect(formatted).toContain('Total Rounds: 2');
    expect(formatted).toContain('Convergence Achieved: Yes');
    expect(formatted).toContain('Participating Models: deepseek, gpt-5');

    // Round information with agent names and content (Requirements 7.1, 7.2)
    expect(formatted).toContain('--- ROUND 1 ---');
    expect(formatted).toContain('--- ROUND 2 ---');
    expect(formatted).toContain('[DEEPSEEK]');
    expect(formatted).toContain('[GPT-5]');
    expect(formatted).toContain('I believe Python is the best programming language');
    expect(formatted).toContain('JavaScript is superior because of its ubiquity');
    expect(formatted).toContain('While JavaScript is popular, Python\'s readability');
    expect(formatted).toContain('Both languages have their merits');

    // Timestamps
    expect(formatted).toContain('2024-01-01T10:00:00.000Z');
    expect(formatted).toContain('2024-01-01T10:01:00.000Z');

    // Convergence assessment (Requirement 7.3)
    expect(formatted).toContain('--- CONVERGENCE ASSESSMENT ---');
    expect(formatted).toContain('Converged: Yes');
    expect(formatted).toContain('Confidence Score: 0.85');
    expect(formatted).toContain('Both agents acknowledge the strengths');

    // Final synthesized answer (Requirement 7.3)
    expect(formatted).toContain('FINAL SYNTHESIZED ANSWER');
    expect(formatted).toContain('Both Python and JavaScript are excellent programming languages');
  });

  it('should handle agent errors in responses', () => {
    const config: DebateConfig = {
      topic: 'Test topic',
      models: ['deepseek'],
      maxRounds: 1,
      convergenceThreshold: 0.8,
      moderatorModel: 'deepseek',
      synthesizerModel: 'deepseek'
    };

    const responses: AgentResponse[] = [
      {
        model: 'deepseek',
        content: '',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        error: 'API timeout error'
      }
    ];

    const rounds: DebateRound[] = [
      {
        roundNumber: 1,
        responses
      }
    ];

    const session: DebateSession = {
      id: 'test-session-456',
      config,
      rounds,
      status: 'completed',
      finalAnswer: 'Unable to generate complete answer due to errors.'
    };

    const result: DebateResult = {
      session,
      finalAnswer: 'Unable to generate complete answer due to errors.',
      totalRounds: 1,
      convergenceAchieved: false
    };

    const formatted = formatDebateHistory(result);

    // Should display error information
    expect(formatted).toContain('ERROR: API timeout error');
    expect(formatted).toContain('Convergence Achieved: No');
  });
});