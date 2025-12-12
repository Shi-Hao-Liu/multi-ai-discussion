#!/usr/bin/env node

/**
 * Main entry point for the Multi-Model Debate System
 * Implements CLI interface for running debates
 * Requirements: All
 */

import { 
  AIBuilderClient, 
  DebateOrchestrator, 
  createDefaultConfig, 
  formatDebateHistory,
  AVAILABLE_MODELS 
} from './debate';

/**
 * CLI Configuration interface
 */
interface CLIConfig {
  topic?: string;
  models?: string[];
  maxRounds?: number;
  convergenceThreshold?: number;
  moderatorModel?: string;
  synthesizerModel?: string;
  help?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArguments(): CLIConfig {
  const args = process.argv.slice(2);
  const config: CLIConfig = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        config.help = true;
        break;
      case '--topic':
      case '-t':
        config.topic = args[++i];
        break;
      case '--models':
      case '-m':
        config.models = args[++i]?.split(',').map(m => m.trim());
        break;
      case '--max-rounds':
      case '-r':
        config.maxRounds = parseInt(args[++i]);
        break;
      case '--convergence-threshold':
      case '-c':
        config.convergenceThreshold = parseFloat(args[++i]);
        break;
      case '--moderator-model':
        config.moderatorModel = args[++i];
        break;
      case '--synthesizer-model':
        config.synthesizerModel = args[++i];
        break;
      default:
        // If no flag is provided, treat as topic
        if (!arg.startsWith('-') && !config.topic) {
          config.topic = arg;
        }
        break;
    }
  }

  return config;
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
Multi-Model Debate System

USAGE:
  npm run dev [OPTIONS] [TOPIC]
  node dist/main.js [OPTIONS] [TOPIC]

OPTIONS:
  -t, --topic <topic>                    Debate topic (required)
  -m, --models <model1,model2,...>       Comma-separated list of models (default: deepseek,supermind-agent-v1)
  -r, --max-rounds <number>              Maximum number of rounds (default: 5)
  -c, --convergence-threshold <number>   Convergence threshold 0-1 (default: 0.8)
  --moderator-model <model>              Model for moderation (default: deepseek)
  --synthesizer-model <model>            Model for synthesis (default: deepseek)
  -h, --help                             Show this help message

AVAILABLE MODELS:
  ${AVAILABLE_MODELS.join(', ')}

EXAMPLES:
  npm run dev "What is the best programming language?"
  npm run dev --topic "Climate change solutions" --models "deepseek,gemini-2.5-pro,gpt-5"
  npm run dev -t "AI ethics" -m "deepseek,supermind-agent-v1" -r 3 -c 0.7

ENVIRONMENT:
  AI_BUILDER_TOKEN    Required: Your AI Builder API token
`);
}

/**
 * Validate environment and configuration
 */
function validateEnvironment(): string {
  const token = process.env.AI_BUILDER_TOKEN;
  if (!token) {
    console.error('Error: AI_BUILDER_TOKEN environment variable is required');
    console.error('Please set your AI Builder API token:');
    console.error('  export AI_BUILDER_TOKEN="your-token-here"');
    process.exit(1);
  }
  return token;
}

/**
 * Create debate configuration from CLI arguments
 */
function createDebateConfig(cliConfig: CLIConfig): any {
  // Use defaults if not provided
  const topic = cliConfig.topic || 'What are the key considerations for building scalable software systems?';
  const models = cliConfig.models || ['deepseek', 'supermind-agent-v1'];
  const maxRounds = cliConfig.maxRounds || 5;
  const convergenceThreshold = cliConfig.convergenceThreshold || 0.8;
  const moderatorModel = cliConfig.moderatorModel || 'deepseek';
  const synthesizerModel = cliConfig.synthesizerModel || 'deepseek';

  return createDefaultConfig(topic, models);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const cliConfig = parseArguments();

    // Show help if requested
    if (cliConfig.help) {
      displayHelp();
      return;
    }

    // Validate environment
    const token = validateEnvironment();

    // Create debate configuration
    const config = createDebateConfig(cliConfig);
    
    // Override defaults with CLI values if provided
    if (cliConfig.maxRounds !== undefined) config.maxRounds = cliConfig.maxRounds;
    if (cliConfig.convergenceThreshold !== undefined) config.convergenceThreshold = cliConfig.convergenceThreshold;
    if (cliConfig.moderatorModel) config.moderatorModel = cliConfig.moderatorModel;
    if (cliConfig.synthesizerModel) config.synthesizerModel = cliConfig.synthesizerModel;

    console.log('🚀 Starting Multi-Model Debate System...\n');
    console.log(`Topic: ${config.topic}`);
    console.log(`Models: ${config.models.join(', ')}`);
    console.log(`Max Rounds: ${config.maxRounds}`);
    console.log(`Convergence Threshold: ${config.convergenceThreshold}`);
    console.log(`Moderator: ${config.moderatorModel}`);
    console.log(`Synthesizer: ${config.synthesizerModel}\n`);

    // Initialize client and orchestrator
    const client = new AIBuilderClient(token);
    const orchestrator = new DebateOrchestrator(client);

    // Create and run debate session
    console.log('📝 Creating debate session...');
    const session = orchestrator.createSession(config);
    console.log(`✅ Session created with ID: ${session.id}\n`);

    console.log('🎯 Running debate...');
    const result = await orchestrator.runDebate(session);

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('🎉 DEBATE COMPLETED');
    console.log('='.repeat(80));
    console.log(formatDebateHistory(result));

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Debate completed successfully`);
    console.log(`📈 Total rounds: ${result.totalRounds}`);
    console.log(`🎯 Convergence achieved: ${result.convergenceAchieved ? 'Yes' : 'No'}`);
    console.log(`🤖 Models participated: ${config.models.length}`);

  } catch (error) {
    console.error('\n❌ Error running debate:');
    if (error instanceof Error) {
      console.error(error.message);
      
      // Provide helpful hints for common errors
      if (error.message.includes('Invalid debate configuration')) {
        console.error('\n💡 Tip: Use --help to see valid configuration options');
      } else if (error.message.includes('fetch')) {
        console.error('💡 Tip: Check your internet connection and AI_BUILDER_TOKEN');
      }
    } else {
      console.error('An unexpected error occurred:', error);
    }
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };