# LLM 智能分析模块开发文档

## 一、项目概述

### 1.1 目标

在现有的逻辑链应用中集成 LLM 能力，帮助用户：
- 分析计划风险
- 获取下一步行动建议
- 检查逻辑完整性
- 补全遗漏的节点和关系

### 1.2 技术选型

- API 服务：阿里云 Dashscope API
- 模型：qwen-plus 或 qwen-max
- API Key：通过环境变量配置（DASHSCOPE_API_KEY）
- 调用方式：前端直接调用

### 1.3 开发阶段

本次开发为第一阶段：LLM 只读分析（不修改用户数据）

---

## 二、环境配置

### 2.1 环境变量

```
DASHSCOPE_API_KEY=your_api_key_here
```

### 2.2 API 端点

```
POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

### 2.3 请求头

```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer ${DASHSCOPE_API_KEY}"
}
```

---

## 三、数据格式

### 3.1 图数据转换为文本格式

将用户的图结构转换为 LLM 可理解的文本格式：

```
# 场景: [场景名称]

## 节点
[节点类型]:[节点名称][状态]
  [描述（如果有）]

## 关系
[源节点] -[关系类型]-> [目标节点]

## 用户问题
[用户的具体问题]
```

### 3.2 节点类型和状态映射

```javascript
const nodeTypeMap = {
  goal: "目标",
  action: "行动",
  fact: "事实",
  assumption: "假设",
  constraint: "约束",
  conclusion: "结论"
};

const statusMap = {
  // 目标状态
  unachieved: "未达成",
  achieved: "已达成",
  
  // 行动状态
  pending: "待执行",
  in_progress: "进行中",
  success: "成功",
  failed: "失败",
  
  // 事实状态
  confirmed: "确认",
  rejected: "否定",
  
  // 假设状态
  uncertain: "存疑",
  confirmed: "确认",
  rejected: "否定",
  
  // 约束状态
  unmet: "未满足",
  fulfilled: "已满足",
  
  // 结论状态
  pending: "待定",
  confirmed: "确认",
  rejected: "否定"
};
```

### 3.3 关系类型映射

```javascript
const edgeTypeMap = {
  depends: "依赖",
  supports: "促成",
  hinders: "阻碍",
  achieves: "实现",
  causes: "导致",
  contradicts: "矛盾"
};
```

### 3.4 转换函数

```javascript
function convertGraphToText(scene, nodes, edges) {
  let text = `# 场景: ${scene.name}\n\n`;
  
  // 节点部分
  text += "## 节点\n";
  nodes.forEach(node => {
    const typeName = nodeTypeMap[node.type];
    const statusName = statusMap[node.status] || node.status;
    text += `${typeName}:${node.name}[${statusName}]\n`;
    if (node.description) {
      text += `  ${node.description}\n`;
    }
  });
  
  // 关系部分
  text += "\n## 关系\n";
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const edgeTypeName = edgeTypeMap[edge.type];
    text += `${sourceNode.name} -${edgeTypeName}-> ${targetNode.name}\n`;
  });
  
  return text;
}
```

---

## 四、系统提示词

### 4.1 基础系统提示词

```javascript
const SYSTEM_PROMPT = `你是一个基于第一性原理的逻辑分析助手。用户会提供一个目标规划图，包含节点和关系。

## 节点类型（6种）

1. 目标(goal): 用户想达成的终态
   - 状态: [未达成] / [已达成]

2. 行动(action): 可执行的操作
   - 状态: [待执行] / [进行中] / [成功] / [失败]

3. 事实(fact): 已确认的信息
   - 状态: [确认] / [否定]

4. 假设(assumption): 未验证的信息
   - 状态: [存疑] / [确认] / [否定]

5. 约束(constraint): 必须满足的条件
   - 状态: [未满足] / [已满足]

6. 结论(conclusion): 从其他节点推导出的结果
   - 状态: [待定] / [确认] / [否定]

## 关系类型（6种）

1. 依赖(depends): A -依赖-> B 表示 A 需要 B 才能成立（B是A的必要条件）
2. 促成(supports): A -促成-> B 表示 A 有助于 B 成立（正向影响，非必要）
3. 阻碍(hinders): A -阻碍-> B 表示 A 妨碍 B 成立（负向影响，非致命）
4. 实现(achieves): A -实现-> B 表示行动 A 可以满足约束/目标 B
5. 导致(causes): A -导致-> B 表示 A 发生会引起 B 发生（因果关系）
6. 矛盾(contradicts): A -矛盾-> B 表示 A 和 B 不能同时为真

## 分析原则

1. 基于第一性原理，从根本原因分析问题
2. 重点关注状态为[存疑]的假设，这些是关键风险点
3. 重点关注状态为[未满足]的约束，这些是当前瓶颈
4. 建议应该具体、可执行
5. 如果发现逻辑问题，主动指出

## 回复格式

请使用清晰的结构化格式回复，使用中文。`;
```

### 4.2 功能专用提示词

#### 风险分析

```javascript
const RISK_ANALYSIS_PROMPT = `请分析这个计划的主要风险：

1. 关键假设风险：列出所有状态为[存疑]的假设，分析如果它们不成立会有什么后果
2. 依赖链风险：检查是否有关键依赖尚未满足
3. 阻碍因素：分析当前存在的阻碍因素及其影响程度
4. 遗漏风险：是否有可能被忽视的风险因素

请按风险等级（高/中/低）排序，并给出每个风险的应对建议。`;
```

#### 下一步建议

```javascript
const NEXT_STEP_PROMPT = `根据当前状态，请建议我下一步应该做什么：

1. 分析当前状态：哪些约束已满足，哪些未满足
2. 可执行行动：哪些行动现在可以开始执行（依赖已满足）
3. 阻塞分析：哪些行动被什么阻塞了
4. 优先级排序：推荐的执行顺序及理由
5. 具体建议：最优先应该做的1-2件事

请给出具体、可操作的建议。`;
```

#### 逻辑完整性检查

```javascript
const LOGIC_CHECK_PROMPT = `请检查这个规划图的逻辑完整性：

1. 目标可达性：每个目标是否都有实现路径
2. 孤立节点：是否有节点没有任何关系连接
3. 依赖完整性：是否有遗漏的依赖关系
4. 关系正确性：关系类型使用是否恰当
5. 状态一致性：节点状态是否与关系逻辑一致

如果发现问题，请具体指出并给出修复建议。`;
```

#### 场景补全

```javascript
const COMPLETION_PROMPT = `基于当前的节点和关系，请建议可能遗漏的内容：

1. 遗漏的事实：是否有重要的已知条件没有记录
2. 遗漏的约束：是否有必须满足但未列出的条件
3. 遗漏的假设：是否有隐含的假设需要明确
4. 替代方案：是否有其他可行的行动方案
5. 风险因素：是否有潜在的阻碍因素需要考虑

请给出具体的补充建议，包括节点类型和可能的关系。`;
```

---

## 五、API 调用实现

### 5.1 API 调用函数

```javascript
// services/llmService.js

