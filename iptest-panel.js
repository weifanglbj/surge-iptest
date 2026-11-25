/*
 * IPTest 节点检测 · Surge 面板脚本 v2 — 含节点纯净度
 * 数据来源, 全部免 Key、免注册:
 *   1) https://iptest.us/api/ip — 出口 IP、归属、ISP、ASN、时区、延迟
 *   2) https://iplogs.com/v1/check/{ip} — 纯净度主查: verdict(clean/suspicious/
 *      vpn_likely/vpn_detected)、score 0-1、is_vpn/is_proxy/is_tor/is_hosting、
 *      reputation(allowlist/greylist/blocklist)、网络类型 residential/datacenter
 *      免费 2000 次/天、60 次/分钟
 *   3) https://api.ffraud.com/public/ip/{ip} — 交叉验证: fraud_score 0-100、
 *      risk(none/low/medium/high/critical)、vpn/proxy/tor/residential_proxy、
 *      recent_abuse、connection_type
 * 限流: iptest 50 次/分钟/IP; 面板每小时自动刷新, 平时点面板手动刷新
 * 原理: 脚本请求走 Surge 当前出站节点, 返回的就是该节点的出口 IP 纯净度
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

// 单个纯净度接口失败不影响另一个, 失败返回 null
function getOptional(url) {
  return get(url).catch(function () { return null })
}

function dedupe(parts) {
  const seen = {}
  return parts.filter(function (p) {
    if (!p || seen[p]) return false
    seen[p] = true
    return true
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
    const place = dedupe([country, region, city]).join(' ')
    const net = d.network || {}
    const isp = net.isp || net.org || d.organization || '未知'
    const asn = net.asn ? 'AS' + net.asn + (net.org ? ' ' + net.org : '') : (d.asn_organization || '未知')
    const tz = geo.timezone || d.timezone || '未知'
    const utc = geo.utcOffset ? ' (UTC' + geo.utcOffset + ')' : ''
    const latency = typeof d.latencyMs === 'number' ? d.latencyMs + 'ms' : ''

    // 纯净度: 两个免费接口并行查, 互相印证
    const purity = await Promise.all([
      getOptional('https://iplogs.com/v1/check/' + encodeURIComponent(ip)),
      getOptional('https://api.ffraud.com/public/ip/' + encodeURIComponent(ip)),
    ])
    const logs = purity[0]
    const fraud = purity[1]

    // iplogs: score 0-1, 越低越干净; verdict clean <0.30, suspicious <0.60,
    // vpn_likely <0.85, vpn_detected >=0.85
    let purityLine = '纯净度: 未查到'
    let typeLine = ''
    if (logs) {
      const verdictMap = { clean: '干净', suspicious: '可疑', vpn_likely: '疑似 VPN', vpn_detected: '检出 VPN' }
      const verdict = verdictMap[logs.verdict] || logs.verdict || '未知'
      const score = typeof logs.score === 'number' ? ' (' + Math.round(logs.score * 100) + '/100)' : ''
      const rep = logs.reputation ? ' · ' + logs.reputation : ''
      purityLine = '纯净度: ' + verdict + score + rep
      const flags = []
      if (logs.is_vpn) flags.push('VPN')
      if (logs.is_proxy) flags.push('代理')
      if (logs.is_tor) flags.push('Tor')
      if (logs.is_relay) flags.push('中继')
      const netType = (logs.ip_info && logs.ip_info.type) || ''
      typeLine = '类型: ' + (netType === 'residential' ? '住宅' : netType === 'datacenter' ? '机房' : netType || '未知')
        + (logs.is_hosting ? ' · 机房段' : '')
        + (flags.length ? ' · 检出: ' + flags.join('/') : ' · 无 VPN/代理/Tor')
    }
    // ffraud: fraud_score 0-100, 0-30 可用, 31-85 挑战, 86+ 拦截; risk none/low/medium/high/critical
    let fraudLine = ''
    if (fraud && typeof fraud.fraud_score === 'number') {
      const riskMap = { none: '无风险', low: '低风险', medium: '中风险', high: '高风险', critical: '高危' }
      const risk = riskMap[fraud.risk] || fraud.risk || ''
      fraudLine = '欺诈分: ' + fraud.fraud_score + '/100' + (risk ? ' ' + risk : '')
        + (fraud.recent_abuse ? ' · 近期有滥用' : ' · 无近期滥用')
      if (!typeLine && fraud.connection_type) {
        typeLine = '类型: ' + (fraud.connection_type === 'Residential' ? '住宅' : fraud.connection_type)
      }
    }

    panel.title = 'IPTest ' + (flag ? flag + ' ' : '') + country
    const lines = [
      'IP: ' + ip + (version ? ' (' + version + ')' : ''),
      '归属: ' + place,
      'ISP: ' + isp,
      'ASN: ' + asn,
      purityLine,
    ]
    if (fraudLine) lines.push(fraudLine)
    if (typeLine) lines.push(typeLine)
    lines.push('时区: ' + tz + utc)
    if (latency) lines.push('延迟: ' + latency)
    panel.content = lines.join('\n')
  } catch (e) {
    panel.title = 'IPTest 检测失败'
    panel.content = 'iptest.us 请求失败\n请切换节点后点面板刷新\n限流 50 次/分钟, 别连续狂点'
  } finally {
    $done(panel)
  }
})()
