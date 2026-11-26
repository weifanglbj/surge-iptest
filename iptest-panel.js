/*
 * IPTest 节点检测 · Surge 面板脚本 v6 — 参考“IP 纯净度”面板的两列对齐排版
 * 标题: IP 纯净度 · 风险% 等级, 内容左列标签、右列值, 最后一行测试来源
 * Surge 面板只能显示纯文本, 对齐靠空格补位, 不是网页表格, 只能做到近似.
 * 数据来源, 全部免 Key、免注册:
 *   1) https://iptest.us/api/ip — 出口 IP、归属、ISP、ASN、延迟
 *      (iptest 官方 API 只有归属信息, 没有欺诈分, 网站上的欺诈值是它内部算的, 不开放)
 *   2) https://iplogs.com/v1/check/{ip} — verdict、score 0-1、is_vpn/is_proxy/
 *      is_tor/is_hosting、reputation、网络类型 residential/datacenter
 *   3) https://api.ffraud.com/public/ip/{ip} — fraud_score 0-100、risk、
 *      vpn/proxy/tor/residential_proxy、recent_abuse、connection_type
 * 综合风险 = iplogs 分数与 FFraud 欺诈分的平均值, 越低越干净.
 * 分级: 0-14 极度纯净, 15-31 很纯净, 32-47 比较干净, 48-65 一般, 66-84 较脏, 85-100 很脏
 * 注意: 参考图里的“来源 广播 IP”那一项, 我们用的接口里没有这个字段,
 *       没法凭空编, 所以没放这一行, 用欺诈值/延迟代替.
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

// 左列标签补到 4 个字符宽, 再空两格放值, 尽量对齐成两列
function row(label, value) {
  let l = label
  while (l.length < 4) l += ' '
  return l + '  ' + value
}

// 风险 0-100 -> 等级、图标颜色
function grade(risk) {
  if (risk <= 14) return { label: '极度纯净', color: '#22C55E' }
  if (risk <= 31) return { label: '很纯净', color: '#22C55E' }
  if (risk <= 47) return { label: '比较干净', color: '#EAB308' }
  if (risk <= 65) return { label: '一般', color: '#EAB308' }
  if (risk <= 84) return { label: '较脏', color: '#F97316' }
  return { label: '很脏', color: '#EF4444' }
}

;(async () => {
  const panel = {
    title: 'IP 纯净度',
    content: '请刷新面板',
    icon: 'shield',
    'icon-color': '#22C55E',
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
    const latency = typeof d.latencyMs === 'number' ? d.latencyMs + 'ms' : ''

    // 纯净度: 两个免费接口并行查, 互相印证, 逻辑与 v5 完全一致, 只改排版
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
    const g = risk === null ? { label: '未查到', color: '#0EA5E9' } : grade(risk)

    // 属性: 住宅/机房, 机房段、VPN/代理/Tor 检出情况跟在后面
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
    const abuse = fraud ? (fraud.recent_abuse ? '有滥用' : '无滥用') : ''

    panel.title = risk === null ? 'IP 纯净度 · 未查到' : 'IP 纯净度 · ' + risk + '% ' + g.label
    panel['icon-color'] = g.color
    const lines = [
      row(version === 'IPv6' ? 'IPv6' : 'IPv4', ip),
      row('属性', tags.length ? tags.join(' · ') : '未知'),
      row('ASN', asnNum),
      row('位置', (flag ? flag + ' ' : '') + place),
      row('运营商', isp),
      row('欺诈值', fraudVal + (fraudWord ? ' ' + fraudWord : '') + (abuse ? ' · ' + abuse : '')),
    ]
    if (latency) lines.push(row('延迟', latency))
    // 最后加测试来源并附上网站
    lines.push(row('测试来源', 'https://iptest.us'))
    panel.content = lines.join('\n')
  } catch (e) {
    panel.title = 'IP 纯净度 · 检测失败'
    panel.content = 'iptest.us 请求失败\n请切换节点后点面板刷新\n限流 50 次/分钟, 别连续狂点'
  } finally {
    $done(panel)
  }
})()
