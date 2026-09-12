const SUPABASE_URL = 'https://lszzyyienkchesegpxzm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vS1ilM387c1P5N8Sshdniw_fPyJPKjk';
const fallback = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=700&q=80';

const $ = s => document.querySelector(s);
let plans = [], cooked = [], wishes = [], supporters = [], profiles = [];
let currentFeedTab = 'plans'; // 默认：做饭计划 ('plans' 或 'cooked')

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

// 渲染“看看”列表（做饭计划 / 做过的菜）
function renderFeed() {
  const container = $('#friendFeedList');
  if (!container) return;

  $('#plansCount').textContent = plans.length;
  $('#cookedCount').textContent = cooked.length;

  if (currentFeedTab === 'plans') {
    // 渲染【做饭计划】 -> 竖排日期时间轴模式
    if (!plans || plans.length === 0) {
      container.innerHTML = '<p class="empty">小猪近期还没有制定做饭计划哦。</p>';
      return;
    }

    const html = plans.map(x => {
      const { month, day } = formatDate(x.planned_date || x.created_at);
      return `
        <div class="timeline-item">
          <div class="timeline-date">
            <span class="day">${day}</span>
            <span class="month">${month}</span>
          </div>
          <div class="timeline-card">
            <img src="${x.img || fallback}" alt="${escapeHtml(x.name)}">
            <div class="timeline-info">
              <h3>${escapeHtml(x.name)}</h3>
              <p>${escapeHtml(x.category || '未分类')}</p>
            </div>
            <div class="timeline-actions">
              <button onclick="supportPlan('${x.id}')">🙌 想吃 ${x.likes || 0}</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="timeline-list">${html}</div>`;

  } else {
    // 渲染【做过的菜】 -> 卡片模式
    if (!cooked || cooked.length === 0) {
      container.innerHTML = '<p class="empty">小猪还没有下厨记录哦。</p>';
      return;
    }

    container.innerHTML = cooked.map(x => `
      <article class="cooked">
        <img src="${x.img || fallback}" alt="${escapeHtml(x.name)}">
        <div>
          <small>${x.date}</small>
          <h3>${escapeHtml(x.name)}</h3>
          <p><b>味道:</b> ${escapeHtml(x.taste || '美味！')}</p>
          <p><b>总结:</b> ${escapeHtml(x.improvement || '下次更精进')}</p>
          <div class="actions">
            <button onclick="likeDish('${x.id}')">❤️ 赞 ${x.likes || 0}</button>
            <button onclick="saveDish('${x.id}')">🔖 想要小猪再做 ${x.saves || 0}</button>
          </div>
        </div>
      </article>
    `).join('');
  }
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

// 渲染许愿池列表
function renderWishes() {
  const container = $('#friendWishList');
  if (!container) return;

  const groups = wishGroups();
  if (!groups || groups.length === 0) {
    container.innerHTML = '<p class="empty">还没有人许愿，快来成为第一个点菜的人吧！</p>';
    return;
  }

  container.innerHTML = groups.map(x => {
    const people = x.supports.map(s => `<span>${escapeHtml(s.alias)}</span>`).join('');
    return `
      <article class="wish">
        <div class="avatar">${escapeHtml(x.supports[0]?.alias?.[0] || '朋')}</div>
        <div>
          <p><b>${x.supports.length} 位朋友</b> 想让小猪试试</p>
          <h3>${escapeHtml(x.dish)}</h3>
          <div class="supporters">${people}</div>
          ${x.link ? `<a target="_blank" href="${escapeHtml(x.link)}">↗ 查看灵感链接</a>` : '<small>未附链接</small>'}
        </div>
      </article>
    `;
  }).join('');
}

function render() {
  renderFeed();
  renderWishes();
}

// 切换大页面视图
function showView(id) {
  document.querySelectorAll('.view').forEach(x => {
    x.classList.toggle('active', x.id === id);
  });
  document.querySelectorAll('#nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

    render();
  } catch (error) {
    console.error('云数据库读取失败:', error);
    say('无法连接云数据库，请检查网络');
  }
}

// 互动点赞逻辑
async function supportPlan(id) {
  const target = plans.find(x => x.id === id);
  if (!target) return;
  target.likes = (target.likes || 0) + 1;
  renderFeed();
  try {
    await api(`ideas?id=eq.${id}`, { method: 'PATCH', body: { likes: target.likes } });
    say('已告诉小猪你想吃这道菜！🙌');
  } catch (err) { console.error(err); }
}

async function likeDish(id) {
  const target = cooked.find(x => x.id === id);
  if (!target) return;
  target.likes = (target.likes || 0) + 1;
  renderFeed();
  try {
    await api(`cooked_dishes?id=eq.${id}`, { method: 'PATCH', body: { likes: target.likes } });
    say('收到你的鼓励啦！❤️');
  } catch (err) { console.error(err); }
}

async function saveDish(id) {
  const target = cooked.find(x => x.id === id);
  if (!target) return;
  target.saves = (target.saves || 0) + 1;
  renderFeed();
  try {
    await api(`cooked_dishes?id=eq.${id}`, { method: 'PATCH', body: { saves: target.saves } });
    say('支持成功！🔖');
  } catch (err) { console.error(err); }
}

// 页面初始化绑定
document.addEventListener('DOMContentLoaded', () => {
  // 底部导航
  const nav = $('#nav');
  if (nav) {
    nav.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (btn && btn.dataset.target) showView(btn.dataset.target);
    });
  }

  // 子选项卡切换
  const subTabs = document.querySelector('.sub-tabs');
  if (subTabs) {
    subTabs.addEventListener('click', e => {
      const btn = e.target.closest('.sub-tab');
      if (!btn) return;
      document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFeedTab = btn.dataset.type;
      renderFeed();
    });
  }

  // 许愿池表单
  const wishForm = $('#wishForm');
  if (wishForm) {
    wishForm.onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const dish = data.get('dish').trim();
      const link = data.get('link').trim();

      if (!dish) return;

      try {
        await api('wishes', {
          method: 'POST',
          body: {
            dish,
            keyword: normalize(dish),
            xhs_link: link || null,
            friend_name: '好朋友'
          }
        });
        event.currentTarget.reset();
        say('愿望已发给小猪！');
        await loadCloud();
      } catch (error) {
        console.error(error);
        say('提交失败，请重试');
      }
    };
  }

  showView('friendFeed');
  loadCloud();
});