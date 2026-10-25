# 第三方组件与字体

本项目自有代码的许可及个人创作补充授权不改变下列组件的原许可证。包管理器安装的第三方文件保留各自 LICENSE/NOTICE；本清单不将第三方代码重新许可。

| 组件 | 使用方式 | 原许可与来源 |
| --- | --- | --- |
| React / React DOM | 界面运行时 | MIT；https://github.com/facebook/react |
| Next.js | 开发、构建及静态导出 | MIT；https://github.com/vercel/next.js |
| Tiptap 开源核心与本仓库使用的公开扩展 | 手动富文本编辑器；不使用其收费扩展或托管服务 | MIT；https://github.com/ueberdosis/tiptap |
| TypeScript | 开发与类型检查 | Apache-2.0；https://github.com/microsoft/TypeScript |
| fake-indexeddb | 仅用于本地数据测试 | Apache-2.0；https://github.com/dumbmatter/fakeIndexedDB |
| Inter 4.001 | 随项目自托管、未修改的字体 | SIL OFL 1.1；见 public/fonts/Inter-OFL.txt |
| Noto Sans SC 2.004 | 随项目自托管的完整字库 WOFF2 | SIL OFL 1.1；见 public/fonts/NotoSansSC-OFL.txt |

Inter 来源：Google Fonts 官方 `ofl/inter/Inter[opsz,wght].ttf`，原文件 SHA256 `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`。

Noto Sans SC 来源：Google Fonts 官方 `ofl/notosanssc/NotoSansSC[wght].ttf`，原 TTF SHA256 `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`；完整字库经 fonttools 4.66.1、brotli 1.2.0 转为 WOFF2，保留完整 cmap，WOFF2 SHA256 `aef8c34277afad81ecd0227138a830263c0caea65b7aea66d1195395f097b55a`。字体许可声明随字体保留。

图形图标为此候选新写的基础 SVG 线条，不含其他产品的品牌图案。示例文字由本项目新写，不使用真实采集作品、文章、视频或用户笔记。

运行 `pnpm licenses:inventory` 可从已安装包生成 `licenses/dependencies.json`。清单包含开发和构建依赖，不代表每个包都进入浏览器静态产物；实际发布范围还需结合待发文件和静态输出核对。
