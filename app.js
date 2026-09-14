(() => {
  const page = document.body.dataset.page;
  const motionStyle = document.createElement('style');
  motionStyle.textContent = `
    .site-transition{position:fixed;inset:0;background:#a9ff65;z-index:9999;transform:translateY(-105%);pointer-events:none}.site-transition.leave{animation:siteLeave .55s cubic-bezier(.7,0,.2,1) forwards}.site-transition.enter{animation:siteEnter .7s cubic-bezier(.7,0,.2,1) forwards}body{animation:pageFade .6s cubic-bezier(.2,.7,.2,1)}.motion-item{opacity:0;transform:translateY(25px) scale(.985);transition:opacity .65s cubic-bezier(.2,.8,.2,1),transform .65s cubic-bezier(.2,.8,.2,1);transition-delay:var(--motion-delay,0ms)}.motion-item.in-view{opacity:1;transform:none}.motion-item:nth-child(2){--motion-delay:70ms}.motion-item:nth-child(3){--motion-delay:140ms}.motion-item:nth-child(4){--motion-delay:210ms}.ripple{position:absolute;border-radius:50%;background:#fff8;transform:scale(0);animation:ripple .65s ease-out;pointer-events:none}.motion-glow{position:fixed;width:340px;height:340px;border-radius:50%;pointer-events:none;z-index:-1;opacity:.11;background:radial-gradient(circle,#a9ff65 0,transparent 67%);transform:translate(-50%,-50%);transition:left .25s ease-out,top .25s ease-out}@keyframes pageFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes siteLeave{to{transform:translateY(0)}}@keyframes siteEnter{from{transform:translateY(0)}to{transform:translateY(105%)}}@keyframes ripple{to{transform:scale(4);opacity:0}}@media(prefers-reduced-motion:reduce){body,.motion-item{animation:none!important;transition:none!important;opacity:1;transform:none}.motion-glow,.site-transition{display:none}}
  `;
  document.head.append(motionStyle);
  const wipe = document.createElement('div'); wipe.className = 'site-transition enter'; document.body.append(wipe);
  const glow = document.createElement('div'); glow.className = 'motion-glow'; document.body.append(glow);
  document.addEventListener('pointermove', (event) => { glow.style.left = `${event.clientX}px`; glow.style.top = `${event.clientY}px`; });
  const motionTargets = [...document.querySelectorAll('main > section, .login-intro, .login-card, .kpis article, .grid > article, .story-card, .stat-grid article, .content-grid > article, .lower-grid > article')];
  const motionObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); motionObserver.unobserve(entry.target); } }), { threshold: .12 });
  motionTargets.forEach((item) => { item.classList.add('motion-item'); motionObserver.observe(item); });
  document.querySelectorAll('button,.primary-button,.login-button,.nav-cta,.final a,.oval').forEach((button) => button.addEventListener('pointerdown', (event) => { const rect = button.getBoundingClientRect(); const ripple = document.createElement('i'); ripple.className = 'ripple'; ripple.style.width = ripple.style.height = `${Math.max(rect.width, rect.height)}px`; ripple.style.left = `${event.clientX - rect.left - rect.width / 2}px`; ripple.style.top = `${event.clientY - rect.top - rect.height / 2}px`; button.style.position = 'relative'; button.style.overflow = 'hidden'; button.append(ripple); setTimeout(() => ripple.remove(), 700); }));
  document.querySelectorAll('a[href^="/"]').forEach((link) => link.addEventListener('click', (event) => { const href = link.getAttribute('href'); if (!href || href === '/' || event.metaKey || event.ctrlKey) return; event.preventDefault(); wipe.className = 'site-transition leave'; setTimeout(() => { window.location.href = href; }, 420); }));

  // ---- Scroll-reveal + chapter-rail (kept from the original, single implementation) ----
  const storyPanels = page === 'dashboard'
    ? [...document.querySelectorAll('.welcome-banner,.stat-grid,.progress-chart-card,.content-grid,.lower-grid,.practice-section')]
    : [...document.querySelectorAll('main > section')];
  storyPanels.forEach((panel) => panel.classList.add('story-step'));
  const revealStory = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealStory.unobserve(entry.target); } }), { threshold: .12 });
  storyPanels.forEach((panel) => revealStory.observe(panel));
  if (page === 'dashboard') {
    const railLinks = [...document.querySelectorAll('.story-steps a')];
    const chapter = document.querySelector('.story-position b');
    const chapters = [{ target: '#overview', panel: document.querySelector('.welcome-banner') }, { target: '#learning', panel: document.querySelector('.content-grid') }, { target: '#knowledge', panel: document.querySelector('.lower-grid') }, { target: '#practice', panel: document.querySelector('.practice-section') }];
    const chapterObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (!entry.isIntersecting) return; const index = chapters.findIndex((chapter) => chapter.panel === entry.target); if (index < 0) return; railLinks.forEach((link, position) => link.classList.toggle('active', position === index)); if (chapter) chapter.textContent = String(index + 1).padStart(2, '0'); }), { threshold: .45 });
    chapters.forEach((chapter) => chapter.panel && chapterObserver.observe(chapter.panel));
  }

  // ---- Networking: every request talks to the real server. No client-side fake data. ----
  const request = async (url, options = {}) => {
    let response;
    try { response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); }
    catch { const err = new Error("Can't reach the studentबंधु server. Make sure it's deployed and running, then try again."); err.code = 'NETWORK_ERROR'; throw err; }
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error('The server returned an invalid response. Refresh the page, then try again.'); }
    if (!response.ok) { const err = new Error(data.error || 'Something went wrong.'); err.code = data.code; err.status = response.status; throw err; }
    return data;
  };
  const initials = (name) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const formatMinutes = (mins) => { const total = Math.max(0, Math.round(mins || 0)); const h = Math.floor(total / 60); const m = total % 60; return h ? `${h}h ${m}m` : `${m}m`; };
  const relativeTime = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime(); const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'Just now'; if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60); if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24); if (days === 1) return 'Yesterday'; if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // ==================================================================================
  // Dashboard: every panel below is rendered from the real /api/dashboard payload.
  // ==================================================================================
  let lastProgress = null, lastTotalConcepts = 0, lastSeries = [], currentPreferences = null, chartPoints = [];

  const renderIdentity = (user, progress) => {
    const set = (id, value) => { const el = document.querySelector(id); if (el) el.textContent = value; };
    set('#sidebar-name', user.name);
    set('#sidebar-course', `${user.course} · ${user.semester.replace('Semester ', 'Sem ')}`);
    set('#sidebar-interest', `Interest: ${user.interest}`);
    set('#avatar-initials', initials(user.name));
    set('#profile-initials', initials(user.name));
    set('#syllabus-status', user.syllabus || 'Not uploaded');
    set('#course-subject', `${user.subject.toUpperCase()} · ${user.course.toUpperCase()}`);
    set('#streak-count', `${progress.streak || 0} day streak`);
    set('#today-date', new Date().toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase());
    const hour = new Date().getHours(); const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const heading = document.querySelector('#welcome-heading'); if (heading) heading.innerHTML = `${greeting}, ${user.name.split(' ')[0]} <i>✦</i>`;
  };

  const renderFocusBanner = (focus, concepts) => {
    const focusEl = document.querySelector('#focus-subject'); if (focusEl) focusEl.textContent = (focus || '').toLowerCase();
    const chips = (concepts || []).slice(0, 3);
    ['banner-concept-1', 'banner-concept-2', 'banner-concept-3'].forEach((id, index) => { const el = document.querySelector(`#${id}`); if (el) el.textContent = chips[index] ? chips[index].concept.toUpperCase() : '—'; });
  };

  const renderLessonPreview = (focus, level, dailyMinutes) => {
    const title = document.querySelector('#lesson-preview-title'); if (title) title.textContent = `Understand ${focus}`;
    const body = document.querySelector('#lesson-preview-body'); if (body) body.textContent = `A short AI-generated micro-lesson to build a working understanding of ${focus}, then check yourself.`;
    const minutesTag = document.querySelector('#lesson-tag-minutes'); if (minutesTag) minutesTag.textContent = `~${Math.max(8, Math.round(Number(dailyMinutes || 30) * .35))} min`;
    const levelTag = document.querySelector('#lesson-tag-level'); if (levelTag) levelTag.textContent = level || 'Foundation';
  };

  const renderSparkline = (series) => {
    const path = document.querySelector('#stat-sparkline'); if (!path) return;
    if (!series || series.length < 2) { path.setAttribute('d', 'M0,32 L100,32'); return; }
    const n = series.length;
    const pts = series.map((point, index) => [(index / (n - 1)) * 100, 33 - (Math.max(0, Math.min(100, point.score)) / 100) * 30]);
    path.setAttribute('d', pts.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' '));
  };

  const renderStats = (progress, totalConcepts, series) => {
    const set = (id, value) => { const el = document.querySelector(id); if (el) el.textContent = value; };
    set('#stat-knowledge-value', String(progress.knowledgeScore));
    const trend = document.querySelector('#stat-knowledge-trend');
    if (trend) {
      if (series && series.length >= 2) { const delta = series[series.length - 1].score - series[0].score; trend.innerHTML = `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% <span>since your first activity</span>`; }
      else trend.innerHTML = '<span>Answer questions to start tracking</span>';
    }
    const weeklyGoalMinutes = Math.max(10, Number(currentPreferences?.dailyMinutes || 30)) * 7;
    set('#stat-study-time', formatMinutes(progress.weeklyMinutes || 0));
    set('#stat-study-goal', formatMinutes(weeklyGoalMinutes));
    const ringPct = Math.max(0, Math.min(100, Math.round(((progress.weeklyMinutes || 0) / weeklyGoalMinutes) * 100)));
    const ring = document.querySelector('#stat-ring'); if (ring) ring.style.background = `conic-gradient(#dfb02a ${ringPct}%,#f1ebd9 0)`;
    set('#stat-ring-value', `${ringPct}%`);
    set('#stat-concepts-mastered', String(progress.conceptsMastered || 0));
    set('#stat-concepts-total', String(totalConcepts || 0));
    set('#stat-concepts-note', totalConcepts ? `${totalConcepts} concepts identified from your syllabus` : 'Answer a few questions to see this fill in');
    renderSparkline(series);
    const bars = document.querySelectorAll('#stat-mini-bars i'); const recent = (series || []).slice(-5);
    bars.forEach((bar, index) => { const point = recent[index]; bar.style.height = point ? `${Math.max(4, Math.round((point.score / 100) * 44))}px` : '4px'; });
  };

  const renderChart = (series) => {
    const svg = document.querySelector('#chart-dynamic'); const empty = document.querySelector('#chart-empty'); const tooltip = document.querySelector('#chart-tooltip');
    if (!svg) return;
    if (!series || series.length < 2) { svg.innerHTML = ''; if (empty) empty.style.display = 'flex'; if (tooltip) tooltip.classList.remove('is-visible'); chartPoints = []; return; }
    if (empty) empty.style.display = 'none';
    const left = 55, right = 865, top = 30, bottom = 204; const n = series.length;
    const xAt = (index) => left + (index / (n - 1)) * (right - left);
    const yAt = (value) => bottom - (Math.max(0, Math.min(100, value)) / 100) * (bottom - top);
    const scorePts = series.map((point, index) => [xAt(index), yAt(point.score)]);
    const accPts = series.map((point, index) => [xAt(index), yAt(point.accuracy ?? point.score)]);
    const toPath = (pts) => pts.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
    const toArea = (pts) => `${toPath(pts)} L${pts[pts.length - 1][0].toFixed(1)} ${bottom} L${pts[0][0].toFixed(1)} ${bottom}Z`;
    svg.innerHTML = `<path class="mastery-area" d="${toArea(scorePts)}"></path><path class="practice-area" d="${toArea(accPts)}"></path><path class="mastery-line" d="${toPath(scorePts)}"></path><path class="practice-line" d="${toPath(accPts)}"></path><g class="chart-dots">${scorePts.map((point) => `<circle cx="${point[0].toFixed(1)}" cy="${point[1].toFixed(1)}" r="4"></circle>`).join('')}</g>`;
    chartPoints = series.map((point, index) => ({ x: xAt(index), score: point.score, accuracy: point.accuracy, at: point.at }));
    if (tooltip) tooltip.classList.remove('is-visible');
  };

  const chartWrap = document.querySelector('#chart-wrap');
  if (chartWrap) {
    const tooltip = document.querySelector('#chart-tooltip');
    chartWrap.addEventListener('pointermove', (event) => {
      if (!chartPoints.length || !tooltip) return;
      const bounds = chartWrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const index = Math.max(0, Math.min(chartPoints.length - 1, Math.round(ratio * (chartPoints.length - 1))));
      const point = chartPoints[index];
      const dateLabel = new Date(point.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      tooltip.innerHTML = `<b>${dateLabel}</b><span>Knowledge <strong>${point.score}%</strong></span><span>Accuracy <strong>${point.accuracy === null || point.accuracy === undefined ? '—' : point.accuracy + '%'}</strong></span>`;
      tooltip.style.left = `${Math.max(4, Math.min(78, (index / Math.max(1, chartPoints.length - 1)) * 88))}%`;
      tooltip.classList.add('is-visible');
    });
    chartWrap.addEventListener('pointerleave', () => tooltip?.classList.remove('is-visible'));
  }

  const renderCallout = (insight) => {
    const callout = document.querySelector('#chart-callout'); if (!callout) return;
    if (!insight) { callout.style.display = 'none'; return; }
    const set = (id, value) => { const el = document.querySelector(id); if (el) el.textContent = value; };
    set('#callout-title', insight.concept);
    set('#callout-sub', `${insight.accuracy}% accuracy`);
    set('#callout-note', insight.text.length > 70 ? `${insight.text.slice(0, 67)}…` : insight.text);
    callout.style.display = 'grid';
  };

  const renderReadiness = (readiness, atRiskCount) => {
    const arc = document.querySelector('#readiness-arc'); if (arc) arc.style.strokeDasharray = `${Math.round((readiness / 100) * 270)} 270`;
    const value = document.querySelector('#readiness-value'); if (value) value.textContent = String(readiness);
    const copy = document.querySelector('#readiness-copy');
    if (copy) copy.textContent = readiness === 0
      ? 'Answer a few questions across your syllabus and your readiness score will appear here.'
      : (atRiskCount > 0 ? `You're making progress. Focus on ${atRiskCount} weak concept${atRiskCount === 1 ? '' : 's'} to lift your readiness.` : 'Solid, even progress across your syllabus so far. Keep going.');
  };

  const renderKnowledgeMap = (concepts, insight) => {
    const map = document.querySelector('#knowledge-map'); if (!map) return;
    if (!concepts || !concepts.length) { map.innerHTML = '<p class="empty-state">Your concept map appears here once your syllabus has been analyzed.</p>'; return; }
    map.innerHTML = concepts.map((item) => {
      const tier = item.attempts === 0 ? 'pending' : (item.accuracy >= 70 ? 'strong' : item.accuracy >= 50 ? 'solid' : 'needs');
      const pct = item.attempts === 0 ? '—' : `${item.accuracy}%`;
      const safeName = item.concept.replace(/"/g, '&quot;');
      return `<span class="map-node ${tier}" data-concept="${safeName}" tabindex="0">${item.concept} <b>${pct}</b>${item.unit ? `<span class="unit-tag">${item.unit}</span>` : ''}</span>`;
    }).join('');
    map.querySelectorAll('.map-node').forEach((node) => node.addEventListener('click', () => {
      map.querySelectorAll('.map-node').forEach((item) => item.classList.remove('selected'));
      node.classList.add('selected');
      const name = node.dataset.concept;
      const title = document.querySelector('#insight-title'); const body = document.querySelector('#insight-body');
      if (insight && insight.concept === name) { if (title) title.textContent = `${name} is held back by a real prerequisite gap`; if (body) body.textContent = insight.text; return; }
      const item = concepts.find((entry) => entry.concept === name);
      if (title) title.textContent = name;
      if (body) body.textContent = item && item.attempts ? `You're at ${item.accuracy}% on this concept across ${item.attempts} attempt${item.attempts === 1 ? '' : 's'}. Answer a few more and studentबंधु's AI will explain the likely root cause.` : 'Not attempted yet — try a Daily 10 or practice set that covers this concept.';
    }));
  };

  const renderInsightDefault = (insight) => {
    if (!insight) return;
    const title = document.querySelector('#insight-title'); const body = document.querySelector('#insight-body');
    if (title) title.textContent = `${insight.concept} is held back by a real prerequisite gap`;
    if (body) body.textContent = insight.text;
  };

  const renderActivity = (events) => {
    const list = document.querySelector('#activity-list'); if (!list) return;
    if (!events || !events.length) { list.innerHTML = '<li><small>Your activity will show up here as you work through daily questions, practice sets and lessons.</small></li>'; return; }
    const ICONS = { account_created: ['complete', '✓'], plan_created: ['practice', '◫'], daily_quiz_created: ['practice', '✦'], daily_quiz_answer: ['test', '↗'], ai_tutor: ['practice', '◌'], practice_created: ['practice', '✦'], practice: ['test', '↗'], lesson_completed: ['complete', '✓'] };
    list.innerHTML = events.map((event) => {
      const [cls, glyph] = ICONS[event.type] || ['practice', '•'];
      const tag = event.minutes ? `+${event.minutes} min` : (event.correct === true ? 'Correct' : event.correct === false ? 'Review' : '');
      return `<li><span class="activity-icon ${cls}">${glyph}</span><div><b>${event.detail}</b><small>${relativeTime(event.at)}</small></div>${tag ? `<strong>${tag}</strong>` : ''}</li>`;
    }).join('');
  };

  const refreshDashboard = async () => {
    let payload;
    try { payload = await request('/api/dashboard'); }
    catch { window.location.replace('login.html'); return null; }
    lastProgress = payload.progress; lastTotalConcepts = payload.totalConcepts; lastSeries = payload.series || [];
    renderIdentity(payload.user, payload.progress);
    renderFocusBanner(payload.focus, payload.concepts);
    renderStats(payload.progress, payload.totalConcepts, payload.series);
    renderChart(payload.series);
    renderCallout(payload.insight);
    const atRisk = (payload.concepts || []).filter((item) => item.attempts >= 3 && item.accuracy < 50).length;
    renderReadiness(payload.progress.readiness, atRisk);
    renderKnowledgeMap(payload.concepts, payload.insight);
    renderInsightDefault(payload.insight);
    renderActivity(payload.activity);
    return payload;
  };
  if (page === 'dashboard') refreshDashboard();

  // ---- Login ----
  const loginForm = document.querySelector('#login-form');
  if (loginForm) loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = loginForm.querySelector('button[type="submit"]'); const errorEl = document.querySelector('#login-error');
    button.disabled = true; button.textContent = 'Signing in…'; if (errorEl) errorEl.textContent = '';
    try { await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#login-email').value.trim(), password: document.querySelector('#login-password').value }) }); window.location.href = 'dashboard.html'; }
    catch (err) { if (errorEl) errorEl.textContent = err.message; button.innerHTML = 'Open my dashboard <span>→</span>'; button.disabled = false; }
  });

  // ---- Registration ----
  const profileButton = document.querySelector('#create-profile');
  const signupForm = document.querySelector('.join-form');
  const MAX_SYLLABUS_CHARS = 8000; const MAX_SYLLABUS_BYTES = 200 * 1024;
  const isTextSyllabus = (file) => { if (!file) return false; if (file.type && file.type.startsWith('text/')) return true; return /\.(txt|md|markdown|csv|text)$/i.test(file.name || ''); };
  const readSyllabusText = async (file) => { if (!file) return ''; if (file.size > MAX_SYLLABUS_BYTES) { const err = new Error('Syllabus file is too large. Please use a text file under 200 KB.'); err.code = 'SYLLABUS_TOO_LARGE'; throw err; } if (!isTextSyllabus(file)) return ''; try { const raw = await file.text(); if (!raw || !raw.trim()) return ''; return raw.trim().slice(0, MAX_SYLLABUS_CHARS); } catch { return ''; } };
  const submitRegistration = async () => {
    const fields = ['name', 'email', 'password', 'course', 'semester', 'subject', 'interest'].map((name) => document.querySelector(`#signup-${name}`));
    const invalid = fields.find((input) => !input.checkValidity()); if (invalid) return invalid.reportValidity();
    const syllabus = document.querySelector('#signup-syllabus').files[0]; profileButton.disabled = true; profileButton.textContent = 'Analyzing your syllabus and creating your account…';
    try { let syllabusText = ''; try { syllabusText = await readSyllabusText(syllabus); } catch (err) { if (err && err.code === 'SYLLABUS_TOO_LARGE') { alert(err.message); profileButton.innerHTML = 'Build my learning path <span>→</span>'; profileButton.disabled = false; return; } syllabusText = ''; } await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: fields[0].value.trim(), email: fields[1].value.trim(), password: fields[2].value, course: fields[3].value.trim(), semester: fields[4].value, subject: fields[5].value.trim(), interest: fields[6].value.trim(), syllabus: syllabus ? syllabus.name : 'Not uploaded', syllabusText }) }); window.location.href = '/login'; }
    catch (err) { alert(err.message); profileButton.innerHTML = 'Build my learning path <span>→</span>'; profileButton.disabled = false; }
  };
  if (profileButton) profileButton.addEventListener('click', submitRegistration);
  if (signupForm) signupForm.addEventListener('submit', (event) => { event.preventDefault(); submitRegistration(); });
  const syllabusInput = document.querySelector('#signup-syllabus');
  if (syllabusInput) syllabusInput.addEventListener('change', () => { document.querySelector('#syllabus-file').textContent = syllabusInput.files[0] ? syllabusInput.files[0].name : 'PDF, DOC, DOCX or image'; });

  // ---- Lesson dialog: AI-generated micro-lesson on the student's real current focus ----
  const lessonDialog = document.querySelector('#lesson-dialog');
  if (lessonDialog) {
    let lessonSteps = []; let lessonIndex = 0;
    const renderLessonStep = () => {
      const step = lessonSteps[lessonIndex];
      const label = document.querySelector('#lesson-dialog-label'); if (label) label.textContent = `TODAY'S LESSON · 0${lessonIndex + 1} / ${lessonSteps.length}`;
      document.querySelector('#lesson-title').textContent = step ? step.title : '—';
      document.querySelector('#lesson-copy').textContent = step ? step.body : '';
      document.querySelectorAll('.lesson-meter i').forEach((meter, index) => meter.classList.toggle('active', index <= lessonIndex));
      const button = document.querySelector('#next-lesson-step'); button.disabled = false; button.innerHTML = lessonIndex === lessonSteps.length - 1 ? 'Complete lesson <span>✓</span>' : 'Next idea <span>→</span>';
    };
    const openLesson = async () => {
      lessonDialog.showModal();
      document.querySelector('#lesson-title').textContent = 'Preparing your lesson…';
      document.querySelector('#lesson-copy').textContent = "studentबंधु's AI is building a short lesson for your current weakest concept.";
      const button = document.querySelector('#next-lesson-step'); button.disabled = true;
      try { const { lesson } = await request('/api/lesson/generate', { method: 'POST', body: '{}' }); lessonSteps = lesson.steps; lessonIndex = 0; renderLessonStep(); }
      catch (err) { document.querySelector('#lesson-title').textContent = 'Could not build a lesson'; document.querySelector('#lesson-copy').textContent = err.message; }
    };
    ['#continue-plan', '#view-learning-plan', '#start-lesson', '#lesson-arrow'].forEach((selector) => document.querySelector(selector)?.addEventListener('click', openLesson));
    lessonDialog.querySelector('.close-dialog').addEventListener('click', () => lessonDialog.close());
    document.querySelector('#next-lesson-step').addEventListener('click', async () => {
      if (!lessonSteps.length) return;
      if (lessonIndex < lessonSteps.length - 1) { lessonIndex += 1; renderLessonStep(); return; }
      const button = document.querySelector('#next-lesson-step'); button.disabled = true; button.textContent = 'Saving progress…';
      try { await request('/api/lesson/complete', { method: 'POST', body: '{}' }); button.innerHTML = 'Lesson complete <span>✓</span>'; setTimeout(() => lessonDialog.close(), 850); refreshDashboard(); }
      catch { button.textContent = 'Could not save—try again'; button.disabled = false; }
    });
  }

  // ---- Practice dialog: AI-generated 5-question set on the student's real current focus ----
  const practiceDialog = document.querySelector('#practice-dialog'); const practiceButton = document.querySelector('#start-practice');
  if (practiceDialog && practiceButton) {
    let practiceQuestions = []; let practiceIndex = 0; let practiceScore = 0;
    const renderPracticeQuestion = () => {
      const item = practiceQuestions[practiceIndex];
      document.querySelector('#practice-label').textContent = `PERSONALIZED PRACTICE · ${String(practiceIndex + 1).padStart(2, '0')} / ${String(practiceQuestions.length).padStart(2, '0')}`;
      document.querySelector('#practice-question').textContent = item.question;
      document.querySelector('#practice-feedback').textContent = '';
      document.querySelector('#next-question').classList.add('hidden');
      document.querySelector('#practice-answers').innerHTML = item.choices.map((choice, index) => `<button type="button" data-index="${index}">${choice}</button>`).join('');
      document.querySelectorAll('#practice-answers button').forEach((button) => button.addEventListener('click', answerPracticeQuestion));
    };
    const answerPracticeQuestion = async (event) => {
      const selected = Number(event.currentTarget.dataset.index); const item = practiceQuestions[practiceIndex];
      document.querySelectorAll('#practice-answers button').forEach((button) => button.disabled = true);
      try {
        const result = await request('/api/practice/answer', { method: 'POST', body: JSON.stringify({ questionId: item.id, selected }) });
        document.querySelectorAll('#practice-answers button').forEach((button, index) => { if (index === selected) button.classList.add(result.correct ? 'correct' : 'incorrect'); });
        if (result.correct) practiceScore += 1;
        document.querySelector('#practice-feedback').textContent = `${result.correct ? 'Correct — this concept is getting stronger.' : 'Not quite.'} ${result.explanation}`;
        const next = document.querySelector('#next-question'); next.innerHTML = practiceIndex === practiceQuestions.length - 1 ? `Finish set (${practiceScore}/${practiceQuestions.length}) <span>✓</span>` : 'Next question <span>→</span>'; next.classList.remove('hidden');
      } catch (err) { document.querySelector('#practice-feedback').textContent = err.message; document.querySelectorAll('#practice-answers button').forEach((button) => button.disabled = false); }
    };
    practiceButton.addEventListener('click', async () => {
      practiceDialog.showModal();
      document.querySelector('#practice-question').textContent = 'Building your practice set…';
      document.querySelector('#practice-answers').innerHTML = '';
      try { const { practice } = await request('/api/practice/generate', { method: 'POST', body: '{}' }); practiceQuestions = practice.questions; practiceIndex = 0; practiceScore = 0; renderPracticeQuestion(); }
      catch (err) { document.querySelector('#practice-question').textContent = 'Could not build a practice set'; document.querySelector('#practice-feedback').textContent = err.message; }
    });
    practiceDialog.querySelector('.close-dialog').addEventListener('click', () => practiceDialog.close());
    document.querySelector('#next-question').addEventListener('click', () => {
      if (practiceIndex === practiceQuestions.length - 1) { practiceDialog.close(); document.querySelector('#practice-feedback').textContent = ''; refreshDashboard(); return; }
      practiceIndex += 1; renderPracticeQuestion();
    });
  }

  // ---- Daily 10, adaptive plan, preferences, AI tutor chat ----
  if (page === 'dashboard') {
    let dailyQuiz = null; let dailyIndex = 0; let todayState = null;
    const toast = (message) => { let element = document.querySelector('#student-toast'); if (!element) { element = document.createElement('div'); element.id = 'student-toast'; element.className = 'student-toast'; document.body.append(element); } element.textContent = message; element.classList.add('show'); clearTimeout(element.timeout); element.timeout = setTimeout(() => element.classList.remove('show'), 3200); };
    const planList = document.querySelector('#plan-list');
    const renderPlan = (plan = []) => { if (!planList) return; if (!plan.length) { planList.innerHTML = '<p class="empty-state">Set your daily time goal, then build a plan shaped around your subject and current focus.</p>'; return; } planList.innerHTML = ''; plan.forEach((item, index) => { const row = document.createElement('a'); row.className = 'plan-item'; row.href = item.resource?.url || '#learning'; row.target = item.resource?.url ? '_blank' : ''; row.rel = 'noopener'; row.innerHTML = `<i>0${index + 1}</i><div><b>${item.title}</b><small>${item.objective}</small></div><span>${item.minutes} min</span>`; planList.append(row); }); };
    const setVideoLink = (focus, subject) => { const link = document.querySelector('#youtube-resource'); if (link) link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${subject || ''} ${focus || ''} explained for students`)}`; };
    const applyToday = (payload) => {
      todayState = payload; dailyQuiz = payload.quiz || null; currentPreferences = payload.preferences;
      const status = document.querySelector('#daily-status'); const focus = document.querySelector('#daily-focus'); const minutes = document.querySelector('#daily-minutes'); const level = document.querySelector('#learning-level'); const goal = document.querySelector('#learning-goal');
      if (status) status.textContent = dailyQuiz ? (dailyQuiz.completedAt ? "Today's 10 is complete. Great work." : `${dailyQuiz.answered?.length || 0} of 10 answered today.`) : 'Your personalized 10 are waiting to be created.';
      if (focus) focus.textContent = `Focus: ${payload.focus}`;
      if (minutes) minutes.value = String(payload.preferences?.dailyMinutes || 30);
      if (level) level.value = payload.preferences?.level || 'Foundation';
      if (goal) goal.value = payload.preferences?.goal || '';
      renderPlan(payload.plan);
      setVideoLink(payload.focus, document.querySelector('#course-subject')?.textContent || '');
      renderLessonPreview(payload.focus, payload.preferences?.level, payload.preferences?.dailyMinutes);
      if (lastProgress) renderStats(lastProgress, lastTotalConcepts, lastSeries);
    };
    const loadToday = async () => { try { applyToday(await request('/api/today')); } catch (err) { toast(err.message); } };
    loadToday();
    document.querySelector('#refresh-plan')?.addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; button.textContent = 'Building…'; try { const result = await request('/api/plan/generate', { method: 'POST', body: '{}' }); renderPlan(result.plan); document.querySelector('#daily-focus').textContent = `Focus: ${result.focus}`; toast('Your study plan has been refreshed.'); } catch (err) { toast(err.message); } finally { button.disabled = false; button.textContent = 'Refresh plan ↻'; } });
    document.querySelector('#preferences-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const note = document.querySelector('#preferences-note'); const body = { dailyMinutes: Number(document.querySelector('#daily-minutes').value), level: document.querySelector('#learning-level').value, goal: document.querySelector('#learning-goal').value.trim() }; try { const result = await request('/api/preferences', { method: 'PUT', body: JSON.stringify(body) }); currentPreferences = result.preferences; if (lastProgress) renderStats(lastProgress, lastTotalConcepts, lastSeries); if (note) note.textContent = 'Your learning rhythm is saved. Refresh your plan to apply it.'; toast('Learning settings saved.'); } catch (err) { if (note) note.textContent = err.message; } });
    const dailyDialog = document.querySelector('#daily-quiz-dialog');
    const renderDailyQuestion = () => { const item = dailyQuiz.questions[dailyIndex]; document.querySelector('#daily-quiz-label').textContent = `DAILY 10 · ${String(dailyIndex + 1).padStart(2, '0')} / 10`; document.querySelector('#daily-quiz-concept').textContent = item.concept; document.querySelector('#daily-quiz-question').textContent = item.question; document.querySelector('#daily-quiz-feedback').textContent = ''; document.querySelector('#daily-next').classList.add('hidden'); const answers = document.querySelector('#daily-quiz-answers'); answers.innerHTML = ''; item.choices.forEach((choice, index) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = choice; button.dataset.answer = String(index); button.addEventListener('click', answerDailyQuestion); answers.append(button); }); };
    const answerDailyQuestion = async (event) => { const selected = Number(event.currentTarget.dataset.answer); const item = dailyQuiz.questions[dailyIndex]; const buttons = [...document.querySelectorAll('#daily-quiz-answers button')]; buttons.forEach((button) => button.disabled = true); const feedback = document.querySelector('#daily-quiz-feedback'); feedback.textContent = 'Checking your understanding…'; try { const result = await request('/api/daily-quiz/answer', { method: 'POST', body: JSON.stringify({ questionId: item.id, selected }) }); event.currentTarget.classList.add(result.correct ? 'correct' : 'incorrect'); feedback.textContent = `${result.correct ? 'Correct.' : 'Not quite.'} ${result.explanation}`; const next = document.querySelector('#daily-next'); next.innerHTML = dailyIndex === 9 ? "Finish today's 10 <span>✓</span>" : 'Next question <span>→</span>'; next.classList.remove('hidden'); if (todayState?.quiz) { todayState.quiz.answered ||= []; todayState.quiz.answered.push(item.id); } } catch (err) { feedback.textContent = err.message; buttons.forEach((button) => button.disabled = false); } };
    const openDailyQuiz = async () => { const action = document.querySelector('#generate-daily-quiz'); action.disabled = true; action.textContent = 'Preparing your 10…'; try { if (!dailyQuiz || dailyQuiz.completedAt) { const result = await request('/api/daily-quiz/generate', { method: 'POST', body: '{}' }); dailyQuiz = result.quiz; } dailyIndex = Math.min(9, dailyQuiz.answered?.length || 0); renderDailyQuestion(); dailyDialog.showModal(); } catch (err) { toast(err.message); } finally { action.disabled = false; action.innerHTML = "Build today's 10 <b>→</b>"; } };
    document.querySelector('#generate-daily-quiz')?.addEventListener('click', openDailyQuiz);
    dailyDialog?.querySelector('.close-dialog').addEventListener('click', () => dailyDialog.close());
    document.querySelector('#daily-next')?.addEventListener('click', () => { if (dailyIndex === 9) { dailyDialog.close(); toast('Daily 10 complete. Your learning profile has been updated.'); loadToday(); refreshDashboard(); return; } dailyIndex += 1; renderDailyQuestion(); });
    const chatForm = document.querySelector('#chat-form');
    const addMessage = (text, role) => { const message = document.createElement('div'); message.className = role === 'user' ? 'user-message' : 'ai-message'; message.textContent = text; const target = document.querySelector('#chat-messages'); target.append(message); target.scrollTop = target.scrollHeight; return message; };
    request('/api/ai/history').then(({ messages }) => { if (!messages?.length) return; const target = document.querySelector('#chat-messages'); target.innerHTML = ''; messages.forEach((message) => addMessage(message.text, message.role)); }).catch(() => {});
    chatForm?.addEventListener('submit', async (event) => { event.preventDefault(); const input = document.querySelector('#chat-input'); const text = input.value.trim(); if (!text) return; input.value = ''; addMessage(text, 'user'); const waiting = addMessage('Thinking through that with you…', 'ai'); waiting.classList.add('typing'); const button = chatForm.querySelector('button'); button.disabled = true; try { const result = await request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: text }) }); waiting.textContent = result.answer; waiting.classList.remove('typing'); document.querySelector('#daily-focus').textContent = `Focus: ${result.focus}`; } catch (err) { waiting.textContent = err.message; waiting.classList.remove('typing'); } finally { button.disabled = false; input.focus(); } });
  }

  // ==================================================================================
  // Admin: real aggregate data over every registered student. Requires ADMIN_EMAILS.
  // ==================================================================================
  if (page === 'admin') {
    const toastAdmin = (message) => { const el = document.querySelector('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(el.timeout); el.timeout = setTimeout(() => el.classList.remove('show'), 2500); };
    const guard = (message) => { const main = document.querySelector('#admin-main'); if (main) main.innerHTML = `<div class="admin-guard"><p>${message}</p><a href="/login">Go to login →</a></div>`; };
    const loadOverview = async () => {
      let overview;
      try { overview = await request('/api/admin/overview'); }
      catch (err) {
        if (err.code === 'ADMIN_ONLY') guard("This account doesn't have admin access. Add its email to ADMIN_EMAILS on the server and log in again.");
        else window.location.replace('/login');
        return null;
      }
      const set = (id, value) => { const el = document.querySelector(id); if (el) el.textContent = value; };
      set('#kpi-active', String(overview.activeLearners));
      set('#kpi-active-note', `of ${overview.totalLearners} total`);
      set('#kpi-confidence', `${overview.avgConfidence}%`);
      set('#kpi-concepts', String(overview.conceptsMasteredTotal));
      set('#kpi-atrisk', String(overview.atRiskCount));
      const weakList = document.querySelector('#weak-concepts-list');
      if (weakList) weakList.innerHTML = overview.weakestConcepts.length
        ? overview.weakestConcepts.map((item) => `<div class="bar-row"><span class="bar-name">${item.concept}</span><span class="bar-pct">${item.accuracy}%</span><div class="bar-track"><div class="bar-fill" style="width:${item.accuracy}%"></div></div><span class="bar-meta">${item.learners} learner${item.learners === 1 ? '' : 's'} · ${item.attempts} attempts</span></div>`).join('')
        : '<p class="empty-note">Not enough answered questions yet to identify weak concepts.</p>';
      const priorities = document.querySelector('#priorities-list');
      if (priorities) priorities.innerHTML = overview.priorities.length
        ? overview.priorities.map((line, index) => `<li>0${index + 1} <b>${line}</b></li>`).join('')
        : '<li><span>Waiting on enough student activity to generate real priorities.</span></li>';
      const cohorts = document.querySelector('#cohorts-body');
      if (cohorts) cohorts.innerHTML = overview.cohorts.length
        ? overview.cohorts.map((item) => `<tr><td>${item.cohort}</td><td>${item.learners}</td><td>${item.confidence}%</td><td>${item.status}</td></tr>`).join('')
        : '<tr><td colspan="4" class="empty-note">No students registered yet.</td></tr>';
      return overview;
    };
    loadOverview();
    document.querySelector('#recommend')?.addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; button.textContent = 'Refreshing…'; await loadOverview(); button.disabled = false; button.textContent = 'Refresh AI recommendations →'; toastAdmin('AI recommendations refreshed.'); });
    document.querySelector('#invite')?.addEventListener('click', async () => { const link = `${window.location.origin}/#join`; try { await navigator.clipboard.writeText(link); toastAdmin('Signup link copied to clipboard.'); } catch { toastAdmin(link); } });
    document.querySelector('#export')?.addEventListener('click', async () => {
      try {
        const { students } = await request('/api/admin/students');
        const header = 'Name,Course,Semester,Subject,Knowledge Score,Concepts Mastered,Streak,Last Active';
        const rows = students.map((item) => [item.name, item.course, item.semester, item.subject, item.knowledgeScore, item.conceptsMastered, item.streak, item.lastActive || ''].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `studentbandhu-students-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
        toastAdmin('Report downloaded.');
      } catch (err) { toastAdmin(err.message); }
    });
  }
})();
