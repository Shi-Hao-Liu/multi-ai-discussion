import * as fc from 'fast-check';
import { DebateSessionManager } from '../../src/debate/session';
import { AVAILABLE_MODELS } from '../../src/debate/config';

describe('DebateSession Property Tests', () => {
  
  // **Feature: multi-model-debate, Property 1: Session creation produces unique IDs**
  // **Validates: Requirements 1.1, 1.2**
  test('Property 1: Session creation produces unique IDs', () => {
    fc.assert(fc.property(
      fc.string().filter(s => s.trim().length > 0), // Valid non-empty, non-whitespace topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 5 }), // Valid models
      fc.integer({ min: 1, max: 10 }), // Valid maxRounds
      fc.float({ min: 0, max: 1 }), // Valid convergenceThreshold
      fc.constantFrom(...AVAILABLE_MODELS), // Valid moderatorModel
      fc.constantFrom(...AVAILABLE_MODELS), // Valid synthesizerModel
      (topic, models, maxRounds, convergenceThreshold, moderatorModel, synthesizerModel) => {
        const config = {
          topic,
          models,
          maxRounds,
          convergenceThreshold,
          moderatorModel,
          synthesizerModel
        };
        
        // Create multiple sessions with the same config
        const sessions = Array.from({ length: 10 }, () => 
          DebateSessionManager.createSession(config)
        );
        
        // Extract all session IDs
        const sessionIds = sessions.map(session => session.id);
        
        // All IDs should be unique
        const uniqueIds = new Set(sessionIds);
        expect(uniqueIds.size).toBe(sessionIds.length);
        
        // Each session should have the correct initial state
        sessions.forEach(session => {
          expect(session.id).toBeDefined();
          expect(typeof session.id).toBe('string');
          expect(session.id.length).toBeGreaterThan(0);
          expect(session.config).toEqual(config);
          expect(session.rounds).toEqual([]);
          expect(session.status).toBe('pending');
          expect(session.finalAnswer).toBeUndefined();
          expect(session.convergenceAssessment).toBeUndefined();
        });
      }
    ), { numRuns: 100 });
  });

});