# 📚 使用示例

这个目录包含了多模型讨论系统的各种使用示例。

## 🚀 快速运行示例

```bash
# 运行基础示例
node examples/example-configs.js basic

# 运行技术讨论示例
node examples/example-configs.js technical

# 运行快速讨论示例（成本优化）
node examples/example-configs.js quick

# 运行深度分析示例
node examples/example-configs.js deep

# 运行创意讨论示例
node examples/example-configs.js creative

# 运行学术讨论示例
node examples/example-configs.js academic

# 运行商业策略讨论示例
node examples/example-configs.js business
```

## 📋 示例配置说明

### 1. 基础配置 (basic)
- **话题**: 远程工作的优缺点
- **模型**: deepseek, gemini-2.5-pro
- **特点**: 平衡的配置，适合大多数场景

### 2. 技术讨论 (technical)
- **话题**: 微服务 vs 单体架构
- **模型**: deepseek, gemini-2.5-pro, gpt-5
- **特点**: 多模型参与，适合技术决策

### 3. 快速讨论 (quick)
- **话题**: 初学者最佳编程语言
- **模型**: deepseek (重复使用降低成本)
- **特点**: 成本优化，快速得出结论

### 4. 深度分析 (deep)
- **话题**: AI 对就业市场的影响
- **模型**: 4个不同模型
- **特点**: 全面分析，多角度观点

### 5. 创意讨论 (creative)
- **话题**: 城市交通创新解决方案
- **模型**: supermind-agent-v1, gemini-2.5-pro, grok-4-fast
- **特点**: 创新思维，较低收敛阈值

### 6. 学术讨论 (academic)
- **话题**: 基因编辑的伦理问题
- **模型**: gemini-2.5-pro, gpt-5
- **特点**: 严谨分析，高收敛阈值

### 7. 商业策略 (business)
- **话题**: 初创公司增长 vs 盈利
- **模型**: deepseek, gemini-2.5-pro, supermind-agent-v1
- **特点**: 商业决策导向

## 🔧 自定义示例

你可以基于这些示例创建自己的配置：

```javascript
const myConfig = {
  topic: "你的讨论话题",
  models: ["model1", "model2"],
  maxRounds: 5,
  convergenceThreshold: 0.8,
  moderatorModel: "moderator-model",
  synthesizerModel: "synthesizer-model"
};
```

## 💡 配置建议

### 选择模型数量
- **2个模型**: 基础对话，成本较低
- **3个模型**: 平衡观点，推荐配置
- **4+个模型**: 全面分析，成本较高

### 设置轮数限制
- **3轮**: 快速讨论
- **5轮**: 标准配置
- **7+轮**: 深度分析

### 调整收敛阈值
- **0.6-0.7**: 宽松，快速收敛
- **0.8**: 标准配置
- **0.9+**: 严格，需要高度一致

### 模型选择策略
- **经济型**: 多用 deepseek
- **平衡型**: deepseek + gemini-2.5-pro
- **高质量**: gemini-2.5-pro + gpt-5
- **多样性**: 包含 supermind-agent-v1 或 grok-4-fast