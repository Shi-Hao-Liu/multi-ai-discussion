/**
 * 多模型讨论系统配置示例
 * 
 * 这个文件包含了各种使用场景的配置示例
 */

// 基础配置示例
const basicConfig = {
  topic: "What are the advantages and disadvantages of remote work?",
  models: ["deepseek", "gemini-2.5-pro"],
  maxRounds: 5,
  convergenceThreshold: 0.8,
  moderatorModel: "deepseek",
  synthesizerModel: "deepseek"
};

// 技术讨论配置
const technicalDebateConfig = {
  topic: "Should we use microservices or monolithic architecture for our next project?",
  models: ["deepseek", "gemini-2.5-pro", "gpt-5"],
  maxRounds: 4,
  convergenceThreshold: 0.75,
  moderatorModel: "gemini-2.5-pro",
  synthesizerModel: "gpt-5"
};

// 快速讨论配置（成本优化）
const quickDebateConfig = {
  topic: "What is the best programming language for beginners?",
  models: ["deepseek", "deepseek"], // 使用相同模型降低成本
  maxRounds: 3,
  convergenceThreshold: 0.7,
  moderatorModel: "deepseek",
  synthesizerModel: "deepseek"
};

// 深度分析配置
const deepAnalysisConfig = {
  topic: "How will artificial intelligence impact the job market in the next decade?",
  models: ["deepseek", "supermind-agent-v1", "gemini-2.5-pro", "gpt-5"],
  maxRounds: 6,
  convergenceThreshold: 0.85,
  moderatorModel: "gemini-2.5-pro",
  synthesizerModel: "gpt-5"
};

// 创意讨论配置
const creativeDebateConfig = {
  topic: "What would be the most innovative solution to urban transportation?",
  models: ["supermind-agent-v1", "gemini-2.5-pro", "grok-4-fast"],
  maxRounds: 5,
  convergenceThreshold: 0.7, // 创意讨论可以更宽松
  moderatorModel: "gemini-2.5-pro",
  synthesizerModel: "gpt-5"
};

// 学术讨论配置
const academicDebateConfig = {
  topic: "What are the ethical implications of gene editing technology?",
  models: ["gemini-2.5-pro", "gpt-5"],
  maxRounds: 7,
  convergenceThreshold: 0.9, // 学术讨论需要更高的一致性
  moderatorModel: "gemini-2.5-pro",
  synthesizerModel: "gpt-5"
};

// 商业策略讨论配置
const businessStrategyConfig = {
  topic: "Should startups prioritize growth or profitability in their early stages?",
  models: ["deepseek", "gemini-2.5-pro", "supermind-agent-v1"],
  maxRounds: 4,
  convergenceThreshold: 0.8,
  moderatorModel: "gemini-2.5-pro",
  synthesizerModel: "gemini-2.5-pro"
};

// 使用示例函数
async function runExampleDebate(configName) {
  const { AIBuilderClient, DebateOrchestrator, formatDebateHistory } = require('../src/debate');
  
  const configs = {
    basic: basicConfig,
    technical: technicalDebateConfig,
    quick: quickDebateConfig,
    deep: deepAnalysisConfig,
    creative: creativeDebateConfig,
    academic: academicDebateConfig,
    business: businessStrategyConfig
  };
  
  const config = configs[configName];
  if (!config) {
    console.error(`Unknown config: ${configName}`);
    console.log(`Available configs: ${Object.keys(configs).join(', ')}`);
    return;
  }
  
  try {
    const client = new AIBuilderClient(process.env.AI_BUILDER_TOKEN);
    const orchestrator = new DebateOrchestrator(client);
    
    console.log(`🚀 Running ${configName} debate...`);
    console.log(`Topic: ${config.topic}`);
    console.log(`Models: ${config.models.join(', ')}`);
    console.log('');
    
    const session = orchestrator.createSession(config);
    const result = await orchestrator.runDebate(session);
    
    console.log(formatDebateHistory(result));
    
  } catch (error) {
    console.error('Error running debate:', error.message);
  }
}

// 命令行使用示例
if (require.main === module) {
  const configName = process.argv[2] || 'basic';
  runExampleDebate(configName);
}

module.exports = {
  basicConfig,
  technicalDebateConfig,
  quickDebateConfig,
  deepAnalysisConfig,
  creativeDebateConfig,
  academicDebateConfig,
  businessStrategyConfig,
  runExampleDebate
};