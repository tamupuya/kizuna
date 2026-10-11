// Mock data for P0 demo (matches seed.sql structure)

export interface InterestCategory {
  name: string
  works: string[]
}

export interface User {
  id: string
  auth_uid?: string
  cn: string
  avatar_url: string
  bio: string
  gender: 'male' | 'female' | 'private'
  identity_tags: string[]
  interest_tags: string[]
  interest_categories?: InterestCategory[]
  intent_want?: string[]
  intent_want_meet?: string[]
  intent_want_do?: string[]
  intent_provide?: string[]
  activity_area?: string
  // v0.9.14 merchant：用户角色（user/merchant/operator/admin）
  role?: 'user' | 'merchant' | 'operator' | 'admin'
  // v2 雷达算法字段
  current_expo_id?: string | null
  current_venue_id?: string | null
  want_expos?: string[]
  last_active_at?: string
  // 2026-07-28: 新增星座 + 5 位自定义编码
  zodiac?: string | null
  // 2026-08-26: MBTI 独立字段（从 intent_want 中分离）
  mbti?: string | null
  code?: string
  // NG 避雷标签
  ng_tags?: string[]
  // OC 卡（自设卡）
  oc_card?: OcCard | null
}

// 2026-08-21 v0.9.21：关注关系
export interface Follow {
  follower_id: string
  followee_id: string
  created_at: string
}

export interface OcCard {
  ocName: string
  ocBio: string
  ocWorld: string
  ocIllust: string
  ocTags: string[]
  ocDescText: string
  ocAspect?: '3/4' | '1/1'
  createdAt?: string
  updatedAt?: string
}

export interface Venue {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  city: string
}

export interface Expo {
  id: string
  title: string
  venue_id: string
  start_at: string
  end_at: string
  cover_url: string
  description: string
  official_url: string
  tags: string[]
  status: 'upcoming' | 'ongoing' | 'finished'
  // v0.9.14 merchant：归属 / 来源 / 审核字段
  owner_id?: string | null
  source?: string | null
  review_status?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  reject_reason?: string | null
}

export type ListingStatus =
  | 'active'
  | 'reserved'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'flagged'
  | 'disputed'
  | 'closed'     // v0.9.15 XState 8 态：申诉裁决后关闭（终态）
  | 'archived'  // 2026-07-28：下架（软冻结，可重新上架）

export type ReturnPolicy =
  | 'no_return'
  | '7d_defect'
  | '14d_defect'
  | '7d_mismatch'
  | '14d_mismatch'
  | '7d_full'
  | '14d_full'

export type ReturnShipping = 'seller' | 'buyer' | 'split'

export interface ZhongguListing {
  id: string
  owner_id: string
  expo_id: string | null
  type: 'sell' | 'want' | 'exchange'
  ip_tag: string
  character: string | null
  title: string
  price: number | null
  description: string
  status: ListingStatus
  tags: string[]
  address: string | null
  address_note: string | null
  // 2026-07-28：交易方式 + 自提地点
  trade_mode?: 'mail' | 'meetup'
  meetup_place?: string | null
  // 状态机新增字段（P2）
  reserved_by: string | null
  reserved_at: string | null
  tracking_no: string | null
  shipped_at: string | null
  completed_at: string | null
  // 退换政策
  return_policy: ReturnPolicy
  return_note: string | null
  return_shipping: ReturnShipping
  // 联系方式（仅拍下后可见）
  seller_wechat: string | null
  seller_qq: string | null
  // 2026-08-21 v0.9.21：详情页字段
  condition?: '几乎全新' | '全新' | '良好' | '一般'
  wants_count?: number
  views_count?: number
  free_shipping?: boolean
  attributes?: Record<string, string>
}

export interface Dispute {
  id: string
  listing_id: string
  opened_by: string
  reason: 'not_received' | 'mismatch' | 'defect' | 'other'
  description: string | null
  evidence: { type: 'image'; url: string }[]
  status: 'open' | 'resolved_buyer' | 'resolved_seller' | 'resolved_split'
  resolution_note: string | null
  opened_at: string
  resolved_at: string | null
}

