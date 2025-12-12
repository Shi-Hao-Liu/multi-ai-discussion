import * as fc from 'fast-check';
import { RoundManager } from '../../src/debate/round-manager';
import { AIBuilderClient, type ChatRequest, type ChatResponse, type Message } from '../../src/debate/client';
import { DebateSessionManager, type DebateSession, type DebateRound, type AgentResponse } from '../../src/debate/session';
import { AVAILABLE_MODELS } from '../../src/debate/config';

// Mock AIBuilderClient for testing
class MockAIBuilderClient extends AIBuilderClient {
  private capturedMessages: Message[][] = [];

  constructor() {
    super('test-token');
  }

  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    // Capture the messages for verification
    this.capturedMessages.push(request.messages);
    
    return {
      id: 'test-id',
      choices: [{
        message: { role: 'assistant' as const, content: `Response from ${request.model}` },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    };
  }

  getLastCapturedMessages(): Message[] {
    return this.capturedMessages[this.capturedMessages.length - 1] || [];
  }

  getAllCapturedMessages(): Message[][] {
    return this.capturedMessages;
  }

  clearCapturedMessages(): void {
    this.capturedMessages = [];
  }
}

describe('RoundManager Property Tests', () => {

  // **Feature: multi-model-debate, Property 5: Round context includes all previous responses**
  // **Validates: Requirements 3.1, 3.2, 3.3**
  test('Property 5: Round context includes all previous responses', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 3 }), // Valid models
      fc.array(
        fc.record({
          roundNumber: fc.integer({ min: 1, max: 5 }),
          responses: fc.array(
            fc.record({
              model: fc.constantFrom(...AVAILABLE_MODELS),
              content: fc.string().filter(s => s.length > 0),
              timestamp: fc.constant(new Date())
            }),
            { minLength: 1, maxLength: 3 }
          )
        }),
        { minLength: 0, maxLength: 3 }
      ), // Previous rounds
      async (topic, models, previousRounds) => {
        const mockClient = new MockAIBuilderClient();
        const roundManager = new RoundManager(mockClient);
        
        // Create a session with the given topic, models, and previous rounds
        const config = {
          topic,
          models,
          maxRounds: 5,
          convergenceThreshold: 0.8,
          moderatorModel: 'deepseek',
          synthesizerModel: 'deepseek'
        };
        
        const session: DebateSession = {
          ...DebateSessionManager.createSession(config),
          rounds: previousRounds.map((round, index) => ({
            ...round,
            roundNumber: index + 1
          }))
        };

        mockClient.clearCapturedMessages();
        
        // Execute a round
        await roundManager.executeRound(session);
        
        // Get the captured messages from the first model call
        const capturedMessages = mockClient.getLastCapturedMessages();
        
        // Verify the context includes the topic
        const topicMessage = capturedMessages.find(msg => 
          msg.role === 'user' && msg.content.includes(topic)
        );
        expect(topicMessage).toBeDefined();
        
        // If there are previous rounds, verify all previous responses are included
        if (previousRounds.length > 0) {
          for (const round of previousRounds) {
            for (const response of round.responses) {
              // Look for messages that include the agent attribution and content
              const responseMessage = capturedMessages.find(msg => 
                msg.role === 'assistant' && 
                msg.content.includes(`[Agent ${response.model}]`) &&
                msg.content.includes(response.content)
              );
              expect(responseMessage).toBeDefined();
            }
          }
        }
        
        // Verify the structure: system message, topic, previous responses (if any), then prompt
        expect(capturedMessages[0].role).toBe('system');
        expect(capturedMessages[1].role).toBe('user');
        expect(capturedMessages[1].content).toContain(topic);
        
        // Count expected messages: system + topic + (previous responses) + (optional final prompt)
        const expectedMinMessages = 2; // system + topic
        const expectedPreviousResponseMessages = previousRounds.reduce((sum, round) => sum + round.responses.length, 0);
        const expectedMaxMessages = expectedMinMessages + expectedPreviousResponseMessages + (previousRounds.length > 0 ? 1 : 0);
        
        expect(capturedMessages.length).toBeGreaterThanOrEqual(expectedMinMessages);
        expect(capturedMessages.length).toBeLessThanOrEqual(expectedMaxMessages);
      }
    ), { numRuns: 100 });
  });

});