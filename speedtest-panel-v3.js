/*
 * Surge 节点网速测试 V3
 * 三个下载档位并行执行，避免慢节点串行超时。
 */

const PING_URL = 'https://cp.cloudflare.com/generate_204'
const DOWNLOAD_URL = 'https://speed.cloudflare.com/__down?bytes='
const SAMPLES = [1000000, 5000000, 10000000]
const TIMEOUT = 120

function get(url, timeout) {
  return new Promise(function (resolve, reject) {
    const started = Date.now()
    $httpClient.get({
      url: url + (url.indexOf('?') >= 0 ? '&' : '?') + 'surge_speedtest_v3=' + started,
      timeout: timeout,
      headers: {
        'User-Agent': 'Surge Node SpeedTest V3',
        'Cache-Control': 'no-cache'
      }
    }, function (error, response, data) {
      const elapsed = Date.now() - started
      if (error) return reject({ message: '超时或网络错误', elapsed: elapsed })
      if (!response || response.status < 200 || response.status >= 400) {
        return reject({ message: 'HTTP ' + (response && response.status), elapsed: elapsed })
      }
      resolve({ elapsed: elapsed, data: data || '' })
    })
  })
}

function mbps(bytes, ms) {
  return (bytes * 8 / ms / 1000).toFixed(2) + ' Mbps'
}

function kbps(bytes, ms) {
  return (bytes / ms).toFixed(0) + ' KB/s'
}

function speed(bytes, ms) {
  return mbps(bytes, ms) + '（' + kbps(bytes, ms) + '）'
}

function size(bytes) {
  return (bytes / 1000000).toFixed(0) + ' MB'
}

function color(value) {
  if (value >= 50) return '#30D158'
  if (value >= 10) return '#FF9F0A'
  return '#FF453A'
}

;(async function () {
  const panel = {
    title: '节点网速 V3',
    content: '正在测试…',
    icon: 'speedometer',
    'icon-color': '#0A84FF'
  }

  try {
    const ping = await get(PING_URL, 15)
    const tasks = SAMPLES.map(function (bytes) {
      return get(DOWNLOAD_URL + bytes, TIMEOUT)
        .then(function (result) {
          return { bytes: bytes, elapsed: result.elapsed, error: null }
        })
        .catch(function (error) {
          return { bytes: bytes, elapsed: error.elapsed || 0, error: error.message || '失败' }
        })
    })
    const results = await Promise.all(tasks)
    const ok = results.filter(function (item) { return !item.error })
    const lines = ['延迟    ' + ping.elapsed + ' ms', '']

    results.forEach(function (item) {
      lines.push('下载 ' + size(item.bytes) + '  ' + (item.error ? item.error : speed(item.bytes, item.elapsed)))
    })
    lines.push('', '测速源  Cloudflare', '三个档位并行测试', '仅下载，不上传数据')

    if (!ok.length) throw new Error('download failed')
    const main = ok[ok.length - 1]
    const value = main.bytes * 8 / main.elapsed / 1000
    panel.title = '节点网速 · ' + value.toFixed(2) + ' Mbps'
    panel.content = lines.join('\n')
    panel['icon-color'] = color(value)
  } catch (e) {
    panel.title = '节点网速 · 失败'
    panel['icon-color'] = '#FF453A'
    panel.content = '测速失败\n请确认当前节点可访问公网\n请稍后刷新重试'
  } finally {
    $done(panel)
  }
})()
