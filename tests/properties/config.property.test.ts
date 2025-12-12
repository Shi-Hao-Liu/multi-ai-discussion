import * as fc from 'fast-check';
import { validateDebateConfig, AVAILABLE_MODELS } from '../../src/debate/config';

describe('DebateConfig Property Tests', () => {
  
  // **Feature: multi-model-debate, Property 2: Whitespace-only topics are rejected**
  // **Validates: Requirements 1.3**
  test('Property 2: Whitespace-only topics are rejected', () => {
    fc.assert(fc.property(
      fc.string().filter(s => s.trim().length === 0), // Generate whitespace-only strings
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 5 }),
      (whitespaceOnlyTopic, models) => {
        const config = {
          topic: whitespaceOnlyTopic,
          models,
          maxRounds: 5,
          convergenceThreshold: 0.8,
          moderatorModel: 'deepseek',
          synthesizerModel: 'deepseek'
        };
        
        const result = validateDebateConfig(config);
        
        // Should be invalid due to whitespace-only topic
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'topic' && 
          error.message.includes('whitespace')
        )).toBe(true);
      }
    ), { numRuns: 100 });
  });

  // **Feature: multi-model-debate, Property 3: Invalid configurations are rejected**
  // **Validates: Requirements 2.2, 2.3**
  test('Property 3: Invalid configurations are rejected', () => {
    // Test with fewer than 2 models
    fc.assert(fc.property(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.oneof(
        fc.constant([]), // Empty array
        fc.array(fc.constantFrom(...AVAILABLE_MODELS), { maxLength: 1 }) // Single model
      ),
      (validTopic, invalidModels) => {
        const config = {
          topic: validTopic,
          models: [...invalidModels], // Convert to mutable array
          maxRounds: 5,
          convergenceThreshold: 0.8,
          moderatorModel: 'deepseek',
          synthesizerModel: 'deepseek'
        };
        
        const result = validateDebateConfig(config);
        
        // Should be invalid due to insufficient models
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'models' && 
          error.message.includes('At least 2 models')
        )).toBe(true);
      }
    ), { numRuns: 100 });

    // Test with invalid model identifiers
    fc.assert(fc.property(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.string().filter(s => !AVAILABLE_MODELS.includes(s as any)), { minLength: 2, maxLength: 5 }),
      (validTopic, invalidModels) => {
        const config = {
          topic: validTopic,
          models: invalidModels,
          maxRounds: 5,
          convergenceThreshold: 0.8,
          moderatorModel: 'deepseek',
          synthesizerModel: 'deepseek'
        };
        
        const result = validateDebateConfig(config);
        
        // Should be invalid due to invalid model identifiers
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'models' && 
          error.message.includes('Invalid model identifiers')
        )).toBe(true);
      }
    ), { numRuns: 100 });
  });

  // **Feature: multi-model-debate, Property 4: Valid model configurations are accepted**
  // **Validates: Requirements 2.1**
  test('Property 4: Valid model configurations are accepted', () => {
    fc.assert(fc.property(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 5 }), // Valid models
      fc.integer({ min: 1, max: 10 }), // Valid maxRounds
      fc.float({ min: 0, max: 1 }), // Valid convergenceThreshold
      fc.constantFrom(...AVAILABLE_MODELS), // Valid moderatorModel
      fc.constantFrom(...AVAILABLE_MODELS), // Valid synthesizerModel
      (validTopic, validModels, maxRounds, convergenceThreshold, moderatorModel, synthesizerModel) => {
        const config = {
          topic: validTopic,
          models: validModels,
          maxRounds,
          convergenceThreshold,
          moderatorModel,
          synthesizerModel
        };
        
        const result = validateDebateConfig(config);
        
        // Should be valid with all valid parameters
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    ), { numRuns: 100 });
  });

  // **Feature: multi-model-debate, Property 10: Configuration parameter validation**
  // **Validates: Requirements 6.3**
  test('Property 10: Configuration parameter validation', () => {
    // Test invalid maxRounds (<=0)
    fc.assert(fc.property(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 5 }), // Valid models
      fc.integer({ max: 0 }), // Invalid maxRounds (<=0)
      (validTopic, validModels, invalidMaxRounds) => {
        const config = {
          topic: validTopic,
          models: validModels,
          maxRounds: invalidMaxRounds,
          convergenceThreshold: 0.8,
          moderatorModel: 'deepseek',
          synthesizerModel: 'deepseek'
        };
        
        const result = validateDebateConfig(config);
        
        // Should be invalid due to invalid maxRounds
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'maxRounds' && 
          error.message.includes('greater than 0')
        )).toBe(true);
      }
    ), { numRuns: 100 });

    // Test invalid convergenceThreshold (outside [0,1])
    fc.assert(fc.property(
      fc.string().filter(s => s.trim().length > 0), // Valid topic
      fc.array(fc.constantFrom(...AVAILABLE_MODELS), { minLength: 2, maxLength: 5 }), // Valid models
      fc.oneof(
        fc.float({ max: Math.fround(-0.1) }).filter(n => !isNaN(n)), // Below 0, exclude NaN
        fc.float({ min: Math.fround(1.1) }).filter(n => !isNaN(n))   // Above 1, exclude NaN
      ),
      (validTopic, validModels, invalidThreshold) => {
        const config = {
          topic: validTopic,
          models: validModels,
          maxRounds: 5,
          convergenceThreshold: invalidThreshold,
          moderatorModel: 'deepseek',
          synthesizerModel: 'deepseek'
        };
        
        const result = validateDebateConfig(config);
        
        // Should be invalid due to invalid convergenceThreshold
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => 
          error.field === 'convergenceThreshold' && 
          error.message.includes('between 0 and 1')
        )).toBe(true);
      }
    ), { numRuns: 100 });
  });

});