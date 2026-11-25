# IPTest 节点检测 · Surge 模块

Surge 面板显示当前节点出口 IP 的归属：国家 / 城市 / ISP / ASN / 时区 / 延迟。

数据来自 [iptest.us](https://iptest.us) 开放 API，无需 Key，限流 50 次/分钟/IP。

## 文件

- `iptest.sgmodule` — 模块文件，Surge 安装它
- `iptest-panel.js` — 面板脚本，先请求 `https://iptest.us/api/ip`，失败时用 `https://iptest.us/api/geoip` 备用

## 安装（GitHub 托管）

1. 在 GitHub 新建一个 **Public** 仓库，名字就叫 `surge-iptest`，不要勾选 README。
2. 把 `iptest.sgmodule` 和 `iptest-panel.js` 两个文件上传到这个仓库（Add file → Upload files），点 Commit。
3. 模块安装链接就是：
   `https://raw.githubusercontent.com/weifanglbj/surge-iptest/main/iptest.sgmodule`
   （把 `weifanglbj` 换成你自己的 GitHub 用户名，仓库名 / 分支名不一样也照着改）
4. Surge → 模块 → 安装新模块 → 粘贴上面那个链接 → 好的。
5. 回到 Surge 首页，面板里会出现“IPTest 节点检测”，点一下就刷新。

## 用法

- 切换节点后，点一下面板，就能看到新节点的出口 IP 在哪个国家、哪个城市、哪个 ISP。
- 面板每小时自动刷新一次，平时不用管。
- 如果面板显示的是国内直连 IP，说明 `iptest.us` 没走代理，在配置里加一条规则：`DOMAIN,iptest.us,节点选择`（策略组名按你自己的改）。
