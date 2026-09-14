// 切换大页面视图
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

// 渲染管理端 - 做饭计划列表
function renderAdminPlans() {
  const container = $('#adminPlanList');
  if (!container) return;

  if (!plans || plans.length === 0) {
    container.innerHTML = '<p class="empty">暂无计划，快在上方添加吧！</p>';
    return;
  }

  container.innerHTML = plans.map(x => `
    <div class="form-card" style="margin-bottom:12px; padding:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="margin:0 0 4px; font-size:15px;">${escapeHtml(x.name)}</h3>
          <small style="color:var(--muted);">${x.planned_date || '未定日期'} · ${escapeHtml(x.category || '未分类')}</small>
        </div>
        <button onclick="deletePlan('${x.id}')" style="background:#fee2e2; color:#dc2626; padding:6px 10px; border-radius:8px; font-size:11px;">删除</button>
      </div>
    </div>
  `).join('');
}

// 渲染管理端 - 已做菜品列表
function renderAdminCooked() {
  const container = $('#adminCookedList');
  if (!container) return;

  if (!cooked || cooked.length === 0) {
    container.innerHTML = '<p class="empty">还没有记录下厨档案哦。</p>';
    return;
  }

  container.innerHTML = cooked.map(x => `
    <div class="form-card" style="margin-bottom:12px; padding:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="margin:0 0 4px; font-size:15px;">${escapeHtml(x.name)}</h3>
          <small style="color:var(--muted);">${x.date}</small>
        </div>
        <button onclick="deleteCooked('${x.id}')" style="background:#fee2e2; color:#dc2626; padding:6px 10px; border-radius:8px; font-size:11px;">删除</button>
      </div>
    </div>
  `).join('');
}

// 渲染管理端 - 许愿池处理（完全修复安全读取与布局）
function renderAdminWishes() {
  const container = $('#adminWishList');
  if (!container) return;

  // 增加安全防御，防止数据未加载完成时报错
  if (typeof wishGroups !== 'function') return;
  const groups = wishGroups();

  if (!groups || groups.length === 0) {
    container.innerHTML = '<p class="empty">朋友们还没有许愿哦。</p>';
    return;
  }

  container.innerHTML = groups.map(x => {
    const supportsList = x.supports || [];
    const people = supportsList.map(s => `<span>${escapeHtml(s.alias || '朋友')}</span>`).join('');
    const firstAlias = supportsList[0]?.alias || '朋';

    return `
      <article class="wish">
        <div class="avatar">${escapeHtml(firstAlias[0])}</div>
        <div class="wish-content">
          <p><b>${supportsList.length} 位朋友</b> 许愿点菜</p>
          <h3>${escapeHtml(x.dish)}</h3>
          <div class="supporters">${people}</div>
        </div>
        <div class="wish-action">
          <button class="btn-adopt" onclick="adoptWish('${escapeHtml(x.dish)}')">纳入计划 📌</button>
        </div>
      </article>
    `;
  }).join('');
}

// 统一渲染调度
function render() {
  renderAdminPlans();
  renderAdminCooked();
  renderAdminWishes();
}

// 删除计划
async function deletePlan(id) {
  if (!confirm('确定删除该计划吗？')) return;
  try {
    await api(`ideas?id=eq.${id}`, { method: 'DELETE' });
    say('计划已删除');
    await loadCloud();
  } catch (err) {
    console.error(err);
    say('删除失败');
  }
}

// 删除已做菜品
async function deleteCooked(id) {
  if (!confirm('确定删除该档案吗？')) return;
  try {
    await api(`cooked_dishes?id=eq.${id}`, { method: 'DELETE' });
    say('档案已删除');
    await loadCloud();
  } catch (err) {
    console.error(err);
    say('删除失败');
  }
}

// 采纳愿望，填入计划表单
function adoptWish(dishName) {
  showView('adminPlans');
  const nameInput = document.querySelector('#planForm input[name="name"]');
  if (nameInput) {
    nameInput.value = dishName;
    nameInput.focus();
    say(`已将“${dishName}”填入计划表单`);
  }
}

// 初始化绑定
document.addEventListener('DOMContentLoaded', () => {
  // 底部导航
  const nav = $('#nav');
  if (nav) {
    nav.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (btn && btn.dataset.target) {
        showView(btn.dataset.target);
      }
    });
  }

// 表单 1：新建计划（修复 reset 报错版）
  const planForm = $('#planForm');
  if (planForm) {
    planForm.onsubmit = async e => {
      e.preventDefault();
      const formEl = e.currentTarget; // 提前保存表单引用，防止 async 异步后变 null
      const fd = new FormData(formEl);
      const name = (fd.get('name') || '').trim();
      const category = (fd.get('category') || '').trim();
      const planned_date = fd.get('planned_date');
      const image_url = (fd.get('image_url') || '').trim();

      if (!name) {
        say('请输入菜品名称');
        return;
      }

      const payload = {
        name: name,
        category: category || '未分类'
      };

      if (planned_date) {
        payload.planned_date = planned_date;
        payload.date = planned_date;
      }

      if (image_url) {
        payload.image_url = image_url;
        payload.img = image_url;
      }

      try {
        await api('ideas', {
          method: 'POST',
          body: payload
        });
        
        // 使用明确的表单变量调用 reset
        formEl.reset();
        
        say('新计划已发布！🎉');
        await loadCloud();
      } catch (err) {
        console.error('发布计划提交报错:', err);
        say('发布失败，请检查控制台报错');
      }
    };
  }

  // 表单 2：新增下厨档案
  const cookedForm = $('#cookedForm');
  if (cookedForm) {
    cookedForm.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const name = fd.get('name').trim();
      const taste = fd.get('taste').trim();
      const improvement = fd.get('improvement').trim();
      const image_url = fd.get('image_url').trim();

      try {
        await api('cooked_dishes', {
          method: 'POST',
          body: { name, taste, improvement, image_url: image_url || null }
        });
        e.currentTarget.reset();
        say('下厨档案已保存！🍳');
        await loadCloud();
      } catch (err) {
        console.error(err);
        say('保存失败，请重试');
      }
    };
  }

  showView('adminPlans');
  loadCloud();
});