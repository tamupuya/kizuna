/**
 * trust_score 算法 — P0-C 雷达加权
 * 2026-08-09
 *
 * 公式: min(meet*3, 9) + min(zhonggu_success*2, 6) + min(completed_event*1, 5)
 *       上限 20，雷达推荐时按 trust_score 加权
 *
 * 数据源:
 *   - meet: 见面打卡次数 (messages 表 + venue_presence onsite 同展)
 *   - zhonggu_success: 中谷店成功交易数 (zhonggu_listings status = completed)
 *   - completed_event: 完成漫展数 (venue_presence status = visited)
 *
 * 加成: trust_score * 0.2（最高 4 分加成）
 */

export interface TrustScoreInput {
  meetCount: number           // 见面次数
  zhongguSuccessCount: number // 中谷店成功交易数
  completedEventCount: number // 完成漫展数
}

export interface TrustScoreResult {
  total: number        // 上限 20
  meetScore: number    // 上限 9
  zhongguScore: number // 上限 6
  eventScore: number   // 上限 5
  radarBonus: number   // 雷达加权，最高 4
}

export function calculateTrustScore(input: TrustScoreInput): TrustScoreResult {
  const meetScore = Math.min(9, input.meetCount * 3)
  const zhongguScore = Math.min(6, input.zhongguSuccessCount * 2)
  const eventScore = Math.min(5, input.completedEventCount * 1)
  const total = Math.min(20, meetScore + zhongguScore + eventScore)

  // 雷达加权: trust_score / 20 * 4 = 最多 4 分加成
  const radarBonus = Math.round((total / 20) * 4 * 10) / 10

  return {
    total,
    meetScore,
    zhongguScore,
    eventScore,
    radarBonus,
  }
}

/**
 * 从 Supabase 数据计算 trust_score
 * 用法: const score = computeTrustFromSupabase({...})
 *
 * ⚠️ 注（2026-10-05 审查）：此函数当前【无调用方】（预留实现），
 * 实际雷达加权走的是 calculateTrustScore 纯函数 + 外部传入的 trustScores 字典。
 * 若日后接线，注意中谷店表真实字段为 owner_id（无 seller_id/buyer_id），
 * 此处已按 owner_id 修正。
 */
export async function computeTrustFromSupabase(supabase: any, userId: string): Promise<TrustScoreResult> {
  // 1. 见面次数: messages 表中 scope='temporary' 的双方对话去重
  const { data: meetData } = await supabase
    .from('messages')
    .select('scope_id, sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('scope', 'temporary')

  const meetVenues = new Set<string>()
  meetData?.forEach((m: any) => {
    if (m.scope_id) meetVenues.add(m.scope_id)
  })

  // 2. 中谷店成功交易: zhonggu_listings status='completed'
  // v0.10.4（2026-10-05）：原用 seller_id/buyer_id，但表真实字段是 owner_id（已修正）
  const { count: zhongguCount } = await supabase
    .from('zhonggu_listings')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('status', 'completed')

  // 3. 完成漫展: venue_presence status='visited'
  const { count: eventCount } = await supabase
    .from('venue_presence')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'visited')

  return calculateTrustScore({
    meetCount: meetVenues.size,
    zhongguSuccessCount: zhongguCount || 0,
    completedEventCount: eventCount || 0,
  })
}