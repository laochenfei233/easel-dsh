# Easel-dsh 官网与更新源部署

产品官网是纯静态页面：更新日志在构建时从根目录 `CHANGELOG.md` 解析并写入 HTML，页面运行时不发任何第三方请求；下载区在镜像数据存在时给出同域直链与 sha256，否则自动降级为 GitHub Release 链接。同一套产物既是产品页，也是应用内更新器的分发点（`/updates/latest.json`）。

## 目录结构

```
site/
  index.template.html            页面模板（占位符由构建脚本填充）
  assets/                        样式、画架主视觉、站点图标
  tools/build-releases.mjs       CHANGELOG.md → releases.json
  tools/build-site.mjs           模板 + 数据 → dist/
  tools/*.test.mjs               解析与渲染测试
  server/sync-releases.mjs       GitHub Release → 站点镜像 + latest.json
  server/sync-releases.test.mjs  同步器决策与失败路径测试
  server/easel-releases.service  systemd 单元（Type=oneshot）
  server/easel-releases.timer    15 分钟同步节奏
  server/nginx.easel.conf.example
```

## 本地构建

```sh
node site/tools/build-site.mjs                    # → site/dist（无镜像数据，下载区走 GitHub 兜底）
node site/tools/build-releases.mjs                # 单独生成 site/dist/data/releases.json
node site/tools/build-site.mjs --downloads site/data/downloads.json --out-dir site/dist   # 带镜像直链
node --test "site/**/*.test.mjs"                  # 解析、渲染、同步器测试
python3 -m http.server -d site/dist 8080          # 本地预览
```

`--source` 默认使用仓库根的 `CHANGELOG.md`；`--downloads` 指向镜像产出的 `downloads.json`，文件不存在时按“无镜像”渲染。

## 发布前置条件（发布管道侧）

1. `apps/desktop-tauri/src-tauri/tauri.conf.json` 的 `bundle.createUpdaterArtifacts` 必须为 `true`（本仓库已开启），否则 `pnpm tauri build` 不产出 `.sig`，应用内更新无法验签。
2. GitHub Actions secrets 需要 `TAURI_SIGNING_PRIVATE_KEY`（minisign 私钥全文）。本机私钥位于 `~/.easel-updater/easel-updater.key`，无口令；如重设口令，再设置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。私钥不得入库，公钥已在 `plugins.updater.pubkey`。
3. Release 必须处于已发布状态：`desktop-release.yml` 默认创建 draft，需在 GitHub 页面点 Publish release。同步器只接受 `draft=false && prerelease=false` 的版本。
4. 轮换签名密钥等于同时更新 `plugins.updater.pubkey` 与 CI secret；旧版本客户端无法验签新包，属于破坏性变更。

## GitHub Pages（境外兜底）

页面用相对路径引用资源，可以部署在子路径（例如 `/easel-dsh/`）。没有 `downloads.json` 时下载区自动显示 GitHub Release 链接，因此 Pages 只作产品页兜底。

```yaml
name: Deploy product site
on:
  push:
    branches: [master]
    paths: ['CHANGELOG.md', 'site/**']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node site/tools/build-site.mjs --out-dir site/dist
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site/dist
      - id: deploy
        uses: actions/deploy-pages@v4
```

Pages 不能承载安装包（GitHub 单文件上限 100 MB，站点上限 1 GB），所以更新源必须指向真正的镜像域名。上线前把 `tauri.conf.json` 的 `plugins.updater.endpoints` 改成实际分发地址（例如 `https://easel.example.cn/updates/latest.json`）；当前仓库里的 Pages 地址只是占位。

## 国内服务器

前置是域名、ICP 备案与 80/443 端口；备案完成前可以先用非标准端口对外，域名与证书流程不变。

```sh
useradd --system --home /srv/easel-site --shell /usr/sbin/nologin easel
mkdir -p /srv/easel-site/src /srv/easel-site/web
chown -R easel:easel /srv/easel-site
```

`src` 只放源码（`CHANGELOG.md` 与 `site/`），`web` 是 nginx root，同步器与构建脚本都写这里：

```sh
rsync -a --delete --exclude site/dist --exclude site/data ./ /srv/easel-site/src/
chown -R easel:easel /srv/easel-site/src
```

环境文件 `/etc/easel-releases.env`（`chmod 600`）：

```sh
EASEL_WEBROOT=/srv/easel-site/web
EASEL_ORIGIN=https://easel.example.cn
EASEL_REPO=laochenfei233/easel-dsh
EASEL_KEEP_VERSIONS=3
# GITHUB_TOKEN=ghp_xxx                     # 拉 API 的限流额度更高
# NODE_USE_ENV_PROXY=1                     # Node 24；配合 HTTPS_PROXY 走代理
# HTTPS_PROXY=http://127.0.0.1:7890
```

安装并启用 systemd 单元（每次成功同步后自动重建页面，保证下载卡与镜像版本一致）：

```sh
install -m 644 site/server/easel-releases.service /etc/systemd/system/
install -m 644 site/server/easel-releases.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now easel-releases.timer
systemctl start easel-releases.service
journalctl -u easel-releases.service -f
```

nginx 使用 `site/server/nginx.easel.conf.example`（把域名换成真实值），证书：

```sh
certbot --nginx -d easel.example.cn
```

首次构建（同步器还没跑过时也没有 `downloads.json`，下载区自动降级）：

```sh
sudo -u easel node /srv/easel-site/src/site/tools/build-site.mjs \
  --source /srv/easel-site/src/CHANGELOG.md \
  --out-dir /srv/easel-site/web
```

验收：

```sh
curl -fsS https://easel.example.cn/updates/latest.json | head -20
curl -fsSI https://easel.example.cn/updates/latest.json | grep -i cache-control   # no-cache
curl -fsSI https://easel.example.cn/releases/<版本>/<安装包>.exe | grep -i cache-control  # immutable
```

## 行为与不变量

- 指针只前移：同步器只接受比当前 `latest.json` 更高的 semver，重发旧版本不会回退指针。
- 原子切换：所有安装包落盘并算出 sha256 后，先写 `downloads.json`，最后写 `latest.json`（write-then-rename）。
- 失败不破坏：下载、校验或签名为空都会中止，指针保持原样，下一拍重试；半成品只存在于尚未被引用的版本目录里。
- 保留窗口：`EASEL_KEEP_VERSIONS`（默认 3）个版本，清理发生在指针切换成功之后，不会删当前版本。
- 只同步已发布版本：draft 与 prerelease 一律跳过，列表顺序不作数（按 semver 取最高）。

## 回滚

制品按版本保留。回滚是把 `latest.json` 手工改回旧版本：复制旧版的 `version`、`pub_date`、`platforms` 字段（`url` 指向仍存在的版本目录），保持 JSON 合法即可，应用下一轮检查就会按旧指针工作。不要删除版本目录，否则旧链接与回滚点一起消失。

## 内网 / 自建镜像

同一目录布局可以整体复制到内网机（`releases/`、`updates/`、页面产物一起搬）。在应用数据目录放 `update-source.json`，内容为 `{"endpoints":["https://intranet.example/updates/latest.json"]}`，应用即改读内网源。签名公钥不变，因此镜像必须原样搬运 GitHub Release 的 `.sig` 与安装包，不能重新打包。

## 已知边界

- 安装包没有 Authenticode 签名，Windows 会提示“未知发布者”；更新签名（minisign）只保证分发内容未被篡改。
- 页面文案是中文单语，英文切换位留在模板结构里（导航与正文均为独立块），未接入构建。
- 同步器只镜像 Windows NSIS 安装包；macOS/Linux 产物与更新源不在本期范围。
