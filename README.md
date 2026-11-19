# 云上小屋 Cloud Cabin

云上小屋是 Steam 游戏 Nomad Drive（App ID `2223980`）的单机模组，侧重改善游玩体验和家园布置。[Steam 游戏页面](https://store.steampowered.com/app/2223980/)

## 推荐：一键安装程序

1. 确认已安装正版 Steam 版 Nomad Drive，并退出游戏。
2. 安装程序发布后，从本仓库的发布附件下载 `CloudCabin-Setup-*.exe`（1.5.8 版文件名为 `CloudCabin-Setup-1.5.8.exe`）。[GitHub Releases](https://github.com/momo-zf/cloud-cabin/releases)
3. 双击运行。安装程序会查找 Steam 游戏目录，在缺少 BepInEx 时安装官方版本，然后安装云上小屋。
4. 升级时，退出游戏并运行新版安装程序，即可原地更新并保留存档和设置。

## 手动安装

1. 将官方 BepInEx 5 x64（Unity Mono 版）解压到游戏根目录。启动游戏一次以初始化 BepInEx，然后退出游戏。[BepInEx 5 官方安装指南](https://docs.bepinex.dev/v5.4.21/articles/user_guide/installation/index.html)
2. 从 Nexus 下载模组压缩包（Nexus 页面链接待公布）。
3. 将插件解压到游戏目录下的 `BepInEx/plugins/CloudCabin`，保留包内目录结构。

网盘下载（链接待公布）。

## 常见问题

- **Windows SmartScreen 提示或显示「未知发布者」怎么办？** 安装程序未做代码签名。确认文件来自本仓库的 GitHub Releases 后，若 SmartScreen 拦截，可点击「更多信息」，再点击「仍要运行」。
- **支持联机吗？** 云上小屋仅支持单机游玩。
- **需要哪个版本的游戏？** 需要正版 Steam 版 Nomad Drive。
- **可以在游戏运行时安装或更新吗？** 请先完全退出游戏，再安装或更新。

## 致谢

云上小屋使用 BepInEx 团队维护的官方插件加载器。BepInEx 采用 LGPL 许可，本仓库未收录其安装包。[BepInEx 官方项目](https://github.com/BepInEx/BepInEx)

[云上小屋网站](https://momo-zf.github.io/cloud-cabin/)
