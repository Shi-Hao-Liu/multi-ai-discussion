/**
 * Property-based tests for Moderator
 */

import * as fc from 'fast-check';
import { Moderator } from '../../src/debate/moderator';
import { AIBuilderClient, ChatResponse, Message } from '../../src/debate/client';
import { DebateRound, AgentResponse } from '../../src/debate/session';

// **Feature: multi-model-debate, Property 7: Convergence confidence score is bounded**
describe('Moderator Property Tests', () => {
  
  // Mock fetch for testing
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('Property 7: Convergence confidence score is bounded', async () => {
    // **Validates: Requirements 4.4**
    
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1 }), // topic
      fc.double({ min: -10, max: 10, noNaN: true }), // arbitrary confidence score (can be out of bounds)
      fc.double({ min: 0, max: 1, noNaN: true }), // threshold
      fc.boolean(), // isConverged
      fc.string({ minLength: 1 }), // reasoning
      fc.array(
        fc.record({
          roundNumber: fc.integer({ min: 1, max: 10 }),
          responses: fc.array(
            fc.record({
              model: fc.constantFrom('deepseek', 'gpt-5', 'gemini-2.5-pro'),
              content: fc.string({ minLength: 1 }),
              timestamp: fc.constant(new Date()),
              error: fc.option(fc.string())
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        { minLength: 1, maxLength: 3 }
      ), // rounds
      
      async (topic, rawConfidenceScore, threshold, isConverged, reasoning, rounds) => {
        const client = new AIBuilderClient('test-token');
        const moderator = new Moderator(client, 'deepseek');
        
        // Mock response with potentially out-of-bounds confidence score
        const mockResponse: ChatResponse = {
          id: 'test-id',
          choices: [{
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isConverged,
                confidenceScore: rawConfidenceScore, // This might be out of bounds
                reasoning
              })
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        };
        
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });
        
        const debateRounds: DebateRound[] = rounds.map(round => ({
          ...round,
          responses: round.responses.map(response => ({
            ...response,
            timestamp: new Date()
          } as AgentResponse))
        }));
        
        const assessment = await moderator.evaluateConvergence(topic, debateRounds, threshold);
        
        // Property: Confidence score must always be bounded between 0 and 1, regardless of input
        expect(assessment.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(assessment.confidenceScore).toBeLessThanOrEqual(1);
        expect(typeof assessment.confidenceScore).toBe('number');
        expect(Number.isFinite(assessment.confidenceScore)).toBe(true);
      }
    ), { numRuns: 100 });
  });

  test('Property: Moderator handles empty rounds gracefully', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1 }), // topic
      fc.double({ min: 0, max: 1, noNaN: true }), // threshold
      
      async (topic, threshold) => {
        const client = new AIBuilderClient('test-token');
        const moderator = new Moderator(client, 'deepseek');
        
        const assessment = await moderator.evaluateConvergence(topic, [], threshold);
        
        // Property: Empty rounds should return valid assessment
        expect(assessment.isConverged).toBe(false);
        expect(assessment.confidenceScore).toBe(0);
        expect(typeof assessment.reasoning).toBe('string');
        expect(assessment.reasoning.length).toBeGreaterThan(0);
      }
    ), { numRuns: 50 });
  });

  test('Property: Moderator handles API failures gracefully', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1 }), // topic
      fc.double({ min: 0, max: 1, noNaN: true }), // threshold
      fc.array(
        fc.record({
          roundNumber: fc.integer({ min: 1, max: 10 }),
          responses: fc.array(
            fc.record({
              model: fc.constantFrom('deepseek', 'gpt-5', 'gemini-2.5-pro'),
              content: fc.string({ minLength: 1 }),
              timestamp: fc.constant(new Date())
            }),
            { minLength: 1, maxLength: 3 }
          )
        }),
        { minLength: 1, maxLength: 2 }
      ), // rounds
      
      async (topic, threshold, rounds) => {
        const client = new AIBuilderClient('test-token');
        const moderator = new Moderator(client, 'deepseek');
        
        // Mock API failure
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API failure'));
        
        const debateRounds: DebateRound[] = rounds.map(round => ({
          ...round,
          responses: round.responses.map(response => ({
            ...response,
            timestamp: new Date()
          } as AgentResponse))
        }));
        
        const assessment = await moderator.evaluateConvergence(topic, debateRounds, threshold);
        
        // Property: API failures should return valid fallback assessment
        expect(assessment.isConverged).toBe(false);
        expect(assessment.confidenceScore).toBe(0);
        expect(typeof assessment.reasoning).toBe('string');
        expect(assessment.reasoning).toContain('failed');
      }
    ), { numRuns: 50 });
  });
});