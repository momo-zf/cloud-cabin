# 发布检查清单

以下以 `1.5.8` 为例。发布 `1.5.9` 等后续版本时，同步替换版本号、标签及附件文件名。以下命令供正式发布时使用。

1. 在本仓库之外构建并测试 `CloudCabin-1.5.8.zip` 和 `CloudCabin-Setup-1.5.8.exe`。用正版 Steam 版验证全新安装和原地升级，确认升级后存档及设置仍可使用。二进制产物只作为 Release 附件上传，切勿加入 Git。
2. 计算模组 ZIP 的 SHA-256 和字节数。[各系统计算方法](update-manifest.md)
3. 更新规范清单 `update/latest.json` 的 `version`、`notes_zh`、`sha256`、`size` 和 `zip_urls`。URL 列表以 GitHub Releases 为首项，已有的网盘镜像排在后面。将清单复制到根目录 `latest.json` 和 `docs/latest.json`，确认三份文件逐字节一致。检查 README 的安装程序文件名，将更新提交并推送到 `main`。

   ```sh
   cp update/latest.json latest.json
   cp update/latest.json docs/latest.json
   cmp update/latest.json latest.json && cmp update/latest.json docs/latest.json
   git add README.md update/latest.json latest.json docs/latest.json
   git commit -m "更新云上小屋 1.5.8 发布清单"
   git push origin main
   ```

4. 在仓库根目录，为刚推送的提交创建带注释的标签并推送标签。

   ```sh
   git tag -a v1.5.8 main -m "云上小屋 Cloud Cabin 1.5.8"
   git push origin v1.5.8
   ```

5. 切换到仓库外存放安装包的目录，准备中文 `notes.md`。发布说明、标签注释和附件名称一律使用公开名称，切勿写入内部代号。用 `gh` 创建 Release 并上传两个附件。

   **网站一键安装附件名**。安装程序构建产物为 `CloudCabin-Setup-1.5.8.exe`，GitHub Release 上的附件必须命名为 `CloudCabin-Setup.exe`。上传前将构建产物复制为固定名称，并在下方命令中用 `CloudCabin-Setup.exe` 作为安装程序参数。后续版本沿用此附件名。

   ```sh
   gh release create v1.5.8 \
     --repo momo-zf/cloud-cabin \
     --verify-tag \
     --title "云上小屋 Cloud Cabin 1.5.8" \
     --notes-file notes.md \
     CloudCabin-Setup-1.5.8.exe \
     CloudCabin-1.5.8.zip
   ```

6. 核对 Release 上的 ZIP 下载地址与 `zip_urls` 首项完全一致。检查正式镜像提供同一 ZIP，并核对 README 写明的安装程序文件名与 Release 附件一致。
7. 等待 GitHub Pages 完成构建，再确认 Pages 和根目录 Raw 地址都返回新版清单。[Pages 更新清单](https://momo-zf.github.io/cloud-cabin/latest.json) · [根目录 Raw 更新清单](https://raw.githubusercontent.com/momo-zf/cloud-cabin/main/latest.json)
