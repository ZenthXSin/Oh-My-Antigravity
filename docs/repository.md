# 仓库与构建

项目名为 **Oh My Antigravity**，公开源码仓库为 [ZenthXSin/Oh-My-Antigravity](https://github.com/ZenthXSin/Oh-My-Antigravity)。初始开发分支为 `codex/oh-my-antigravity`。

源码按文件白名单收录：

- `frontend`：语言加载、语言设置、渠道配置、强度滑条和动态状态文案。
- `locales`：中文翻译词典。
- `tools`：前端分析、生成、归档及安装工具。
- `plugins/agent-workflow-zh`：规则、技能、提示词、Goal 状态和原生钩子。
- `packaging`：安装、卸载、前端提取、构建脚本和依赖清单。
- `integrations/antigrative-dashboard`：固定上游提交的运行所需源码、适配修改和原许可证。
- `integrations/channel-router`：自有渠道配置、四协议转换与桌面主 Agent 接入模块。
- 根目录许可证、第三方声明、依赖锁文件及维护文档。

`.gitignore` 默认忽略所有新文件，再逐个允许审核后的源码。新增源码时需更新对应白名单。原版应用及前端、生成前端、安装包、下载目录、编译器、`node_modules`、参考仓库、备份、检查截图、使用记录和个人配置均留在本机。

构建需要 Windows x64、可运行 npm 的 Node.js 和 Python 3.12 或兼容版本。先在仓库根目录安装固定依赖：

```powershell
npm ci
npm ci --prefix plugins/agent-workflow-zh
```

下载脚本准备固定版本的官方 Antigravity 安装器、Python embeddable 运行时、Node.js 运行时、许可证及 Inno Setup 编译器：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File packaging/fetch-dependencies.ps1
```

下载 URL 和固定 SHA256 在 `packaging/fetch-dependencies.ps1` 中定义；可执行依赖还需通过发布者数字签名校验。二进制文件保存在本机 `packaging/downloads`，编译器安装到 `packaging/inno`，均不进入源码仓库。构建时再次验证下载的依赖。

输入准备完成后运行：

```powershell
python packaging/build-package.py --node packaging/downloads/node.exe
```

重新构建已有暂存目录时使用脚本的 `--refresh` 参数。Node.js 来源可通过 `--node` 或 `AGY_NODE_EXE` 指定，编译器可通过 `--iscc` 或 `AGY_ISCC_EXE` 指定。使用固定下载的 Node.js 可保持运行时版本一致。

1.4.5 构建结果输出到 `dist/OhMyAntigravity-1.4.5-win-x64-setup.exe`，并生成 SHA256 文件及 `Install-OhMyAntigravity.cmd`、`launch-setup.ps1`。三份安装文件放在同一目录，可通过 CMD 选择可写临时目录后安装。构建完成后在实际 Windows 安装流程中验证：首次安装、已有 2.33.0 增强安装、中文／英文切换、主 Agent 渠道切换、强度滑条、原生工具审批、Dashboard 使用，以及卸载恢复。只有实际安装与操作覆盖的行为才作为已验证结论。后续源码修复已在真实 OpenAI Responses 渠道由用户确认连接正常，其余真实协议与模型尚未逐一验证；社区安装包自身未签名。

当前 1.4.5 构建产物为 217,544,541 bytes，SHA256 为 `1302cded049cbd0e29b8e64ad257bfc385645c396bd8386c4aa1671fc8fb7d57`。二进制产物及演练截图不进入源码仓库。已操作的原生应用验收范围见 [多渠道与模型设置](channel-routing.md)。

增强前端在安装时从接收者的官方应用中提取并生成。安装工具根据接收者的配置位置写入 MCP 绝对路径；源码 MCP 配置采用相对路径，不包含开发者的账户目录。

此版本只适配已审核的 2.33.0。上游应用更新后需重新核对前端结构与加载器，再生成新版本；不要把旧版资源套用到新版应用。
