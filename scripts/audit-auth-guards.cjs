// audit-auth-guards.cjs — 检查各视图是否有未登录守卫
const fs = require('fs');

const files = ['ConversationView','ZhongguDetailView','MatchDetailView','RadarRoomView','DisputeView','ExpoDetailView','MerchantConsoleView','OcEditorView','PreviewView','SettingsView','IntentView','ZhongguFormView','RadarLaunchView','PairView'];
const guards = ['currentUser', 'hasUser', 'authUid', 'isLoggedIn', "router.replace", "push('/')", "push('/login'", "push(\"/login\""];

for (const f of files) {
  const p = `src/views/${f}.vue`;
  if (!fs.existsSync(p)) { console.log(`${f.padEnd(22)} MISSING`); continue; }
  const c = fs.readFileSync(p, 'utf8');
  const onMounted = /onMounted/.test(c);
  const hasGuard = guards.some(g => c.includes(g));
  console.log(`${f.padEnd(22)} guard=${String(hasGuard).padEnd(5)} onMounted=${onMounted}`);
}
