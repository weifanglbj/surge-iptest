/*
 * Surge 节点网速测试面板
 *
 * 先选定一个支持指定字节数的测速源，再测试 1 MB / 5 MB / 10 MB，
 * 避免每个档位切换测速源导致总超时。所有请求遵循当前 Surge 节点。
 */

const PING_URLS = [
  'https://www.gstatic.com/generate_204',
  'https://cp.cloudflare.com/generate_204'
]
// 该接口会按照 bytes 返回指定大小，适合分档测速。
const DOWNLOAD_BASE = 'https://speed.cloudflare.com/__down?bytes='
const SAMPLES = [1000000, 5000000, 10000000]
const REQUEST_TIMEOUT = 90

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
      if (error) return reject({ message: '请求超时或网络错误', elapsed: elapsed })
      if (!response || response.status < 200 || response.status >= 400) {
        return reject({ message: 'HTTP ' + (response && response.status), elapsed: elapsed })
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

function formatKBps(bytes, milliseconds) {
  if (!milliseconds) return '—'
  return (bytes / milliseconds).toFixed(0) + ' KB/s'
}

function formatSpeed(bytes, milliseconds) {
  return formatMbps(bytes, milliseconds) + '（' + formatKBps(bytes, milliseconds) + '）'
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
  const failures = []
  let latency = null

  try {
    const ping = await firstSuccess(PING_URLS, 15)
    latency = ping.elapsed

    // 所有大小使用同一个测速源，避免每档都进行一次备用源切换。
    for (let i = 0; i < SAMPLES.length; i++) {
      const bytes = SAMPLES[i]
      try {
        const download = await request(DOWNLOAD_BASE + bytes, REQUEST_TIMEOUT)
        results.push({ bytes: bytes, elapsed: download.elapsed })
      } catch (e) {
        failures.push({ bytes: bytes, message: e.message || '失败' })
      }
    }

    if (!results.length) throw new Error('download failed')

    const lines = [
      '延迟    ' + (latency === null ? '—' : latency + ' ms'),
      ''
    ]
    results.forEach(function (item) {
      lines.push('下载 ' + formatSize(item.bytes) + '  ' + formatSpeed(item.bytes, item.elapsed))
    })
    failures.forEach(function (item) {
      lines.push('下载 ' + formatSize(item.bytes) + '  ' + item.message)
    })
    lines.push('', '测速源  Cloudflare', '仅下载，不上传数据')

    // 以最大成功样本作为标题速度，成功的只有 1 MB 时也能正常显示。
    const main = results[results.length - 1]
    const mbps = main.bytes * 8 / main.elapsed / 1000
    panel.title = '节点网速 · ' + mbps.toFixed(2) + ' Mbps'
    panel.content = lines.join('\n')
    panel['icon-color'] = speedColor(mbps)
  } catch (e) {
    panel.title = '节点网速 · 失败'
    panel['icon-color'] = '#FF453A'
    panel.content = '测速失败\n请确认当前节点可访问公网\n测速请求可能超时'
  } finally {
    $done(panel)
  }
})()
