# 🚀 快速开始指南

## 5 分钟上手多模型讨论系统

### 1. 安装依赖

```bash
npm install
```

### 2. 设置 API Token

```bash
export AI_BUILDER_TOKEN="your-ai-builder-token-here"
```

### 3. 运行第一个讨论

```bash
npm run dev "What is the best programming language?"
```

就这么简单！系统会自动：
- 使用 `deepseek` 和 `gemini-2.5-pro` 两个模型
- 进行最多 5 轮讨论
- 当达成 80% 共识时自动结束
- 生成综合答案

## 🎯 常用命令

```bash
# 自定义模型和话题
npm run dev -t "AI 的未来发展" -m "deepseek,gemini-2.5-pro,gpt-5"

# 限制讨论轮数
npm run dev "远程工作的利弊" --max-rounds 3

# 调整收敛阈值（更容易达成共识）
npm run dev "最佳编程实践" --convergence-threshold 0.7

# 查看所有选项
npm run dev --help
```

## 📋 输出示例

```
🚀 Starting Multi-Model Debate System...

Topic: What is the best programming language?
Models: deepseek, gemini-2.5-pro
Max Rounds: 5
Convergence Threshold: 0.8

📝 Creating debate session...
✅ Session created with ID: abc123

🎯 Running debate...

📈 Round 1
──────────────────────────────────────────────────────────────────────────────
🔹 deepseek:
Python stands out as an excellent choice for beginners and professionals alike...

🔹 gemini-2.5-pro:
While Python is indeed powerful, JavaScript offers unmatched versatility...

📊 Convergence Assessment:
✅ Converged: Yes (Confidence: 0.85)

🎯 Final Synthesized Answer:
The "best" programming language ultimately depends on your specific needs...

📊 SUMMARY
✅ Debate completed successfully
📈 Total rounds: 1
🎯 Convergence achieved: Yes
🤖 Models participated: 2
```

## 🔧 故障排除

**问题**: `AI_BUILDER_TOKEN environment variable is required`
**解决**: `export AI_BUILDER_TOKEN="your-token"`

**问题**: `At least 2 models are required`
**解决**: 确保使用至少 2 个模型：`-m "model1,model2"`

**问题**: 网络错误
**解决**: 检查网络连接和 Token 是否有效

## 📚 下一步

- 阅读完整的 [README.md](README.md) 了解所有功能
- 查看 [API 文档](src/debate/) 进行编程集成
- 运行 `npm test` 查看测试用例

开始你的 AI 讨论之旅吧！🎉