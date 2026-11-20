# 原生 run_workflow 与 Codex Code Mode

Python 和 JavaScript 都能完成循环、并行、筛选和分支。工具编排能力取决于宿主授予的接口，以及运行结果如何接回 Agent。

| 能力 | Antigravity 原生 run_workflow | Codex Code Mode |
|---|---|---|
| 脚本语言 | Python，顶层 await | JavaScript，V8 隔离运行时 |
| 主要入口 | agent、parallel、pipeline、phase；提供 trajectory | tools.* 原生工具代理与工具目录 |
| 直接工具调用 | 文档中的 call_tool 以实际开放清单为前提；当前观察到的 2.33.0 环境未注入 | 宿主通过原生工具调度器执行嵌套调用 |
| 输出筛选 | print、log 后进入工具结果 | text、媒体输出与脚本内筛选 |
| 异步观察 | 原生后台工作流任务及取消 | cell ID、wait、分段输出与恢复运行 |
| 批准 | 工作流内部不能提出新的审批；尚未批准则 denied | 工具代理衔接原生审批流程，受原生策略限制 |
| 多 Agent 编排 | 原生支持 | Code Mode 工具目录与 Agent 协作分开 |

实际使用中，Antigravity 2.33.0 的工作流调用 `call_tool` 返回 `NameError: name 'call_tool' is not defined`。环境检查可见 `BudgetExceeded`、`CONVERSATION_ID`、`STEP_INDEX`、`WORKSPACES`、`agent`、`args`、`log`、`parallel`、`phase`、`pipeline`、`tokens_used`、`trajectory`、`with_budget`，未见 `call_tool`。

这一观察只适用于当时的版本和开放环境。内置 run-workflow 技能原文以 “Where the run_workflow tool description lists tools for call_tool” 为前提；其他版本应先检查实际工具清单。

本项目保留原生运行时，普通调用直接用原生工具；需要脚本时先检查宿主能力。JS 适配代码是实验性语法桥，无法补出宿主缺失的接口，目前不能用于真实原生工具调度。它也不提供 Codex 的 V8 cell、wait、store/load 或媒体支持，不通过额外 shell 或内部 RPC 替代宿主接口。

设计参考为 [openai/codex，076ac7856b1235947f271930bd7437bae54a0dfc](https://github.com/openai/codex/tree/076ac7856b1235947f271930bd7437bae54a0dfc)：`codex-rs/core/src/tools/code_mode/execute_spec.rs`、`delegate.rs`、`tool_definitions.rs`、`wait_handler.rs`、`codex-rs/code-mode-runtime`。Goal 参考 `codex-rs/ext/goal`。本插件采用本地续跑次数限制，没有实现 Codex 的精确 token 预算。
