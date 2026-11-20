# 第三方声明

根目录 MIT 许可证适用于 Oh My Antigravity 的自有改造代码与翻译。以下组件保留各自的版权、许可证和使用条款。

| 组件 | 来源及版本 | 说明 |
|---|---|---|
| Antigravity | 官方 Windows x64 2.33.0 安装器 | 原厂软件，适用官方条款。未经修改的安装器只在构建时获取并放入安装包，不进入源码仓库；补丁在接收者安装时基于原版资源生成。 |
| Antigrative Dashboard | [ATtacK030130/antigrative-dashboard](https://github.com/ATtacK030130/antigrative-dashboard/tree/15138b3417bf4f45a02fab7569c5f45e4135cd88)，0.9.10 | MIT；选取的源码和原版权声明位于 `integrations/antigrative-dashboard`。包含适配 Windows 偏好保存的修改。 |
| Codex | [openai/codex](https://github.com/openai/codex/tree/076ac7856b1235947f271930bd7437bae54a0dfc) | Apache-2.0 的设计参考；未收录其模型客户端或运行时。 |
| Acorn、Acorn Walk | 版本由根目录 `package-lock.json` 固定 | MIT；构建时安装，运行包保留依赖版权和许可证。 |
| QuickJS / quickjs-emscripten | 版本由 Agent 插件 `package-lock.json` 固定 | MIT；用于实验性 JS 桥，相关许可证随安装依赖保留。 |
| Node.js | 官方 Windows x64 24.14.1 运行时；构建也支持指定其他来源 | Node.js 及其依赖的许可证随运行时一起分发。 |
| CPython | 官方 Windows embeddable 3.12.10 | Python 许可证随运行时一起分发。 |
| Inno Setup | 安装包编译工具 | 适用 Inno Setup 原许可证；编译器不进入源码仓库。 |
| Inno Setup 简体中文翻译 | [kira-96/Inno-Setup-Chinese-Simplified-Translation](https://github.com/kira-96/Inno-Setup-Chinese-Simplified-Translation) | `packaging/ChineseSimplified.isl` 保留原维护者及来源声明。 |