const DASHSCOPE_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export async function callLLM(systemPrompt, userContent) {
  const apiKey = process.env.DASHSCOPE_API_KEY || import.meta.env.VITE_DASHSCOPE_API_KEY;
  
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY 未配置");
  }
  
  const response = await fetch(DASHSCOPE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "qwen-plus",  // 或 "qwen-max" 获得更好效果
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userContent
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API 调用失败: ${error.message || response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 5.2 分析功能封装

```javascript
// services/analysisService.js

import { callLLM } from './llmService';
import { convertGraphToText } from './graphConverter';
import { 
  SYSTEM_PROMPT, 
  RISK_ANALYSIS_PROMPT, 
  NEXT_STEP_PROMPT,
  LOGIC_CHECK_PROMPT,
  COMPLETION_PROMPT
} from './prompts';

export async function analyzeRisk(scene, nodes, edges) {
  const graphText = convertGraphToText(scene, nodes, edges);
  const userContent = `${graphText}\n\n## 用户问题\n${RISK_ANALYSIS_PROMPT}`;
  return await callLLM(SYSTEM_PROMPT, userContent);
}

export async function suggestNextStep(scene, nodes, edges) {
  const graphText = convertGraphToText(scene, nodes, edges);
  const userContent = `${graphText}\n\n## 用户问题\n${NEXT_STEP_PROMPT}`;
  return await callLLM(SYSTEM_PROMPT, userContent);
}

export async function checkLogic(scene, nodes, edges) {
  const graphText = convertGraphToText(scene, nodes, edges);
  const userContent = `${graphText}\n\n## 用户问题\n${LOGIC_CHECK_PROMPT}`;
  return await callLLM(SYSTEM_PROMPT, userContent);
}

export async function suggestCompletion(scene, nodes, edges) {
  const graphText = convertGraphToText(scene, nodes, edges);
  const userContent = `${graphText}\n\n## 用户问题\n${COMPLETION_PROMPT}`;
  return await callLLM(SYSTEM_PROMPT, userContent);
}

export async function askFreeQuestion(scene, nodes, edges, question) {
  const graphText = convertGraphToText(scene, nodes, edges);
  const userContent = `${graphText}\n\n## 用户问题\n${question}`;
  return await callLLM(SYSTEM_PROMPT, userContent);
}
```

---

## 六、UI 设计

### 6.1 入口位置

在顶部工具栏的"分析"按钮旁边，或作为"分析"按钮的下拉菜单选项。

### 6.2 AI 助手面板

```
┌─────────────────────────────────────────────────┐
│  AI 智能分析                              [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐ ┌─────────────┐               │
│  │ 🔍 风险分析  │ │ 👣 下一步   │               │
│  └─────────────┘ └─────────────┘               │
│  ┌─────────────┐ ┌─────────────┐               │
│  │ ✓ 逻辑检查  │ │ 💡 补全建议  │               │
│  └─────────────┘ └─────────────┘               │
│                                                 │
│  ─────────── 或自由提问 ───────────             │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 请输入你的问题...                        │   │
│  └─────────────────────────────────────────┘   │
│                                    [发送]       │
│                                                 │
├─────────────────────────────────────────────────┤
│  分析结果                                       │
│  ───────────────────────────────────────────── │
│                                                 │
│  [分析结果显示区域]                             │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.3 组件结构

```
components/
├── AIAssistant/
│   ├── AIAssistantPanel.tsx      # 主面板
│   ├── AnalysisButtons.tsx       # 预设功能按钮
│   ├── FreeQuestionInput.tsx     # 自由提问输入框
│   ├── AnalysisResult.tsx        # 结果显示区
│   └── LoadingIndicator.tsx      # 加载状态
```

### 6.4 状态管理

```typescript
interface AIAssistantState {
  isOpen: boolean;
  isLoading: boolean;
  currentAnalysis: string | null;
  error: string | null;
  history: AnalysisRecord[];
}

interface AnalysisRecord {
  id: string;
  type: 'risk' | 'next_step' | 'logic' | 'completion' | 'free';
  question: string;
  result: string;
  timestamp: Date;
}
```

---

## 七、组件实现

### 7.1 AIAssistantPanel.tsx

```tsx
import React, { useState } from 'react';
import { useGraph } from '@/hooks/useGraph';
import { 
  analyzeRisk, 
  suggestNextStep, 
  checkLogic, 
  suggestCompletion,
  askFreeQuestion 
} from '@/services/analysisService';

export function AIAssistantPanel({ isOpen, onClose }) {
  const { scene, nodes, edges } = useGraph();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeQuestion, setFreeQuestion] = useState('');

  const handleAnalysis = async (analysisFn: Function) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await analysisFn(scene, nodes, edges);
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFreeQuestion = async () => {
    if (!freeQuestion.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await askFreeQuestion(scene, nodes, edges, freeQuestion);
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-assistant-panel">
      <div className="panel-header">
        <h3>AI 智能分析</h3>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="panel-content">
        <div className="analysis-buttons">
          <button 
            onClick={() => handleAnalysis(analyzeRisk)}
            disabled={isLoading}
          >
            🔍 风险分析
          </button>
          <button 
            onClick={() => handleAnalysis(suggestNextStep)}
            disabled={isLoading}
          >
            👣 下一步建议
          </button>
          <button 
            onClick={() => handleAnalysis(checkLogic)}
            disabled={isLoading}
          >
            ✓ 逻辑检查
          </button>
          <button 
            onClick={() => handleAnalysis(suggestCompletion)}
            disabled={isLoading}
          >
            💡 补全建议
          </button>
        </div>

        <div className="free-question">
          <input
            type="text"
            value={freeQuestion}
            onChange={(e) => setFreeQuestion(e.target.value)}
            placeholder="请输入你的问题..."
            disabled={isLoading}
          />
          <button 
            onClick={handleFreeQuestion}
            disabled={isLoading || !freeQuestion.trim()}
          >
            发送
          </button>
        </div>

        <div className="analysis-result">
          {isLoading && <div className="loading">分析中...</div>}
          {error && <div className="error">{error}</div>}
          {result && (
            <div className="result-content">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 7.2 样式参考

```css
.ai-assistant-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.analysis-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.analysis-buttons button {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
  cursor: pointer;
  transition: all 0.2s;
}

.analysis-buttons button:hover {
  background: #f0f0f0;
  border-color: #ccc;
}

.analysis-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.free-question {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.free-question input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.free-question button {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.analysis-result {
  border-top: 1px solid #eee;
  padding-top: 16px;
}

.loading {
  text-align: center;
  color: #666;
  padding: 20px;
}

.error {
  color: #f44336;
  padding: 12px;
  background: #ffebee;
  border-radius: 6px;
}

.result-content {
  line-height: 1.6;
}
```

---

## 八、错误处理

### 8.1 错误类型

```javascript
const ERROR_MESSAGES = {
  API_KEY_MISSING: "API Key 未配置，请在环境变量中设置 DASHSCOPE_API_KEY",
  NETWORK_ERROR: "网络连接失败，请检查网络后重试",
  API_ERROR: "API 调用失败，请稍后重试",
  RATE_LIMIT: "请求过于频繁，请稍后再试",
  INVALID_RESPONSE: "返回数据格式错误",
  EMPTY_GRAPH: "当前场景没有节点，请先添加节点"
};
```

### 8.2 错误处理函数

```javascript
function handleAPIError(error) {
  if (!navigator.onLine) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  if (error.status === 429) {
    return ERROR_MESSAGES.RATE_LIMIT;
  }
  
  if (error.status === 401) {
    return ERROR_MESSAGES.API_KEY_MISSING;
  }
  
  return error.message || ERROR_MESSAGES.API_ERROR;
}
```

---

## 九、测试用例

### 9.1 火星生存场景测试

```javascript
const testScene = {
  name: "火星生存",
  nodes: [
    { id: "1", type: "goal", name: "活下去", status: "unachieved" },
    { id: "2", type: "constraint", name: "热量需求", status: "unmet" },
    { id: "3", type: "action", name: "种植作物", status: "pending" },
    { id: "4", type: "fact", name: "植物学家", status: "confirmed" },
    { id: "5", type: "assumption", name: "NASA在监听", status: "uncertain" }
  ],
  edges: [
    { source: "1", target: "2", type: "depends" },
    { source: "3", target: "2", type: "achieves" },
    { source: "4", target: "3", type: "supports" }
  ]
};
```

### 9.2 预期测试结果

```
风险分析应该识别出：
- NASA在监听是存疑假设
- 热量需求未满足是关键瓶颈

下一步建议应该识别出：
- 种植作物可以执行（依赖已满足）

逻辑检查应该识别出：
- 目标"活下去"有实现路径
- 建议添加更多约束条件
```

---

## 十、开发检查清单

### 10.1 环境配置
- [ ] 配置 DASHSCOPE_API_KEY 环境变量
- [ ] 确认 API 端点可访问
- [ ] 测试 API 调用成功

### 10.2 核心功能
- [ ] 实现 convertGraphToText 函数
- [ ] 实现 callLLM 函数
- [ ] 实现四个预设分析功能
- [ ] 实现自由提问功能

### 10.3 UI 组件
- [ ] 创建 AIAssistantPanel 组件
- [ ] 实现加载状态显示
- [ ] 实现错误提示
- [ ] 实现结果 Markdown 渲染

### 10.4 集成测试
- [ ] 测试风险分析功能
- [ ] 测试下一步建议功能
- [ ] 测试逻辑检查功能
- [ ] 测试补全建议功能
- [ ] 测试自由提问功能
- [ ] 测试错误处理

### 10.5 优化
- [ ] 添加请求防抖
- [ ] 添加结果缓存（可选）
- [ ] 优化提示词效果

---

## 十一、后续迭代方向

### 第二阶段：LLM 辅助建议

- 用户添加节点后，LLM 建议可能的关系
- 用户选择目标后，LLM 建议可能需要的约束和行动
- 建议需用户确认后才执行

### 第三阶段：对话式构建

- 用户用自然语言描述场景
- LLM 自动生成节点和关系
- 用户审核修改后导入

---

## 十二、注意事项

1. API Key 安全：不要在代码中硬编码 API Key
2. 请求频率：添加适当的请求间隔，避免触发限流
3. 响应时间：LLM 响应可能需要几秒，需要良好的加载状态提示
4. 结果质量：提示词可能需要根据实际效果迭代优化
5. 成本控制：qwen-plus 比 qwen-max 便宜，先用 qwen-plus 测试