// 退换政策选项（供 UI 下拉用）
export const RETURN_POLICY_OPTIONS: { value: ReturnPolicy; label: string; desc: string }[] = [
  { value: 'no_return',      label: '不退不换',     desc: '一旦发货不接退换' },
  { value: '7d_defect',      label: '7天质量问题',  desc: '7天内质量问题可退' },
  { value: '14d_defect',     label: '14天质量问题', desc: '14天内质量问题可退' },
  { value: '7d_mismatch',    label: '7天描述不符',  desc: '7天内与描述不符可退' },
  { value: '14d_mismatch',   label: '14天描述不符', desc: '14天内与描述不符可退' },
  { value: '7d_full',        label: '7天无理由',    desc: '7天内无理由退' },
  { value: '14d_full',       label: '14天无理由',   desc: '14天内无理由退' },
]

export const RETURN_SHIPPING_OPTIONS: { value: ReturnShipping; label: string }[] = [
  { value: 'seller', label: '卖家承担退货运费' },
  { value: 'buyer',  label: '买家承担退货运费' },
  { value: 'split',  label: '双方各承担一半' },
]

// 状态显示元数据
export const STATUS_META: Record<ListingStatus, { label: string; color: string; emoji: string }> = {
  active:    { label: '在售',     color: 'bg-green-100 text-green-700',   emoji: '' },
  reserved:  { label: '已拍下',   color: 'bg-yellow-100 text-yellow-700', emoji: '' },
  shipped:   { label: '已发货',   color: 'bg-blue-100 text-blue-700',     emoji: '' },
  completed: { label: '已完成',   color: 'bg-gray-100 text-gray-600',     emoji: '' },
  cancelled: { label: '已取消',   color: 'bg-gray-100 text-gray-500',     emoji: '' },
  flagged:   { label: '异常',     color: 'bg-red-100 text-red-700',       emoji: '' },
  disputed:  { label: '申诉中',   color: 'bg-orange-100 text-orange-700', emoji: '' },
  closed:    { label: '已关闭',   color: 'bg-gray-100 text-gray-500',    emoji: '' },
  archived:  { label: '已下架',   color: 'bg-zinc-100 text-zinc-500',     emoji: '' },
}

// 5 NPC Users
export const mockUsers: User[] = []

// 4 Venues
export const mockVenues: Venue[] = []

// 5 Expos
export const mockExpos: Expo[] = []

// 5 Zhonggu Listings
export const mockListings: ZhongguListing[] = []

// Helper functions
export function getUserById(id: string): User | undefined {
  return mockUsers.find(u => u.id === id)
}

export function getExpoById(id: string): Expo | undefined {
  return mockExpos.find(e => e.id === id)
}

export function getVenueById(id: string): Venue | undefined {
  return mockVenues.find(v => v.id === id)
}



// ============================================
// 雷达房间（v0.9.13）：用户发起的临时匹配房间
// ============================================

export type RadarTimeWindow = 180 | 900 | 3600 | 86400  // 3min / 15min / 1h / 24h（秒）

export const RADAR_TIME_OPTIONS: { value: RadarTimeWindow; label: string }[] = [
  { value: 180,    label: '3 分钟' },
  { value: 900,    label: '15 分钟' },
  { value: 3600,   label: '1 小时' },
  { value: 86400,  label: '24 小时' },
]

export interface RadarRoom {
  id: string
  initiator_id: string         // 房主
  time_window: RadarTimeWindow  // 3min/15min/1h/24h
  intent_want: string[]         // 希望认识 / 想一起做
  intent_provide: string[]      // 我能提供
  location: string              // 地点（线下 or 线上）
  has_password: boolean
  password?: string | null      // 明文存（P0 演示用）
  status: 'active' | 'closed'   // active=进行中，closed=解散
  created_at: string
  expires_at: string            // created_at + time_window
  closed_at?: string | null
  // 参与者列表（v0.9.18 加入）：进入过的用户 ID，用于 RadarRoomsView "我在的房间" 区块
  participants?: string[]
  // 排序字段（matching-v3 算分）
  match_score?: number
  // v0.10 加入（2026-10-03）：绑定的漫展 ID
  // 线下同窗会可确认具体漫展，确认后匹配分值更高（同漫展 + 同时段）
  // 线上房间或纯同好聊天时为 null
  expo_id?: string | null
}

export interface RadarRoomMessage {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
  // v0.9.23.4：发送状态（微信式）：sending=发送中 / sent=已发送 / failed=失败（可重发）
  status?: 'sending' | 'sent' | 'failed'
}

// 雷达房间 mock 数据
export const mockRadarRooms: RadarRoom[] = []
export const mockRadarRoomMessages: RadarRoomMessage[] = []

// Helper functions


export function getMessagesByRoom(roomId: string): RadarRoomMessage[] {
  return mockRadarRoomMessages
    .filter(m => m.room_id === roomId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}
