/*
 * Surge 节点网速测试面板
 *
 * 请求会遵循 Surge 当前选中的策略/节点。
 * 测试内容：204 探测延迟 + 1 MB / 5 MB 下载速度。
 * 测速文件来自 Cloudflare speed test，不上传任何数据。
 */

const PING_URL = 'https://www.gstatic.com/generate_204'
const DOWNLOAD_URL = 'https://speed.cloudflare.com/__down?bytes='
const SAMPLES = [1000000, 5000000]

function request(url, timeout) {
  return new Promise(function (resolve, reject) {
    const started = Date.now()
    $httpClient.get({
      url: url + (url.indexOf('?') >= 0 ? '&' : '?') + '_surge_speedtest=' + started,
      timeout: timeout,
      headers: {
        'User-Agent': 'Surge SpeedTest Panel',
        'Cache-Control': 'no-cache'
      }
    }, function (error, response, data) {
      const elapsed = Date.now() - started
      if (error) return reject(error)
      if (!response || (response.status < 200 || response.status >= 400)) {
        return reject(new Error('HTTP ' + (response && response.status)))
      }
      resolve({ elapsed: elapsed, data: data || '' })
    })
  })
}

function formatMbps(bytes, milliseconds) {
  if (!milliseconds) return '—'
  return (bytes * 8 / milliseconds / 1000).toFixed(2) + ' Mbps'
}

function formatSize(bytes) {
  return bytes >= 1000000 ? (bytes / 1000000).toFixed(0) + ' MB' : Math.round(bytes / 1000) + ' KB'
}

;(async function () {
  const panel = {
    title: '节点网速',
    content: '正在测试…',
    icon: 'speedometer',
    'icon-color': '#0A84FF'
  }

  try {
    const ping = await request(PING_URL, 10)
    const results = []

    for (let i = 0; i < SAMPLES.length; i++) {
      const bytes = SAMPLES[i]
      try {
        const download = await request(DOWNLOAD_URL + bytes, 30)
        results.push({ bytes: bytes, elapsed: download.elapsed })
      } catch (e) {
        // 小文件成功但大文件失败时，仍显示已有测速结果。
      }
    }

    if (!results.length) throw new Error('download failed')

    const lines = [
      '延迟    ' + ping.elapsed + ' ms',
      ''
    ]
    results.forEach(function (item) {
      lines.push(formatSize(item.bytes) + '   ' + formatMbps(item.bytes, item.elapsed))
    })
    lines.push('', '节点网速测试', '数据来自 speed.cloudflare.com')

    const fastest = results[results.length - 1]
    const mbps = fastest.bytes * 8 / fastest.elapsed / 1000
    panel.title = '节点网速 · ' + mbps.toFixed(2) + ' Mbps'
    panel.content = lines.join('\n')
    panel['icon-color'] = mbps >= 50 ? '#30D158' : (mbps >= 10 ? '#FF9F0A' : '#FF453A')
  } catch (e) {
    panel.title = '节点网速 · 失败'
    panel['icon-color'] = '#FF453A'
    panel.content = '测速失败\n请确认节点可访问公网\n或稍后再试'
  } finally {
    $done(panel)
  }
})()
