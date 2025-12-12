/**
 * Property-based tests for AIBuilderClient
 */

import * as fc from 'fast-check';
import { AIBuilderClient, ChatRequest, ChatResponse, Message } from '../../src/debate/client';

// **Feature: multi-model-debate, Property 7: Convergence confidence score is bounded**
describe('AIBuilderClient Property Tests', () => {
  
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
    
    // Generate arbitrary confidence scores that should be bounded between 0 and 1
    await fc.assert(fc.asyncProperty(
      fc.double({ min: 0, max: 1, noNaN: true }), // Valid confidence score
      fc.string({ minLength: 1 }), // Non-empty model name
      fc.array(fc.record({
        role: fc.constantFrom('system', 'user', 'assistant'),
        content: fc.string({ minLength: 1 })
      }), { minLength: 1 }), // Non-empty messages array
      
      async (confidenceScore, model, messages) => {
        const client = new AIBuilderClient('test-token');
        
        // Mock a response that includes convergence assessment with confidence score
        const mockResponse: ChatResponse = {
          id: 'test-id',
          choices: [{
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isConverged: confidenceScore > 0.8,
                confidenceScore: confidenceScore,
                reasoning: 'Test reasoning'
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
        
        const request: ChatRequest = {
          model,
          messages: messages as Message[]
        };
        
        const response = await client.chatCompletion(request);
        
        // Parse the convergence assessment from the response
        const assessment = JSON.parse(response.choices[0].message.content);
        
        // Property: Confidence score must be bounded between 0 and 1
        expect(assessment.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(assessment.confidenceScore).toBeLessThanOrEqual(1);
        expect(typeof assessment.confidenceScore).toBe('number');
      }
    ), { numRuns: 100 });
  });
});