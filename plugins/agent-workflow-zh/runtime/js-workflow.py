"""Entry ScriptPath for native run_workflow; call_tool is provided by the host."""
import asyncio
import json
import os
from pathlib import Path
import shutil


async def run_js(config, native_call, native_log):
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node.js is unavailable')
    entry = globals().get('__file__', str(Path.home()/'.gemini/config/plugins/agent-workflow-zh/runtime/js-workflow.py'))
    worker = Path(entry).with_name('js-worker.mjs')
    tools = config.get('tools', [])
    if not isinstance(tools, list) or any(not isinstance(t, dict) or not isinstance(t.get('name'), str) for t in tools):
        raise ValueError('tools must contain the actual native workflow tool names')
    allowed = {t['name'] for t in tools}
    proc = await asyncio.create_subprocess_exec(
        node, str(worker), stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        limit=1500000,
        creationflags=0x08000000 if os.name == 'nt' else 0,
    )
    tasks = set()
    write_lock = asyncio.Lock()
    error = None
    completed = False

    async def send(message):
        async with write_lock:
            proc.stdin.write((json.dumps(message, ensure_ascii=False)+'\n').encode('utf8'))
            await proc.stdin.drain()

    async def invoke(message):
        name, arguments = message['name'], message['args']
        response = {'id': message['id']}
        try:
            if name not in allowed or name in ('run_workflow', 'finish') or not isinstance(arguments, dict):
                raise ValueError('Invalid native tool call')
            result = await native_call(name, **arguments)
            if isinstance(result, str) and len(result) > 1000000:
                result = result[:1000000]+'\n[Native tool output truncated at 1M characters]'
            response['result'] = result
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            response['error'] = {'message': str(exc), 'denied': getattr(exc, 'denied', False) is True}
        await send(response)

    try:
        await send(config)
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            message = json.loads(line)
            if message['type'] == 'call':
                task = asyncio.create_task(invoke(message))
                tasks.add(task)
            elif message['type'] == 'text':
                native_log(message['text'])
            elif message['type'] == 'error':
                error = message['message']
            elif message['type'] == 'done':
                completed = True
                if message.get('discardedPendingCalls'):
                    native_log('Unawaited tool calls cancelled: '+str(message['discardedPendingCalls']))
                break
        # A workflow never leaves requests running after JS completion.
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if error:
            raise RuntimeError(error)
        if not completed:
            raise RuntimeError('JS worker closed before a completion result')
        if proc.returncode not in (None, 0):
            raise RuntimeError('JS worker exited before completion')
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if proc.returncode is None:
            proc.terminate()
        await proc.wait()


# run_workflow supports top-level await and supplies these native primitives.
if 'call_tool' not in globals():
    raise RuntimeError('Native run_workflow has not exposed call_tool; use normal native tools. The JS adapter cannot provide this missing host capability.')
await run_js(args, call_tool, log)
