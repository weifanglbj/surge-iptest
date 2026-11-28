/*
 * Surge 节点网速测试面板
 *
 * 所有请求都由 Surge 发出，因此会遵循当前策略/节点。
 * 测试：延迟 + 1 MB / 5 MB / 10 MB 下载速度。
 * Cloudflare 不可用时自动切换 Apple CDN；不上传任何用户数据。
 */

const PING_URLS = [
  'https://www.gstatic.com/generate_204',
  'https://cp.cloudflare.com/generate_204'
]
const DOWNLOAD_URLS = [
  'https://speed.cloudflare.com/__down?bytes=',
  'https://mensura.cdn-apple.com/api/v1/gm/large?bytes='
]
const SAMPLES = [1000000, 5000000, 10000000]
const REQUEST_TIMEOUT = 30

function request(url, timeout) {
  return new Promise(function (resolve, reject) {
    const started = Date.now()
    const separator = url.indexOf('?') >= 0 ? '&' : '?'
    $httpClient.get({
      url: url + separator + '_surge_speedtest=' + started,
      timeout: timeout,
      headers: {
        'User-Agent': 'Surge Node SpeedTest',
        'Cache-Control': 'no-cache'
      }
    }, function (error, response, data) {
      const elapsed = Date.now() - started
      if (error) return reject(error)
      if (!response || response.status < 200 || response.status >= 400) {
        return reject(new Error('HTTP ' + (response && response.status)))
      }
      resolve({ elapsed: elapsed, data: data || '' })
    })
  })
}

async function firstSuccess(urls, timeout) {
  let lastError
  for (let i = 0; i < urls.length; i++) {
    try {
      return await request(urls[i], timeout)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('request failed')
}

function formatMbps(bytes, milliseconds) {
  if (!milliseconds) return '—'
  return (bytes * 8 / milliseconds / 1000).toFixed(2) + ' Mbps'
}

function formatSize(bytes) {
  return (bytes / 1000000).toFixed(0) + ' MB'
}

function speedColor(mbps) {
  if (mbps >= 50) return '#30D158'
  if (mbps >= 10) return '#FF9F0A'
  return '#FF453A'
}

;(async function () {
  const panel = {
    title: '节点网速',
    content: '正在测试…',
    icon: 'speedometer',
    'icon-color': '#0A84FF'
  }
  const results = []
  let source = ''
  let latency = null

  try {
    // 延迟只取成功请求，第一地址失败会自动使用备用地址。
    const ping = await firstSuccess(PING_URLS, 10)
    latency = ping.elapsed

    for (let i = 0; i < SAMPLES.length; i++) {
      const bytes = SAMPLES[i]
      try {
        const urls = DOWNLOAD_URLS.map(function (base) { return base + bytes })
        const download = await firstSuccess(urls, REQUEST_TIMEOUT)
        results.push({ bytes: bytes, elapsed: download.elapsed })
        source = download.url || (download.fromApple ? 'Apple CDN' : 'Cloudflare / Apple CDN')
      } catch (e) {
        // 保留已完成的项目，避免单个大文件失败导致整个面板无结果。
      }
    }

    if (!results.length) throw new Error('download failed')

    const lines = [
      '延迟    ' + (latency === null ? '—' : latency + ' ms'),
      ''
    ]
    results.forEach(function (item) {
      lines.push(formatSize(item.bytes) + '   ' + formatMbps(item.bytes, item.elapsed))
    })
    if (results.length < SAMPLES.length) lines.push('部分测速失败，可再次刷新')
    lines.push('', '测速源  Cloudflare / Apple CDN', '仅下载，不上传数据')

    // 以最大成功样本作为主速度，减少小文件启动开销造成的虚高。
    const main = results[results.length - 1]
    const mbps = main.bytes * 8 / main.elapsed / 1000
    panel.title = '节点网速 · ' + mbps.toFixed(2) + ' Mbps'
    panel.content = lines.join('\n')
    panel['icon-color'] = speedColor(mbps)
  } catch (e) {
    panel.title = '节点网速 · 失败'
    panel['icon-color'] = '#FF453A'
    panel.content = '测速失败\n请确认当前节点可访问公网\nCloudflare 与 Apple 测速源均不可用'
  } finally {
    $done(panel)
  }
})()
