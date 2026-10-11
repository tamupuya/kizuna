import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function isSupabaseConfigured(): boolean {
  return !!(url && key && url.startsWith('http'))
}

// 降级：supabase 未配置时返回空结果（全部 Promise 化，兼容 await 链式调用）
function createFallback(): SupabaseClient {
  const noop = () => Promise.resolve({ data: null, error: null, count: 0 })
  const noopArray = () => Promise.resolve({ data: [], error: null, count: 0 })

  // 链式 builder
  function chain(): any {
    const c: any = {
      select: () => c,
      insert: () => c,
      update: () => c,
      delete: () => c,
      eq: () => c,
      neq: () => c,
      in: () => c,
      order: () => c,
      limit: () => c,
      range: () => c,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject),
    }
    // 让 await 能拿到 { data, error }
    c[Symbol.toStringTag] = 'Promise'
    // 覆盖 then 使其成为 thenable
    Object.defineProperty(c, 'then', {
      value: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject),
      enumerable: false,
    })
    Object.defineProperty(c, 'catch', {
      value: (reject: any) => Promise.resolve({ data: [], error: null, count: 0 }).catch(reject),
      enumerable: false,
    })
    return c
  }

  const fallback: any = {
    from: () => chain(),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    removeChannel: () => {},
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'not configured' } }),
      signUp: () => Promise.resolve({ data: null, error: { message: 'not configured' } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: 'not configured' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: () => Promise.resolve({ data: null, error: null }),
        list: () => Promise.resolve({ data: [], error: null }),
      }),
    },
  }

  return fallback as unknown as SupabaseClient
}

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(url, key)
  : createFallback()
