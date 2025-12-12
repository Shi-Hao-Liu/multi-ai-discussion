# Multi-Model Debate System

一个多模型讨论系统，让多个 LLM Agent 进行结构化讨论，通过多轮辩论达成共识，最终生成综合答案。

## 🌟 特性

- **多模型协作**: 支持同时使用多个 AI 模型进行讨论
- **智能收敛判定**: Moderator 自动评估讨论是否达成共识
- **综合答案生成**: Synthesizer 整合所有观点生成最终答案
- **灵活配置**: 可自定义参与模型、轮数限制、收敛阈值等
- **完整历史记录**: 保存所有讨论轮次和决策过程
- **命令行界面**: 简单易用的 CLI 工具

## 🚀 快速开始

### 环境要求

- Node.js 16+ 
- npm 或 yarn
- AI Builder API Token

### 安装

```bash
# 克隆项目
git clone https://github.com/your-repo/multi-model-debate.git
cd multi-model-debate

# 安装依赖
npm install

# 构建项目
npm run build
```

### 配置 API Token

```bash
# 设置环境变量
export AI_BUILDER_TOKEN="your-ai-builder-token-here"

# 或者创建 .env 文件
echo "AI_BUILDER_TOKEN=your-ai-builder-token-here" > .env
```

### 基本使用

```bash
# 使用默认配置运行讨论
npm run dev "What is the best programming language?"

# 或使用构建后的版本
npm start "What is the best programming language?"
```

## 📖 详细使用指南

### 命令行选项

```bash
npm run dev [OPTIONS] [TOPIC]
```

#### 选项说明

| 选项 | 简写 | 描述 | 默认值 |
|------|------|------|--------|
| `--topic` | `-t` | 讨论话题（必需） | - |
| `--models` | `-m` | 参与模型列表，逗号分隔 | `deepseek,supermind-agent-v1` |
| `--max-rounds` | `-r` | 最大讨论轮数 | `5` |
| `--convergence-threshold` | `-c` | 收敛阈值 (0-1) | `0.8` |
| `--moderator-model` | | Moderator 使用的模型 | `deepseek` |
| `--synthesizer-model` | | Synthesizer 使用的模型 | `deepseek` |
| `--help` | `-h` | 显示帮助信息 | - |

#### 可用模型

- `deepseek` - 快速且经济的模型
- `supermind-agent-v1` - 多工具代理，支持网络搜索
- `gemini-2.5-pro` - Google Gemini 模型
- `gpt-5` - OpenAI 兼容模型
- `grok-4-fast` - X.AI 的 Grok API

### 使用示例

#### 基础示例

```bash
# 简单讨论
npm run dev "What are the pros and cons of remote work?"
```

#### 高级配置

```bash
# 使用多个模型，限制轮数
npm run dev \
  --topic "How should we approach AI safety?" \
  --models "deepseek,supermind-agent-v1,grok-4-fast" \
  --max-rounds 3 \
  --convergence-threshold 0.7
```

#### 自定义 Moderator 和 Synthesizer

```bash
npm run dev \
  -t "Best practices for microservices architecture" \
  -m "deepseek,supermind-agent-v1" \
  --moderator-model "gemini-2.5-pro" \
  --synthesizer-model "gpt-5"
```

## 🔧 编程接口

### 基本用法

```typescript
import { 
  AIBuilderClient, 
  DebateOrchestrator, 
  createDefaultConfig 
} from './src/debate';

// 初始化客户端
const client = new AIBuilderClient(process.env.AI_BUILDER_TOKEN!);
const orchestrator = new DebateOrchestrator(client);

// 创建配置
const config = createDefaultConfig(
  "What is the future of artificial intelligence?",
  ["deepseek", "gemini-2.5-pro"]
);

// 运行讨论
const session = orchestrator.createSession(config);
const result = await orchestrator.runDebate(session);

console.log("Final Answer:", result.session.finalAnswer);
```

### 自定义配置

```typescript
import { DebateConfig, validateDebateConfig } from './src/debate/config';

const config: DebateConfig = {
  topic: "Should AI development be regulated?",
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
}
```

### 处理结果

