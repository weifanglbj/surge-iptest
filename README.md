# Surge 节点检测模块

本仓库包含两个可独立安装的 Surge 模块：

## 1. IPTest 节点检测

面板显示当前节点出口 IP 的国家 / 城市 / ISP / ASN / 时区 / 延迟，以及 IP 纯净度信息。

安装链接：

`https://raw.githubusercontent.com/weifanglbj/surge-iptest/main/iptest.sgmodule`

## 2. 节点网速测试

面板会通过当前 Surge 选中的节点进行测试，包含：

- 204 探测延迟
- 1 MB 下载速度
- 5 MB 下载速度
- 10 MB 下载速度
- Cloudflare 不可用时自动回退到 Apple CDN
- 某个大文件失败时保留已经完成的结果

安装链接：

`https://raw.githubusercontent.com/weifanglbj/surge-iptest/main/speedtest.sgmodule`

测速只下载测试数据，不上传用户内容。结果受当前网络、节点负载、测速服务器和 Surge 策略影响，适合比较节点，不等同于宽带满速。

建议为以下域名配置到需要测试的节点策略组：

- `speed.cloudflare.com`
- `www.gstatic.com`
- `cp.cloudflare.com`
- `mensura.cdn-apple.com`

## 安装

1. 打开 Surge → 模块 → 安装新模块。
2. 粘贴对应的 Raw 链接。
3. 安装后回到首页，在面板中点击刷新。
4. 切换节点后再次刷新，即可对比不同节点的结果。
