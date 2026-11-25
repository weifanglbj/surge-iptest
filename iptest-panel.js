/*
 * IPTest 节点检测 · Surge 面板脚本
 * 数据来源: https://iptest.us 开放 API, 无需 Key
 *   GET https://iptest.us/api/ip     (优先, 含国家/城市/ISP/ASN/时区/延迟)
 *   GET https://iptest.us/api/geoip (备用, 字段名不同)
 * 限流: 50 次/分钟/IP, 面板每小时自动刷新一次, 平时点面板手动刷新
 * 原理: 脚本请求走 Surge 当前出站节点, 返回的就是该节点的出口 IP 归属
 * 注意: 若面板显示的是国内直连 IP, 说明 iptest.us 没走代理,
 *       在配置里加一条规则 DOMAIN,iptest.us,节点选择 (按你的策略组名改)
 */

const API_IP = 'https://iptest.us/api/ip'
const API_GEOIP = 'https://iptest.us/api/geoip'

function get(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      { url: url, headers: { 'User-Agent': 'Surge IPTest Panel', Accept: 'application/json' } },
      function (error, response, data) {
        if (error) return reject(error)
        if (!response || response.status !== 200) return reject(new Error('HTTP ' + (response && response.status)))
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}

;(async () => {
  const panel = {
    title: 'IPTest 节点检测',
    content: '请刷新面板',
    icon: 'globe',
    'icon-color': '#0EA5E9',
  }

  try {
    let d
    try {
      d = await get(API_IP)
    } catch (e) {
      d = await get(API_GEOIP) // /api/ip 失败时用备用接口
    }

    // 两个接口字段名不同, 在这里统一
    const ip = d.ip || '未知'
    const version = d.ipVersion ? 'IPv' + d.ipVersion : ''
    const geo = d.geo || d
    const country = geo.country || geo.country_code || '未知'
    const flag = geo.flagEmoji || geo.emoji || ''
    const region = geo.region || ''
    const city = geo.city || ''
    const place = [country, region, city].filter(Boolean).join(' ')
    const net = d.network || {}
    const isp = net.isp || net.org || d.organization || '未知'
    const asn = net.asn ? 'AS' + net.asn + (net.org ? ' ' + net.org : '') : (d.asn_organization || '未知')
    const tz = geo.timezone || d.timezone || '未知'
    const utc = geo.utcOffset ? ' (UTC' + geo.utcOffset + ')' : ''
    const latency = typeof d.latencyMs === 'number' ? d.latencyMs + 'ms' : ''

    panel.title = 'IPTest ' + (flag ? flag + ' ' : '') + country
    const lines = [
      'IP: ' + ip + (version ? ' (' + version + ')' : ''),
      '归属: ' + place,
      'ISP: ' + isp,
      'ASN: ' + asn,
      '时区: ' + tz + utc,
    ]
    if (latency) lines.push('延迟: ' + latency)
    panel.content = lines.join('\n')
  } catch (e) {
    panel.title = 'IPTest 检测失败'
    panel.content = 'iptest.us 请求失败\n请切换节点后点面板刷新\n限流 50 次/分钟, 别连续狂点'
  } finally {
    $done(panel)
  }
})()
