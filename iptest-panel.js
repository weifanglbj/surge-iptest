/*
 * IPTest 节点检测 · Surge 面板脚本 v5 — 纯净度一目了然
 * Surge 面板只能显示纯文本标题+内容, 做不出网站那种彩色药丸和彩色评分条,
 * 所以用表情+标题直接给结论, 纯净度放最前面, 细节放后面.
 * 数据来源, 全部免 Key、免注册:
 *   1) https://iptest.us/api/ip — 出口 IP、归属、ISP、ASN、时区、延迟
 *      (iptest 官方 API 只有归属信息, 没有欺诈分, 网站上的欺诈值是它内部算的, 不开放)
 *   2) https://iplogs.com/v1/check/{ip} — verdict(clean/suspicious/vpn_likely/
 *      vpn_detected)、score 0-1、is_vpn/is_proxy/is_tor/is_hosting、reputation、
 *      网络类型 residential/datacenter; 免费 2000 次/天、60 次/分钟
 *   3) https://api.ffraud.com/public/ip/{ip} — fraud_score 0-100、risk、
 *      vpn/proxy/tor/residential_proxy、recent_abuse、connection_type
 * 综合风险 = iplogs 分数与 FFraud 欺诈分的平均值, 越低越干净.
 * 分级(对齐网站刻度 0/15/32/48/66/85/100):
 *   0-14 极度纯净, 15-31 很纯净, 32-47 比较干净, 48-65 一般, 66-84 较脏, 85-100 很脏
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

// 风险 0-100 -> 等级、表情、图标颜色
function grade(risk) {
  if (risk <= 14) return { label: '极度纯净', emoji: '🟢', color: '#22C55E' }
  if (risk <= 31) return { label: '很纯净', emoji: '🟢', color: '#22C55E' }
  if (risk <= 47) return { label: '比较干净', emoji: '🟡', color: '#EAB308' }
  if (risk <= 65) return { label: '一般', emoji: '🟡', color: '#EAB308' }
  if (risk <= 84) return { label: '较脏', emoji: '🟠', color: '#F97316' }
  return { label: '很脏', emoji: '🔴', color: '#EF4444' }
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
      d = await get(API_GEOIP)
    }

    const ip = d.ip || '未知'
    const version = d.ipVersion ? 'IPv' + d.ipVersion : ''
    const geo = d.geo || d
    const country = geo.country || geo.country_code || '未知'
    const flag = geo.flagEmoji || geo.emoji || ''
    const place = dedupe([country, geo.region || '', geo.city || '']).join(' ')
    const net = d.network || {}
    const isp = (net.isp || net.org || d.organization || '未知').replace(/ CO\., LIMITED$/i, '').replace(/, LIMITED$/i, '')
    const asnNum = net.asn ? 'AS' + net.asn : (d.asn_organization || '未知')
    // 时区就是归属地的另一种写法(Hong Kong = Asia/Hong_Kong), 两行重复, 不要了
    const latency = typeof d.latencyMs === 'number' ? d.latencyMs + 'ms' : ''

    // 纯净度: 两个免费接口并行查, 互相印证
    const purity = await Promise.all([
      getOptional('https://iplogs.com/v1/check/' + encodeURIComponent(ip)),
      getOptional('https://api.ffraud.com/public/ip/' + encodeURIComponent(ip)),
    ])
    const logs = purity[0]
    const fraud = purity[1]

    const scores = []
    if (logs && typeof logs.score === 'number') scores.push(Math.round(logs.score * 100))
    if (fraud && typeof fraud.fraud_score === 'number') scores.push(fraud.fraud_score)
    const risk = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b }, 0) / scores.length) : null
    const g = risk === null ? { label: '未查到', emoji: '⚪', color: '#0EA5E9' } : grade(risk)
    // 标题里已经有“极度纯净 5%”了, 内容里不再重复放综合评分条和 95%,
    // 免得两个百分比看着多余; █ 字符在 Surge 里还会糊成一块灰条

    // 类型标签
    const tags = []
    const netType = (logs && logs.ip_info && logs.ip_info.type) || ''
    if (netType === 'residential' || (fraud && fraud.connection_type === 'Residential')) tags.push('家庭宽带')
    else if (netType === 'datacenter') tags.push('机房')
    if (logs && logs.is_hosting) tags.push('机房段')
    if (logs && logs.is_vpn) tags.push('VPN')
    if (logs && logs.is_proxy) tags.push('代理')
    if (logs && logs.is_tor) tags.push('Tor')
    if (fraud && fraud.is_residential_proxy) tags.push('住宅代理')
    const fraudVal = fraud && typeof fraud.fraud_score === 'number' ? fraud.fraud_score + '%' : '—'
    const fraudWord = fraud ? ({ none: '低', low: '低', medium: '中', high: '高', critical: '极高' }[fraud.risk] || '') : ''
    const abuse = fraud ? (fraud.recent_abuse ? '⚠️ 近期有滥用' : '✅ 无滥用记录') : ''

    panel.title = g.emoji + ' ' + g.label + ' ' + risk + '% · ' + (flag ? flag + ' ' : '') + country
    panel['icon-color'] = g.color
    const lines = [
      '欺诈值: ' + fraudVal + (fraudWord ? ' ' + fraudWord : '') + (abuse ? ' · ' + abuse : ''),
      'IP 类型: ' + (tags.length ? tags.join(' · ') : '未知'),
      'IP: ' + ip + (version ? ' (' + version + ')' : ''),
      '归属: ' + place,
      'ISP: ' + isp,
      'ASN: ' + asnNum,
    ]
    if (latency) lines.push('延迟: ' + latency)
    // 检测来源只写一个 iptest.us
    lines.push('来源: https://iptest.us')
    panel.content = lines.join('\n')
  } catch (e) {
    panel.title = 'IPTest 检测失败'
    panel.content = 'iptest.us 请求失败\n请切换节点后点面板刷新\n限流 50 次/分钟, 别连续狂点'
  } finally {
    $done(panel)
  }
})()
