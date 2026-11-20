$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskPlugin = Join-Path $env:USERPROFILE '.gemini\config\plugins\agent-workflow-zh'
$taskSource = Join-Path $taskRoot 'plugins\agent-workflow-zh'
New-Item -ItemType Directory -Force -Path $taskPlugin | Out-Null
Copy-Item -Path (Join-Path $taskSource '*') -Destination $taskPlugin -Recurse -Force
$taskMcpFile = Join-Path $taskPlugin 'mcp_config.json'
$taskMcp = Get-Content -LiteralPath $taskMcpFile -Raw | ConvertFrom-Json -AsHashtable
$taskMcp.mcpServers.workflow.args = @((Join-Path $taskPlugin 'runtime\server.mjs'))
[System.IO.File]::WriteAllText($taskMcpFile, ($taskMcp | ConvertTo-Json -Depth 20), [System.Text.UTF8Encoding]::new($false))
$taskConfigPath = Join-Path $env:USERPROFILE '.gemini\config\config.json'
$taskConfig = Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json -AsHashtable
if (-not $taskConfig.ContainsKey('plugins')) { $taskConfig.plugins = @{} }
if (-not $taskConfig.plugins.ContainsKey('agent-workflow-zh')) { $taskConfig.plugins['agent-workflow-zh'] = @{} }
$taskConfig.plugins['agent-workflow-zh'].enabled = $true
[System.IO.File]::WriteAllText($taskConfigPath, ($taskConfig | ConvertTo-Json -Depth 100), [System.Text.UTF8Encoding]::new($false))
Write-Output 'Agent 工作流插件已安装并启用'