```typescript
import { formatDebateHistory } from './src/debate/formatter';

const result = await orchestrator.runDebate(session);

// 格式化输出
console.log(formatDebateHistory(result));

// 访问详细数据
console.log("Total rounds:", result.totalRounds);
console.log("Converged:", result.convergenceAchieved);
console.log("Final answer:", result.session.finalAnswer);

// 访问每轮讨论
result.session.rounds.forEach((round, index) => {
  console.log(`Round ${index + 1}:`);
  round.responses.forEach(response => {
    console.log(`  ${response.model}: ${response.content}`);
  });
});
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 测试类型

- **属性测试**: 使用 fast-check 验证系统属性
- **单元测试**: 测试各个组件的功能
- **集成测试**: 测试端到端流程

## 📊 输出格式

系统会生成结构化的讨论报告：

```
================================================================================
🎉 DEBATE COMPLETED
================================================================================

📝 Topic: What is the best programming language?

🤖 Participating Models: deepseek, gemini-2.5-pro

📈 Round 1
──────────────────────────────────────────────────────────────────────────────
🔹 deepseek:
Python is excellent for beginners due to its readable syntax...

🔹 gemini-2.5-pro:
While Python is great, JavaScript offers more versatility...

📊 Convergence Assessment:
✅ Converged: Yes (Confidence: 0.85)
💭 Reasoning: Both models acknowledge the strengths of different languages...

🎯 Final Synthesized Answer:
The "best" programming language depends on the specific use case...

================================================================================
📊 SUMMARY
================================================================================
✅ Debate completed successfully
📈 Total rounds: 2
🎯 Convergence achieved: Yes
🤖 Models participated: 2
```

## ⚙️ 配置选项详解

### 收敛阈值 (Convergence Threshold)

- **范围**: 0.0 - 1.0
- **含义**: Moderator 判定收敛的置信度阈值
- **建议值**:
  - `0.6-0.7`: 较宽松，更快收敛
  - `0.8`: 默认值，平衡收敛速度和质量
  - `0.9-1.0`: 严格，需要高度一致才收敛

### 最大轮数 (Max Rounds)

- **范围**: 1-10（建议）
- **含义**: 防止无限讨论的安全机制
- **建议值**:
  - `3-5`: 适合简单话题
  - `5-7`: 适合复杂话题
  - `8+`: 适合需要深度探讨的话题

### 模型选择策略

#### 平衡配置（推荐）
```bash
--models "deepseek,gemini-2.5-pro"
```
- 成本效益好，观点多样性适中

#### 多样性配置
```bash
--models "deepseek,gemini-2.5-pro,gpt-5,supermind-agent-v1"
```
- 观点最丰富，但成本较高

#### 经济配置
```bash
--models "deepseek,deepseek"
```
- 成本最低，但观点多样性有限

## 🔍 故障排除

### 常见错误

#### 1. API Token 错误
```
Error: AI_BUILDER_TOKEN environment variable is required
```
**解决方案**: 设置正确的环境变量
```bash
export AI_BUILDER_TOKEN="your-token-here"
```

#### 2. 网络连接错误
```
Error: fetch failed
```
**解决方案**: 检查网络连接和 API 服务状态

#### 3. 配置验证错误
```
Invalid debate configuration: At least 2 models are required
```
**解决方案**: 确保提供至少 2 个有效模型

#### 4. 模型不可用
```
Invalid model identifiers: claude. Available models: deepseek, gemini-2.5-pro...
```
**解决方案**: 使用 `--help` 查看可用模型列表

#### 5. 讨论运行缓慢
**现象**: 系统运行但响应很慢
**原因**: AI 模型需要时间处理复杂请求
**解决方案**: 
- 耐心等待（单轮可能需要 1-2 分钟）
- 使用更简单的话题进行测试
- 减少参与模型数量
- 降低最大轮数

### 调试技巧

1. **启用详细日志**: 查看控制台输出了解执行过程
2. **减少轮数**: 使用 `--max-rounds 2` 快速测试
3. **简化配置**: 先用默认配置测试，再逐步添加选项
4. **检查 Token**: 确保 AI Builder Token 有效且有足够额度
5. **性能优化**: 
   - 使用简单话题（如 "What is 1+1?"）进行测试
   - 单个模型测试：`--models "deepseek,deepseek"`
   - 降低收敛阈值：`--convergence-threshold 0.6`

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [AI Builder Platform](https://space.ai-builders.com/) - 提供多模型 API 支持
- [fast-check](https://github.com/dubzzz/fast-check) - 属性测试框架
- 所有贡献者和用户的支持

---

如有问题或建议，请提交 [Issue](https://github.com/your-repo/multi-model-debate/issues) 或联系维护者。