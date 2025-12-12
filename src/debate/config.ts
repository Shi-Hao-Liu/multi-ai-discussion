// DebateConfig interface and validation logic

export interface DebateConfig {
  topic: string;
  models: string[];           // At least 2 models required
  maxRounds: number;          // Default: 5
  convergenceThreshold: number; // Default: 0.8 (0-1)
  moderatorModel: string;     // Model used for moderation
  synthesizerModel: string;   // Model used for synthesis
}

// Available models from AI Builder API
export const AVAILABLE_MODELS = [
  'deepseek',
  'supermind-agent-v1', 
  'gemini-2.5-pro',
  'gpt-5',
  'grok-4-fast'
] as const;

export type AvailableModel = typeof AVAILABLE_MODELS[number];

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates a DebateConfig object according to requirements
 * Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 6.1, 6.2, 6.3
 */
export function validateDebateConfig(config: Partial<DebateConfig>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate topic (Requirements 1.1, 1.3)
  if (config.topic === undefined || config.topic === null) {
    errors.push({ field: 'topic', message: 'Topic is required' });
  } else if (typeof config.topic !== 'string') {
    errors.push({ field: 'topic', message: 'Topic must be a string' });
  } else if (config.topic.trim().length === 0) {
    errors.push({ field: 'topic', message: 'Topic cannot be empty or contain only whitespace' });
  }

  // Validate models array (Requirements 2.1, 2.2, 2.3)
  if (!config.models) {
    errors.push({ field: 'models', message: 'Models array is required' });
  } else if (!Array.isArray(config.models)) {
    errors.push({ field: 'models', message: 'Models must be an array' });
  } else {
    if (config.models.length < 2) {
      errors.push({ field: 'models', message: 'At least 2 models are required for debate' });
    }
    
    // Check for invalid model identifiers
    const invalidModels = config.models.filter(model => !AVAILABLE_MODELS.includes(model as AvailableModel));
    if (invalidModels.length > 0) {
      errors.push({ 
        field: 'models', 
        message: `Invalid model identifiers: ${invalidModels.join(', ')}. Available models: ${AVAILABLE_MODELS.join(', ')}` 
      });
    }
  }

  // Validate maxRounds (Requirements 6.1, 6.3)
  if (config.maxRounds !== undefined) {
    if (typeof config.maxRounds !== 'number') {
      errors.push({ field: 'maxRounds', message: 'maxRounds must be a number' });
    } else if (config.maxRounds <= 0) {
      errors.push({ field: 'maxRounds', message: 'maxRounds must be greater than 0' });
    }
  }

  // Validate convergenceThreshold (Requirements 6.2, 6.3)
  if (config.convergenceThreshold !== undefined) {
    if (typeof config.convergenceThreshold !== 'number') {
      errors.push({ field: 'convergenceThreshold', message: 'convergenceThreshold must be a number' });
    } else if (config.convergenceThreshold < 0 || config.convergenceThreshold > 1) {
      errors.push({ field: 'convergenceThreshold', message: 'convergenceThreshold must be between 0 and 1 inclusive' });
    }
  }

  // Validate moderatorModel
  if (config.moderatorModel && !AVAILABLE_MODELS.includes(config.moderatorModel as AvailableModel)) {
    errors.push({ 
      field: 'moderatorModel', 
      message: `Invalid moderator model: ${config.moderatorModel}. Available models: ${AVAILABLE_MODELS.join(', ')}` 
    });
  }

  // Validate synthesizerModel
  if (config.synthesizerModel && !AVAILABLE_MODELS.includes(config.synthesizerModel as AvailableModel)) {
    errors.push({ 
      field: 'synthesizerModel', 
      message: `Invalid synthesizer model: ${config.synthesizerModel}. Available models: ${AVAILABLE_MODELS.join(', ')}` 
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a default DebateConfig with sensible defaults
 * Uses models that are known to work reliably
 */
export function createDefaultConfig(topic: string, models?: string[]): DebateConfig {
  return {
    topic,
    models: models || ['deepseek', 'supermind-agent-v1'], // Use working models by default
    maxRounds: 5,
    convergenceThreshold: 0.8,
    moderatorModel: 'deepseek',
    synthesizerModel: 'deepseek'
  };
}