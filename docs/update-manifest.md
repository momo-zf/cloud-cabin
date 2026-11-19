# 更新清单

`latest.json` 是安装程序读取的 UTF-8 JSON。以下五个字段均为必填，发布时保持字段名和类型稳定。

| 字段 | JSON 类型 | 含义 |
| --- | --- | --- |
| `version` | 字符串 | 模组版本，采用 `major.minor.patch` 形式，例如 `1.5.8`。比较时依次按主版本、次版本、修订号的数值比较，规则类似语义化版本。 |
| `zip_urls` | 字符串数组 | 同一模组 ZIP 的下载地址。首项是 GitHub Releases，随后列出网盘镜像。 |
| `sha256` | 字符串 | `CloudCabin-x.y.z.zip` 文件的 SHA-256，使用 64 位小写十六进制字符。 |
| `size` | 整数 | 同一模组 ZIP 的文件大小，单位为字节。 |
| `notes_zh` | 字符串 | 安装程序可显示的简短中文版本说明。 |

`sha256` 和 `size` 均用于校验下载的模组 ZIP。安装程序 `CloudCabin-Setup-x.y.z.exe` 是单独的发布附件。

仓库初始化时，`1.5.8` 的 Release 附件尚未创建。清单中的 GitHub ZIP 地址预留给正式发布，`example.com` 项仅用于占位，待网盘镜像公布后替换。

## 同步路径和访问地址

每次修改先更新 `update/latest.json`，再将其原样复制到 `latest.json` 和 `docs/latest.json`。三份文件须逐字节一致，并在同一提交中更新。

| 仓库路径 | 用途 | 地址 |
| --- | --- | --- |
| `update/latest.json` | 规范清单 | [规范清单 Raw 地址](https://raw.githubusercontent.com/momo-zf/cloud-cabin/main/update/latest.json) |
| `latest.json` | 安装程序备用入口 | [仓库根目录 Raw 地址](https://raw.githubusercontent.com/momo-zf/cloud-cabin/main/latest.json) |
| `docs/latest.json` | 安装程序首选入口 | [GitHub Pages 清单地址](https://momo-zf.github.io/cloud-cabin/latest.json) |

安装程序先请求 GitHub Pages 地址，失败时再请求仓库根目录的 Raw 地址。

## 计算模组 ZIP 的 SHA-256 和字节数

在存放模组 ZIP 的目录中运行对应命令。将哈希写为小写字符串，将字节数写为 JSON 整数。

### Linux

```sh
sha256sum CloudCabin-1.5.8.zip
stat -c '%s' CloudCabin-1.5.8.zip
```

### macOS

```sh
shasum -a 256 CloudCabin-1.5.8.zip
stat -f '%z' CloudCabin-1.5.8.zip
```

### Windows（PowerShell）

```powershell
(Get-FileHash -LiteralPath 'CloudCabin-1.5.8.zip' -Algorithm SHA256).Hash.ToLowerInvariant()
(Get-Item -LiteralPath 'CloudCabin-1.5.8.zip').Length
```
