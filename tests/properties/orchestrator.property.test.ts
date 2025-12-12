import * as fc from 'fast-check';
import { DebateOrchestrator } from '../../src/debate/orchestrator';
import { AIBuilderClient } from '../../src/debate/client';
import { AVAILABLE_MODELS } from '../../src/debate/config';

// Mock AIBuilderClient for property testing
class MockAIBuilderClient extends AIBuilderClient {
  private responseCount = 0;
  private forceConvergence: boolean;
  private convergenceAfterRound: number;

  constructor(forceConvergence = false, convergenceAfterRound = 2) {
    super('mock-token'); // Call parent constructor with mock token
    this.forceConvergence = forceConvergence;
    this.convergenceAfterRound = convergenceAfterRound;
  }

  async chatCompletion(request: any): Promise<any> {
    this.responseCount++;
    
    // Mock different responses based on model and request
    if (request.messages.some((m: any) => m.content.includes('convergence') || m.content.includes('moderator'))) {
      // Moderator response - control convergence based on test needs
      const shouldConverge = this.forceConvergence && this.responseCount >= this.convergenceAfterRound;
      return {
        id: `mock-${this.responseCount}`,
        choices: [{
          message: {
            content: JSON.stringify({
              isConverged: shouldConverge,
              confidenceScore: shouldConverge ? 0.9 : 0.3,
              reasoning: shouldConverge ? 'Agents have reached consensus' : 'Agents still have differing perspectives'
            })
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      };
    } else if (request.messages.some((m: any) => m.content.includes('synthesis') || m.content.includes('synthesize'))) {
      // Synthesizer response
      return {
        id: `mock-${this.responseCount}`,
        choices: [{
          message: {
            content: 'This is a synthesized final answer based on the debate.'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 }
      };
    } else {
      // Regular agent response
      return {
        id: `mock-${this.responseCount}`,
        choices: [{
          message: {
            content: `Response from ${request.model}: This is my perspective on the topic.`
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 }
      };
    }
  }
}

describe('DebateOrchestrator Property Tests', () => {
  
  // **Feature: multi-model-debate, Property 6: Max rounds limit is enforced**
  // **Validates: Requirements 4.3, 6.1**
  test('Property 6: Max rounds limit is enforced', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 3 }), // Valid models (keep small for faster tests)
      fc.integer({ min: 1, max: 5 }), // maxRounds between 1 and 5
      fc.float({ min: 0, max: 1 }), // Valid convergenceThreshold
      fc.constantFrom(...AVAILABLE_MODELS), // Valid moderatorModel
      fc.constantFrom(...AVAILABLE_MODELS), // Valid synthesizerModel
      async (topic, models, maxRounds, convergenceThreshold, moderatorModel, synthesizerModel) => {
        const config = {
          topic,
          models,
          maxRounds,
          convergenceThreshold,
          moderatorModel,
          synthesizerModel
        };
        
        const client = new MockAIBuilderClient(false); // Don't force convergence for max rounds test
        const orchestrator = new DebateOrchestrator(client);
        
        // Create and run debate session
        const session = orchestrator.createSession(config);
        const result = await orchestrator.runDebate(session);
        
        // Max rounds limit should be enforced
        expect(result.totalRounds).toBeLessThanOrEqual(maxRounds);
        expect(result.session.rounds.length).toBeLessThanOrEqual(maxRounds);
        
        // If max rounds reached without convergence, status should reflect this
        if (result.totalRounds === maxRounds && !result.convergenceAchieved) {
          expect(result.session.status).toBe('completed');
        }
        
        // Session should always be completed at the end
        expect(result.session.status).toBe('completed');
        
        // Should always have a final answer
        expect(result.finalAnswer).toBeDefined();
        expect(typeof result.finalAnswer).toBe('string');
        expect(result.finalAnswer.length).toBeGreaterThan(0);
      }
    ), { numRuns: 20 }); // Reduced runs for async tests
  });

  // **Feature: multi-model-debate, Property 8: Convergence terminates debate**
  // **Validates: Requirements 4.2**
  test('Property 8: Convergence terminates debate', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 3 }), // Valid models
      fc.integer({ min: 3, max: 10 }), // maxRounds (higher than convergence point)
      fc.float({ min: Math.fround(0.5), max: Math.fround(0.9) }), // Valid convergenceThreshold (not too high)
      fc.constantFrom(...AVAILABLE_MODELS), // Valid moderatorModel
      fc.constantFrom(...AVAILABLE_MODELS), // Valid synthesizerModel
      fc.integer({ min: 1, max: 3 }), // Round at which to force convergence
      async (topic, models, maxRounds, convergenceThreshold, moderatorModel, synthesizerModel, convergenceRound) => {
        const config = {
          topic,
          models,
          maxRounds,
          convergenceThreshold,
          moderatorModel,
          synthesizerModel
        };
        
        // Force convergence after a specific round
        const client = new MockAIBuilderClient(true, convergenceRound);
        const orchestrator = new DebateOrchestrator(client);
        
        // Create and run debate session
        const session = orchestrator.createSession(config);
        const result = await orchestrator.runDebate(session);
        
        // When convergence is achieved, debate should terminate early
        if (result.convergenceAchieved) {
          expect(result.totalRounds).toBeLessThanOrEqual(maxRounds);
          expect(result.session.status).toBe('completed');
          
          // The final round should have a convergence assessment indicating convergence
          const finalRound = result.session.rounds[result.session.rounds.length - 1];
          expect(finalRound.convergenceCheck).toBeDefined();
          expect(finalRound.convergenceCheck!.isConverged).toBe(true);
          expect(finalRound.convergenceCheck!.confidenceScore).toBeGreaterThanOrEqual(convergenceThreshold);
        }
        
        // Should always have a final answer
        expect(result.finalAnswer).toBeDefined();
        expect(typeof result.finalAnswer).toBe('string');
        expect(result.finalAnswer.length).toBeGreaterThan(0);
        
        // Session should always be completed at the end
        expect(result.session.status).toBe('completed');
      }
    ), { numRuns: 15 }); // Reduced runs for async tests
  });

  // **Feature: multi-model-debate, Property 9: Complete result contains all required data**
  // **Validates: Requirements 5.1, 5.3, 7.1, 7.2, 7.3**
  test('Property 9: Complete result contains all required data', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 3 }), // Valid models
      fc.integer({ min: 1, max: 4 }), // maxRounds
      fc.float({ min: 0, max: 1 }), // Valid convergenceThreshold
      fc.constantFrom(...AVAILABLE_MODELS), // Valid moderatorModel
      fc.constantFrom(...AVAILABLE_MODELS), // Valid synthesizerModel
      fc.boolean(), // Whether to force convergence or not
      async (topic, models, maxRounds, convergenceThreshold, moderatorModel, synthesizerModel, forceConvergence) => {
        const config = {
          topic,
          models,
          maxRounds,
          convergenceThreshold,
          moderatorModel,
          synthesizerModel
        };
        
        const client = new MockAIBuilderClient(forceConvergence, 2);
        const orchestrator = new DebateOrchestrator(client);
        
        // Create and run debate session
        const session = orchestrator.createSession(config);
        const result = await orchestrator.runDebate(session);
        
        // (a) All rounds with agent responses (Requirements 7.1, 7.2)
        expect(result.session.rounds).toBeDefined();
        expect(Array.isArray(result.session.rounds)).toBe(true);
        expect(result.session.rounds.length).toBeGreaterThan(0);
        
        // Each round should have responses from agents
        result.session.rounds.forEach((round, index) => {
          expect(round.roundNumber).toBe(index + 1);
          expect(round.responses).toBeDefined();
          expect(Array.isArray(round.responses)).toBe(true);
          expect(round.responses.length).toBeGreaterThan(0);
          
          // Each response should have required fields
          round.responses.forEach(response => {
            expect(response.model).toBeDefined();
            expect(typeof response.model).toBe('string');
            expect(response.content).toBeDefined();
            expect(typeof response.content).toBe('string');
            expect(response.timestamp).toBeDefined();
            expect(response.timestamp instanceof Date).toBe(true);
          });
        });
        
        // (b) The Moderator's convergence assessment (Requirements 7.3)
        expect(result.session.convergenceAssessment).toBeDefined();
        expect(result.session.convergenceAssessment!.isConverged).toBeDefined();
        expect(typeof result.session.convergenceAssessment!.isConverged).toBe('boolean');
        expect(result.session.convergenceAssessment!.confidenceScore).toBeDefined();
        expect(typeof result.session.convergenceAssessment!.confidenceScore).toBe('number');
        expect(result.session.convergenceAssessment!.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(result.session.convergenceAssessment!.confidenceScore).toBeLessThanOrEqual(1);
        expect(result.session.convergenceAssessment!.reasoning).toBeDefined();
        expect(typeof result.session.convergenceAssessment!.reasoning).toBe('string');
        
        // Each round should have convergence check
        result.session.rounds.forEach(round => {
          expect(round.convergenceCheck).toBeDefined();
          expect(round.convergenceCheck!.isConverged).toBeDefined();
          expect(typeof round.convergenceCheck!.isConverged).toBe('boolean');
          expect(round.convergenceCheck!.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(round.convergenceCheck!.confidenceScore).toBeLessThanOrEqual(1);
          expect(typeof round.convergenceCheck!.reasoning).toBe('string');
        });
        
        // (c) The Synthesizer's final answer (Requirements 5.1, 5.3)
        expect(result.finalAnswer).toBeDefined();
        expect(typeof result.finalAnswer).toBe('string');
        expect(result.finalAnswer.length).toBeGreaterThan(0);
        expect(result.session.finalAnswer).toBeDefined();
        expect(result.session.finalAnswer).toBe(result.finalAnswer);
        
        // Additional result completeness checks
        expect(result.totalRounds).toBeDefined();
        expect(typeof result.totalRounds).toBe('number');
        expect(result.totalRounds).toBe(result.session.rounds.length);
        expect(result.convergenceAchieved).toBeDefined();
        expect(typeof result.convergenceAchieved).toBe('boolean');
        
        // Session should be completed
        expect(result.session.status).toBe('completed');
        expect(result.session.id).toBeDefined();
        expect(typeof result.session.id).toBe('string');
        expect(result.session.config).toEqual(config);
      }
    ), { numRuns: 15 }); // Reduced runs for async tests
  });

});