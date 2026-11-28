# Surge 节点检测模块

本仓库包含两个可独立安装的 Surge 模块：

## 1. IPTest 节点检测

面板显示当前节点出口 IP 的国家 / 城市 / ISP / ASN / 时区 / 延迟，以及 IP 纯净度信息。

安装链接：

`https://raw.githubusercontent.com/weifanglbj/surge-iptest/main/iptest.sgmodule`

## 2. 节点网速测试

面板会通过当前 Surge 选中的节点访问 Cloudflare Speed Test，测试：

- 连接延迟
- 1 MB 下载速度
- 5 MB 下载速度

安装链接：

`https://raw.githubusercontent.com/weifanglbj/surge-iptest/main/speedtest.sgmodule`

测速文件来自 `speed.cloudflare.com`，只下载数据，不上传用户内容。测速结果受当前网络、节点负载、测速服务器和 Surge 策略影响，仅供节点横向对比，不等同于宽带满速。

## 安装

1. 打开 Surge → 模块 → 安装新模块。
2. 粘贴对应的 Raw 链接。
3. 安装后回到首页，在面板中点击刷新。
4. 如需确保测速走代理，请为 `speed.cloudflare.com` 添加到对应的节点策略组。
