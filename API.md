# 📚 API 文档

## 核心接口

### AIBuilderClient

与 AI Builder API 通信的客户端。

```typescript
class AIBuilderClient {
  constructor(token: string)
  
  async chatCompletion(request: ChatRequest): Promise<ChatResponse>
}
```

#### ChatRequest

```typescript
interface ChatRequest {
  model: string;                    // 模型名称
  messages: Message[];              // 消息历史
  temperature?: number;             // 采样温度 (0-2)
  max_tokens?: number;              // 最大 token 数
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

#### ChatResponse

```typescript
interface ChatResponse {
  id: string;
  choices: {
    message: Message;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### DebateConfig

讨论配置接口。

```typescript
interface DebateConfig {
  topic: string;                    // 讨论话题
  models: string[];                 // 参与模型列表（至少2个）
  maxRounds: number;                // 最大轮数（默认：5）
  convergenceThreshold: number;     // 收敛阈值 0-1（默认：0.8）
  moderatorModel: string;           // Moderator 模型（默认：deepseek）
  synthesizerModel: string;         // Synthesizer 模型（默认：deepseek）
}
```

#### 配置验证

```typescript
function validateDebateConfig(config: Partial<DebateConfig>): ValidationResult

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
}
```

#### 创建默认配置

```typescript
function createDefaultConfig(topic: string, models: string[]): DebateConfig
```

### DebateSession

讨论会话状态管理。

```typescript
interface DebateSession {
  id: string;                       // 会话唯一标识
  config: DebateConfig;             // 配置信息
  rounds: DebateRound[];            // 讨论轮次
  status: SessionStatus;            // 会话状态
  finalAnswer?: string;             // 最终答案
  convergenceAssessment?: ConvergenceAssessment;
}

type SessionStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'converged' 
  | 'max_rounds_reached' 
  | 'completed';
```

#### DebateRound

```typescript
interface DebateRound {
  roundNumber: number;              // 轮次编号
  responses: AgentResponse[];       // Agent 回应
  convergenceCheck?: ConvergenceAssessment;
}

interface AgentResponse {
  model: string;                    // 模型名称
  content: string;                  // 回应内容
  timestamp: Date;                  // 时间戳
  error?: string;                   // 错误信息（如有）
}
```

#### ConvergenceAssessment

```typescript
interface ConvergenceAssessment {
  isConverged: boolean;             // 是否收敛
  confidenceScore: number;          // 置信度分数 0-1
  reasoning: string;                // 判定理由
}
```

### DebateOrchestrator

主控制器，管理整个讨论流程。

```typescript
class DebateOrchestrator {
  constructor(client: AIBuilderClient)
  
  createSession(config: DebateConfig): DebateSession
  async runDebate(session: DebateSession): Promise<DebateResult>
  async executeRound(session: DebateSession): Promise<DebateRound>
}

interface DebateResult {
  session: DebateSession;           // 完整会话数据
  finalAnswer: string;              // 最终答案
  totalRounds: number;              // 总轮数
  convergenceAchieved: boolean;     // 是否达成收敛
}
```

### Moderator

收敛评估器。

```typescript
class Moderator {
  constructor(client: AIBuilderClient, model: string)
  
  async evaluateConvergence(
    topic: string,
    rounds: DebateRound[],
    threshold: number
  ): Promise<ConvergenceAssessment>
}
```

### Synthesizer

最终答案生成器。

```typescript
class Synthesizer {
  constructor(client: AIBuilderClient, model: string)
  
  async synthesize(
    topic: string,
    rounds: DebateRound[]
  ): Promise<string>
}
```

### RoundManager

轮次执行管理器。

```typescript
class RoundManager {
  constructor(client: AIBuilderClient)
  
  async executeRound(
    topic: string,
    models: string[],
    previousRounds: DebateRound[]
  ): Promise<DebateRound>
}
```

## 工具函数

### formatDebateHistory

格式化讨论历史为可读文本。

```typescript
function formatDebateHistory(result: DebateResult): string
```

### 可用模型常量

```typescript
const AVAILABLE_MODELS = [
  'deepseek',
  'supermind-agent-v1', 
  'gemini-2.5-pro',
  'gpt-5',
  'grok-4-fast'
] as const;

type AvailableModel = typeof AVAILABLE_MODELS[number];
```

## 使用示例

### 基础用法

```typescript
import { 
  AIBuilderClient, 
  DebateOrchestrator, 
  createDefaultConfig 
} from './src/debate';

async function runDebate() {
  // 初始化
  const client = new AIBuilderClient(process.env.AI_BUILDER_TOKEN!);
  const orchestrator = new DebateOrchestrator(client);
  
  // 配置
  const config = createDefaultConfig(
    "What are the benefits of TypeScript?",
    ["deepseek", "gemini-2.5-pro"]
  );
  
  // 执行
  const session = orchestrator.createSession(config);
  const result = await orchestrator.runDebate(session);
  
  // 结果
  console.log("Final Answer:", result.finalAnswer);
  console.log("Rounds:", result.totalRounds);
  console.log("Converged:", result.convergenceAchieved);
}
```

### 高级配置

```typescript
import { DebateConfig, validateDebateConfig } from './src/debate/config';

const config: DebateConfig = {
  topic: "Should we use microservices or monoliths?",
  models: ["deepseek", "gemini-2.5-pro", "gpt-5"],
  maxRounds: 4,
  convergenceThreshold: 0.75,
  moderatorModel: "gemini-2.5-pro",
  synthesizerModel: "gpt-5"
};

// 验证配置
const validation = validateDebateConfig(config);
if (!validation.isValid) {
  console.error("Configuration errors:", validation.errors);
  return;
}

// 运行讨论
const session = orchestrator.createSession(config);
const result = await orchestrator.runDebate(session);
```

### 自定义组件

```typescript
import { Moderator, Synthesizer } from './src/debate';

// 自定义 Moderator
const moderator = new Moderator(client, "gemini-2.5-pro");
const assessment = await moderator.evaluateConvergence(
  "AI safety",
  rounds,
  0.8
);

// 自定义 Synthesizer
const synthesizer = new Synthesizer(client, "gpt-5");
const finalAnswer = await synthesizer.synthesize("AI safety", rounds);
```

### 错误处理

```typescript
try {
  const result = await orchestrator.runDebate(session);
  console.log("Success:", result.finalAnswer);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Invalid debate configuration')) {
      console.error("Configuration error:", error.message);
    } else if (error.message.includes('fetch')) {
      console.error("Network error:", error.message);
    } else {
      console.error("Unknown error:", error.message);
    }
  }
}
```

### 访问详细数据

```typescript
const result = await orchestrator.runDebate(session);

// 遍历所有轮次
result.session.rounds.forEach((round, index) => {
  console.log(`\n=== Round ${index + 1} ===`);
  
  // 每个 Agent 的回应
  round.responses.forEach(response => {
    console.log(`${response.model}:`);
    console.log(response.content);
    console.log(`Timestamp: ${response.timestamp}`);
    if (response.error) {
      console.log(`Error: ${response.error}`);
    }
  });
  
  // 收敛评估
  if (round.convergenceCheck) {
    console.log(`Converged: ${round.convergenceCheck.isConverged}`);
    console.log(`Confidence: ${round.convergenceCheck.confidenceScore}`);
    console.log(`Reasoning: ${round.convergenceCheck.reasoning}`);
  }
});

// 最终状态
console.log(`\nFinal Status: ${result.session.status}`);
console.log(`Total Rounds: ${result.totalRounds}`);
console.log(`Convergence Achieved: ${result.convergenceAchieved}`);
```

## 错误类型

### 配置错误

- `Invalid debate configuration: Topic cannot be empty`
- `Invalid debate configuration: At least 2 models are required`
- `Invalid debate configuration: maxRounds must be greater than 0`
- `Invalid debate configuration: convergenceThreshold must be between 0 and 1`

### API 错误

- `Network error: fetch failed`
- `Authentication error: Invalid token`
- `Rate limit exceeded`
- `Model unavailable`

### 运行时错误

- `All agents failed to respond`
- `Moderator evaluation failed`
- `Synthesis failed`

## 性能考虑

### Token 使用

- 每轮讨论的 token 消耗随轮次增加而增长
- 建议合理设置 `maxRounds` 控制成本
- 使用经济模型（如 `deepseek`）作为默认选择

### 并发处理

- Agent 响应是并发执行的，提高效率
- 网络错误会自动重试（最多3次）
- 单个 Agent 失败不会影响其他 Agent

### 内存使用

- 完整的讨论历史保存在内存中
- 长时间讨论可能消耗较多内存
- 建议定期清理不需要的会话数据