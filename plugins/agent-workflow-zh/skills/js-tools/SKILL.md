---
name: js-tools
description: 实验性 JS 工具编排适配，仅在用户明确要求 JavaScript 且原生 run_workflow 实际开放 call_tool 时使用。本机 2.33.0 验收会话未开放，当前不可用于真实工具执行。
---

这是实验性语法适配，不能补出宿主缺失的 call_tool。本机 2.33.0 实测未开放此桥接能力，当前直接使用正常原生工具；不要尝试以子进程、内部 RPC 或额外 MCP 终端绕过。

宿主确实提供 call_tool 时，JavaScript 在 QuickJS/WASM 中执行，通过 Python 桥转给当前会话的原生 `run_workflow` 的 `call_tool`。脚本只获得 `tools.*`、`ALL_TOOLS`、`text()` 和 `console.log()`；没有 Node、文件系统、网络、process 或 require。

执行步骤：

1. 检查当前 `run_workflow` 工具说明，确定 `call_tool` 真正可调用的工具名及参数。只选本次需要的工具，不能猜测名称或使用另一个会话的工具。需要额外批准的调用会被原生工作流拒绝；遇到 denied 回到正常原生工具审批。
2. 原生 `run_workflow` 参数：`ScriptPath` 指向本技能目录上两级的 `runtime/js-workflow.py` 的绝对路径，`Description` 为任务说明，`WaitMsBeforeAsync=10000`；`Args` 包含 `source`、`tools` 和可选 `timeout_ms`、`max_output_chars`。
3. `tools` 是本轮需要的 `{name, description}` 列表，名称取自当前原生工作流工具说明；JS 属性将非字母数字下划线替换成 `_`。`ALL_TOOLS` 包含 `name`、`binding`、`description`。
4. 每个 `tools.<binding>(args)` 返回 Promise；结果采用原生 `call_tool` 的输出字符串，按需要 `JSON.parse`。只用 `text` 输出有用片段。await 所有需要的调用；未 await 的请求在脚本结束时取消。
5. 原生工作流可能返回后台任务句柄；使用该会话提供的真实任务状态工具继续观察，不重复运行脚本。需要用户批准时使用普通原生工具，批准后再编排已获准的调用。

Args 示例（工具名与参数必须先核对当前会话）：

```json
{
  "source": "const results=await Promise.allSettled([tools.run_command({CommandLine:'rg --files',Cwd:'E:/my-project',WaitMsBeforeAsync:1000})]); for(const r of results) text(r.status==='fulfilled'?r.value:r.reason.message);",
  "tools": [{"name":"run_command","description":"当前会话原生终端工具"}],
  "timeout_ms": 120000,
  "max_output_chars": 16000
}
```

独立读取可 `Promise.allSettled`；写操作、依赖步骤和审批串行。失败应暴露原因，不静默当作成功。长命令跟踪原生命令 ID；等待超时不重新启动。

当前适配不提供 Codex 的 V8 cell、`functions.wait`、`yield_control`、store/load、多媒体输出或自动注入完整工具 catalog。后台观察、调用记录、权限和取消仍由原生工作流负责。JS 单次上限 180 秒、64 个调用、32 MiB 内存；通过 native run_workflow 的停止操作取消。
