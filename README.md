# Multi-Agent Document Generator

基于多 Agent 协同的 AI 文档生成系统，自动生成技术方案、产品文档与行业分析报告。

## 系统架构

系统采用四 Agent 流水线协作架构，通过长链推理实现端到端文档生成：

```
用户输入 (主题 + 文档类型)
       │
       ▼
┌─────────────────┐
│  Research Agent │  ← 资料检索与信息提取
│  调研分析 Agent │     输出结构化研究数据
└────────┬────────┘
         ▼
┌─────────────────┐
│  Outline Agent  │  ← 文档结构规划
│  大纲规划 Agent │     输出章节层级与逻辑顺序
└────────┬────────┘
         ▼
┌─────────────────┐
│  Writer Agent   │  ← 正文撰写
│  内容撰写 Agent │     按大纲逐章生成完整初稿
└────────┬────────┘
         ▼
┌─────────────────┐
│  Review Agent   │  ← 质量校验与改进
│  质量审核 Agent │     逻辑一致性、术语规范、事实校验
└────────┬────────┘
         ▼
┌─────────────────┐
│   PDF 生成      │  ← 排版输出
└─────────────────┘
         ▼
     最终文档
```

### Agent 职责

| Agent | 职责 | 输入 | 输出 |
|-------|------|------|------|
| **Research** | 主题调研、关键信息提取、内容框架梳理 | 主题 + 文档类型 | 结构化研究成果（摘要、关键点、章节建议） |
| **Outline** | 文档结构设计、章节层次规划、逻辑流程编排 | 研究成果 | 文档大纲（章节标题、层级、描述） |
| **Writer** | 按大纲撰写正文、专业语调节奏控制、Markdown 格式化 | 大纲 + 研究成果 | 完整文档初稿 |
| **Review** | 逻辑一致性检查、术语准确性校验、质量评分与自动修复 | 初稿 | 审核报告 + 改进后的最终文档 |

## 技术栈

- **后端：** Node.js + Express
- **AI 模型：** DeepSeek API (deepseek-chat)
- **前端：** HTML + CSS + JavaScript (EventSource 实时推送)
- **PDF 生成：** Puppeteer + marked
- **通信：** SSE (Server-Sent Events) 实时进度推送

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/Tolight1/Multi-Agent.git
cd Multi-Agent

# 2. 安装依赖
npm install

# 3. 配置 API 密钥
# 在项目根目录创建 .env 文件：
echo "DEEPSEEK_API_KEY=你的API密钥" > .env
echo "DEEPSEEK_MODEL=deepseek-chat" >> .env
echo "PORT=3000" >> .env

# 4. 启动服务
npm start
```

### 访问

浏览器打开 `http://localhost:3000`

输入文档主题、选择文档类型，点击 "Generate Document" 即可。

## 支持文档类型

- 技术方案
- 产品文档
- 行业分析报告
- 研究报告
- 项目提案

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/generate` | 创建文档生成任务，返回 `{ jobId }` |
| GET | `/api/stream/:jobId` | SSE 实时流，推送各 Agent 执行进度 |
| GET | `/api/download/:jobId` | 下载生成的 PDF 文件 |
| GET | `/api/download/:jobId/markdown` | 下载生成的 Markdown 文件 |
| GET | `/api/jobs` | 查看所有任务列表 |

## 项目结构

```
mutiTXT/
├── package.json
├── .env                   # API 密钥配置
├── .gitignore
├── server/
│   ├── index.js           # Express 服务入口
│   ├── config.js          # 配置管理
│   ├── orchestrator.js    # Agent 编排调度
│   ├── agents/
│   │   ├── base.js        # Agent 基类
│   │   ├── research.js    # 调研 Agent
│   │   ├── outline.js     # 大纲 Agent
│   │   ├── writer.js      # 撰写 Agent
│   │   └── reviewer.js    # 审核 Agent
│   ├── services/
│   │   ├── deepseek.js    # DeepSeek API 客户端
│   │   └── pdf.js         # PDF 生成服务
│   └── routes/
│       └── api.js         # API 路由
├── public/
│   ├── index.html         # 前端界面
│   ├── style.css          # 样式
│   └── app.js             # 前端逻辑
├── output/                # 生成文档输出目录
└── README.md
```
