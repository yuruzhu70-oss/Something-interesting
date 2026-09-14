let currentFeedTab = 'plans'; // 默认：做饭计划 ('plans' 或 'cooked')

// 切换大页面视图（看看 / 许愿）
function showView(id) {
  if (!id) return;
  document.querySelectorAll('.view').forEach(x => {
    x.classList.toggle('active', x.id === id);
  });
  document.querySelectorAll('#nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 渲染“看看”列表（做饭计划 / 做过的菜）
function renderFeed() {
  const container = $('#friendFeedList');
  if (!container) return;

  const plansCount = $('#plansCount');
  const cookedCount = $('#cookedCount');
  if (plansCount) plansCount.textContent = plans.length;
  if (cookedCount) cookedCount.textContent = cooked.length;

  if (currentFeedTab === 'plans') {
    // 渲染【做饭计划】
    if (!plans || plans.length === 0) {
      container.innerHTML = '<p class="empty">小猪近期还没有制定做饭计划哦。</p>';
      return;
    }

    const html = plans.map(x => {
      const { month, day } = formatDate(x.planned_date || x.created_at);
      
      // 1. 获取有效图片链接（兼容 image_url 与 img，容错 fallback 全局变量）
      const imgUrl = (x.image_url || x.img || '').trim();
      const imgTag = imgUrl
        ? `<div class="timeline-thumb"><img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(x.name)}" onerror="this.parentElement.style.display='none'"></div>` 
        : '';
      //2. 参考链接
      const refLink = (x.xhs_link || x.link || x.reference_url || '').trim();
      const refLinkHtml = refLink
        ? `<a class="ref-Link" Href="${escapeHtml(refLink)}" target="_blank" rel="noopener noreferrer">🔗 查看参考</a>`
        : '';

      return `
        <div class="timeline-item">
          <div class="timeline-date">
            <span class="day">${day}</span>
            <span class="month">${month}</span>
          </div>
          <div class="timeline-card timeline-card-compact">
            ${imgTag}
            <div class="timeline-info">
              <div class="timeline-header">
                <h3>${escapeHtml(x.name)}</h3>
                <span class="tag">${escapeHtml(x.category || '未分类')}</span>
              </div>
              ${refLinkHtml}
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
    // 渲染【做过的菜】
    if (!cooked || cooked.length === 0) {
      container.innerHTML = '<p class="empty">小猪还没有下厨记录哦。</p>';
      return;
    }

    container.innerHTML = cooked.map(x => {
      // 1. 获取有效图片链接
      const imgUrl = (x.image_url || x.img || (typeof fallback !== 'undefined' ? fallback : '')).trim();
      
      // 2. 只有当图片存在时才渲染 img 标签；加载失败时自动隐藏
      const imgTag = imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(x.name)}" onerror="this.style.display='none'">` : '';

      return `
        <article class="cooked">
          ${imgTag}
          <div>
            <small>${x.date || '近期的作品'}</small>
            <h3>${escapeHtml(x.name)}</h3>
            <p><b>味道:</b> ${escapeHtml(x.taste || '美味！')}</p>
            <p><b>总结:</b> ${escapeHtml(x.improvement || '下次更精进')}</p>
            <div class="actions">
              <button onclick="likeDish('${x.id}')">❤️ 赞 ${x.likes || 0}</button>
              <button onclick="saveDish('${x.id}')">🔖 想要小猪再做 ${x.saves || 0}</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }
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
        <div class="wish-content">
          <p><b>${x.supports.length} 位朋友</b> 想让小猪试试</p>
          <h3>${escapeHtml(x.dish)}</h3>
          <div class="supporters">${people}</div>
          ${x.link ? `<a target="_blank" href="${escapeHtml(x.link)}">↗ 查看灵感链接</a>` : '<small>未附链接</small>'}
        </div>
        <div class="wish-action">
          <button class="btn-plus-one" onclick="supportWish('${x.id}')">+1 🙌</button>
        </div>
      </article>
    `;
  }).join('');
}

function render() {
  renderFeed();
  renderWishes();
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

async function supportWish(wishId) {
  try {
    await api('wish_supporters', {
      method: 'POST',
      body: { wish_id: wishId, alias: '好朋友' }
    });
    say('成功 +1！已加入许愿阵营 🎉');
    await loadCloud();
  } catch (error) {
    console.error('许愿+1失败:', error);
    say('提交失败，请重试');
  }
}

// 初始化绑定（确保 DOM 完全加载后执行）
document.addEventListener('DOMContentLoaded', () => {
  // 1. 底部导航点击事件委托
  const nav = $('#nav');
  if (nav) {
    nav.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (btn && btn.dataset.target) {
        showView(btn.dataset.target);
      }
    });
  }

  // 2. 子选项卡点击事件委托（准备做 / 做过了）
  const subTabs = document.querySelector('.sub-tabs');
  if (subTabs) {
    subTabs.addEventListener('click', e => {
      const btn = e.target.closest('.sub-tab');
      if (!btn || !btn.dataset.type) return;

      document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFeedTab = btn.dataset.type;
      renderFeed();
    });
  }

  // 3. 许愿表单提交
  const wishForm = $('#wishForm');
  if (wishForm) {
    wishForm.onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const dish = (data.get('dish') || '').trim();
      const link = (data.get('link') || '').trim();

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

  // 4. 显式调用初始化显示与云端数据加载
  showView('friendFeed');
  loadCloud();
});