/*
 * Surge 稳定版节点网速面板
 *
 * Surge $httpClient 不支持流式读取，因此使用一次 3 MB 完整响应测速，
 * 避免 5 MB / 10 MB 大响应在低速节点上超时或被限制。
 */

const PACKET_BYTES = 3 * 1024 * 1024
const DOWNLOAD_URL = 'https://speed.cloudflare.com/__down?bytes=' + PACKET_BYTES
const PING_URL = 'https://cp.cloudflare.com/generate_204'
const TIMEOUT = 60

function get(url, timeout) {
  return new Promise(function (resolve, reject) {
    const started = Date.now()
    $httpClient.get({
      url: url + (url.indexOf('?') >= 0 ? '&' : '?') + 'surge_stable_speedtest=' + started,
      timeout: timeout,
      headers: {
        'User-Agent': 'Surge Stable SpeedTest',
        'Cache-Control': 'no-cache'
      }
    }, function (error, response, data) {
      const elapsed = Date.now() - started
      if (error) return reject(new Error('请求超时或网络错误'))
      if (!response || response.status < 200 || response.status >= 400) {
        return reject(new Error('HTTP ' + (response && response.status)))
      }
      resolve({ elapsed: elapsed, data: data || '' })
    })
  })
}

function mbps(bytes, milliseconds) {
  return bytes * 8 / milliseconds / 1000
}

function mbPerSecond(bytes, milliseconds) {
  return bytes / milliseconds / 1000
}

function kbPerSecond(bytes, milliseconds) {
  return bytes / milliseconds
}

function speedColor(value) {
  if (value >= 50) return '#30D158'
  if (value >= 10) return '#FF9F0A'
  return '#FF453A'
}

;(async function () {
  const panel = {
    title: '节点网速',
    content: '正在测试 3 MB…',
    icon: 'speedometer',
    'icon-color': '#0A84FF'
  }

  try {
    const ping = await get(PING_URL, 15)
    const download = await get(DOWNLOAD_URL, TIMEOUT)
    const valueMbps = mbps(PACKET_BYTES, download.elapsed)
    const valueMBs = mbPerSecond(PACKET_BYTES, download.elapsed)
    const valueKBs = kbPerSecond(PACKET_BYTES, download.elapsed)

    panel.title = '节点网速 · ' + valueMbps.toFixed(2) + ' Mbps'
    panel.content = [
      '测速文件  3 MB',
      '下载速度  ' + valueMbps.toFixed(2) + ' Mbps',
      '实际速度  ' + valueMBs.toFixed(2) + ' MB/s',
      '实际速度  ' + valueKBs.toFixed(0) + ' KB/s',
      '延迟      ' + ping.elapsed + ' ms',
      '耗时      ' + (download.elapsed / 1000).toFixed(2) + ' 秒',
      '',
      '测速源    Cloudflare',
      '仅下载，不上传数据'
    ].join('\n')
    panel['icon-color'] = speedColor(valueMbps)
  } catch (e) {
    panel.title = '节点网速 · 失败'
    panel['icon-color'] = '#FF453A'
    panel.content = '测速失败\n' + (e.message || '请求超时或网络错误') + '\n请切换节点后重试'
  } finally {
    $done(panel)
  }
})()
