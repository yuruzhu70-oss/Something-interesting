const SUPABASE_URL = 'https://lszzyyienkchesegpxzm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vS1ilM387c1P5N8Sshdniw_fPyJPKjk';
const fallback = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=700&q=80';

const $ = s => document.querySelector(s);
let plans = [], cooked = [], wishes = [], supporters = [], profiles = [];

const normalize = v => v.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra
  };
}

async function api(table, { method = 'GET', query = '', body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: headers(body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

function escapeHtml(v = '') {
  const e = document.createElement('i');
  e.textContent = v;
  return e.innerHTML;
}

function say(v) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = v;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

// 格式化日期为月份和日期（例如：05月 / 18）
function formatDate(dateStr) {
  if (!dateStr) return { month: '近期', day: '待定' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: '近期', day: '待定' };
  return {
    month: `${d.getMonth() + 1}月`,
    day: d.getDate() < 10 ? `0${d.getDate()}` : `${d.getDate()}`
  };
}

// 整理许愿池数据
function wishGroups() {
  const groups = new Map();
  for (const wish of wishes) {
    const key = wish.keyword || normalize(wish.dish);
    if (!groups.has(key)) groups.set(key, { ...wish, supports: [] });
    const group = groups.get(key);
    const rows = supporters
      .filter(s => s.wish_id === wish.id)
      .map(s => {
        const p = profiles.find(x => x.id === s.friend_id);
        return {
          ...s,
          alias: p?.alias || s.alias || '朋友'
        };
      });
    group.supports.push(...(rows.length ? rows : [{ id: wish.id, alias: wish.person }]));
  }
  return [...groups.values()];
}

// 从 Supabase 加载数据
async function loadCloud() {
  try {
    const [i, c, w, s, p] = await Promise.all([
      api('ideas', { query: '?select=*&order=created_at.desc' }),        // 做饭计划
      api('cooked_dishes', { query: '?select=*&order=created_at.desc' }),// 已做菜品
      api('wishes', { query: '?select=*&order=created_at.desc' }),       // 许愿池
      api('wish_supporters', { query: '?select=*&order=created_at.asc' }),
      api('friend_profiles', { query: '?select=*' })
    ]);

    plans = i.map(x => ({ ...x, img: x.image_url }));
    cooked = c.map(x => ({
      ...x,
      img: x.image_url,
      date: new Date(x.created_at).toLocaleDateString('zh-CN').replaceAll('/', '.')
    }));
    wishes = w.map(x => ({
      ...x,
      keyword: x.keyword || normalize(x.dish),
      link: x.xhs_link,
      person: x.friend_name || '朋友'
    }));
    supporters = s;
    profiles = p;

    if (typeof render === 'function') render();
  } catch (error) {
    console.error('云数据库读取失败:', error);
    say('无法连接云数据库，请检查网络');
  }
}