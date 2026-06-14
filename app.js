const DATA = window.GRAMMAR_DATA;
const reviewNames = [
  '第 1 次：讲解 + 基础题',
  '第 2 次：变形 + 填空',
  '第 3 次：对话 + 改错',
  '第 4 次：阅读理解 + O/X',
  '第 5 次：混合题',
  '第 6 次：自由输出 + 我批改'
];
const reviewOffsets = [0, 1, 3, 5, 7, 14];
const stateKey = 'kr_noredink_site_v1';
let state = JSON.parse(localStorage.getItem(stateKey) || '{}');
let currentId = DATA.grammar[0]?.id || 1;

const $ = (id) => document.getElementById(id);
function save(){ localStorage.setItem(stateKey, JSON.stringify(state)); updateStats(); }
function pad(n){ return String(n).padStart(2,'0'); }
function iso(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(date, days){ const d=new Date(date+'T00:00:00'); d.setDate(d.getDate()+days); return iso(d); }
function item(){ return DATA.grammar.find(g=>g.id===Number(currentId)); }
function lesson(){ return DATA.lessons[String(currentId)]; }
function progress(id=currentId){ const p=state[id]?.sessions || []; return Math.round((p.filter(Boolean).length/6)*100); }
function todaySeoul(){ return iso(new Date()); }

function init(){
  $('studyDate').value = state.studyDate || todaySeoul();
  $('interest').value = state.interest || 'daily';
  currentId = state.currentId || currentId;
  $('studyDate').addEventListener('change', e=>{state.studyDate=e.target.value; save(); renderCurrent();});
  $('interest').addEventListener('change', e=>{state.interest=e.target.value; save(); renderCurrent();});
  $('search').addEventListener('input', renderList);
  document.querySelectorAll('[data-know]').forEach(btn=>btn.addEventListener('click',()=>setKnow(btn.dataset.know)));
  $('saveNotes').addEventListener('click', saveNotes);
  $('resetCurrent').addEventListener('click', resetCurrent);
  $('copyFeedback').addEventListener('click', copyFeedbackPrompt);
  $('markDone').addEventListener('click', markAllDone);
  $('exportBtn').addEventListener('click', exportProgress);
  $('teachPromptBtn').addEventListener('click', copyTeachPrompt);
  renderList(); renderCurrent(); updateStats();
}

function renderList(){
  const q = $('search').value.trim().toLowerCase();
  const list = $('grammarList'); list.innerHTML='';
  DATA.grammar.filter(g=>!q || g.title.toLowerCase().includes(q) || String(g.id)===q).forEach(g=>{
    const btn=document.createElement('button'); btn.className='grammar-item'+(g.id===Number(currentId)?' active':'');
    const pct=progress(g.id); const dot = pct===100?'done':pct>0?'some':'';
    btn.innerHTML=`<span><small>${g.id}.</small> ${escapeHtml(g.title)}</span><i class="status-dot ${dot}"></i>`;
    btn.addEventListener('click',()=>{currentId=g.id; state.currentId=g.id; save(); renderList(); renderCurrent();});
    list.appendChild(btn);
  });
}

function updateStats(){
  $('totalCount').textContent = `${DATA.grammar.length} 项`;
  const done = DATA.grammar.filter(g=>progress(g.id)===100).length;
  $('masteredCount').textContent = `${done} 已掌握`;
}

function ensureCurrent(){
  state[currentId] ||= {know:null, sessions:[false,false,false,false,false,false], notes:'', output:''};
  return state[currentId];
}

function renderCurrent(){
  const g=item(), l=lesson(), s=ensureCurrent();
  $('grammarTitle').textContent = `${g.id}. ${g.title}`;
  $('grammarSubtitle').textContent = `${l.level} · ${l.tags.join(' / ')}`;
  $('progressPercent').textContent = `${progress()}%`;
  document.querySelector('.progress-ring').style.background = `conic-gradient(var(--accent) ${progress()*3.6}deg,#eadff7 0deg)`;
  $('sourceNotes').value = s.notes || '';
  $('freeOutput').value = s.output || '';
  renderLesson(); renderSchedule(); renderSessions(); renderDiagnostic(); renderList(); save();
}

function setKnow(v){
  const s=ensureCurrent(); s.know=v;
  if(v==='maybe') renderDiagnostic(true);
  else renderDiagnostic(false);
  save(); renderLesson();
}

function renderDiagnostic(showQuiz=false){
  const s=ensureCurrent(), g=item();
  const box=$('diagnosticQuiz'); box.innerHTML='';
  const status=document.createElement('p');
  status.innerHTML = s.know ? `当前诊断：<span class="kbd">${s.know==='yes'?'会':s.know==='maybe'?'有印象':'不会'}</span>` : '还没有诊断。';
  box.appendChild(status);
  if(showQuiz || s.know==='maybe'){
    const q=document.createElement('div'); q.className='question';
    q.innerHTML=`<b>微诊断</b><p>请用 <span class="kbd">${escapeHtml(g.title)}</span> 写一句和你生活有关的韩语句子。写不出来就点“不太会”。</p><input placeholder="例如：오늘은 ..." />`;
    box.appendChild(q);
  }
}

function renderLesson(){
  const l=lesson();
  $('lessonBody').innerHTML = `
    <div class="pillbox">${l.tags.map(t=>`<span class="pill">${escapeHtml(t)}</span>`).join('')}</div>
    <div class="lesson-grid">
      <div><h3>中文说明</h3><p>${escapeHtml(l.zh)}</p></div>
      <div><h3>English explanation</h3><p>${escapeHtml(l.en)}</p></div>
    </div>
    <h3>接续 / Form</h3>
    <ul>${l.form.map(f=>`<li>${escapeHtml(f)}</li>`).join('')}</ul>
    <h3>易混点 / Contrast</h3><p>${escapeHtml(l.contrast)}</p>
    <h3>贴近你的例句</h3>
    ${l.examples.map(e=>`<div class="example">${escapeHtml(e)}</div>`).join('')}
  `;
}

function renderSchedule(){
  const base = $('studyDate').value || todaySeoul();
  $('reviewSchedule').innerHTML = reviewNames.map((name,i)=>`<div class="review-day"><strong>D${reviewOffsets[i]}</strong><span>${addDays(base,reviewOffsets[i])}</span><p>${name.replace('：','<br>')}</p></div>`).join('');
}

function renderSessions(){
  const wrap=$('sessions'); wrap.innerHTML='';
  reviewNames.forEach((name,idx)=>{
    const node=$('sessionTemplate').content.cloneNode(true);
    node.querySelector('h3').textContent=name;
    node.querySelector('.badge').textContent = ensureCurrent().sessions[idx] ? '完成' : '未完成';
    node.querySelector('.session-body').appendChild(makeExercise(idx));
    node.querySelector('.check').addEventListener('click', e=>checkSession(e.target.closest('.session')));
    node.querySelector('.complete').addEventListener('click',()=>{ensureCurrent().sessions[idx]=true; save(); renderCurrent();});
    wrap.appendChild(node);
  });
}

function makeExercise(idx){
  const g=item(), l=lesson(), interest=$('interest').value;
  const box=document.createElement('div');
  const skin = {
    daily:['친구를 만나다','카페에서 공부하다','집을 정리하다'],
    kpop:['콘셉트를 정하다','연습생을 찾다','데뷔 기획서를 쓰다'],
    film:['장면을 편집하다','복도에서 촬영하다','색보정을 하다'],
    piu:['펌프를 연습하다','채보를 분석하다','게임장에서 만나다'],
    topik:['쓰기 답안을 고치다','문법을 복습하다','예문을 만들다']
  }[interest] || [];
  const title = g.title;
  const grammarChip = `<span class="kbd">${escapeHtml(title)}</span>`;
  const questions = [];
  if(idx===0){
    questions.push(qText(`这个语法的核心意思是什么？用中文写 1 句话。`, ''));
    questions.push(qChoice(`下面哪一项最接近 ${grammarChip} 的学习方式？`, ['只背中文意思','看接续 + 语感 + 例句 + 输出','只做选择题'], 1));
    questions.push(qText(`仿写一句：${escapeHtml(l.examples[0]||'오늘은 ...')}`, ''));
  } else if(idx===1){
    questions.push(qText(`变形：把 “${skin[0]||'공부하다'}” 接到 ${grammarChip} 前。`, ''));
    questions.push(qText(`填空：${skin[1]||'복습하다'} ___ 오늘은 시간이 빨리 갔어요.`, ''));
    questions.push(qText(`写出一个错误接续，并说明为什么错。`, ''));
  } else if(idx===2){
    questions.push(qDialogue('A: 왜 오늘 일찍 나가요?\nB: ________.', title));
    questions.push(qText(`改错：我故意写了一个可能不自然的句子，请你改成自然韩语：저는 ${skin[2]||'공부하다'} ${title} 좋아요.`, ''));
    questions.push(qText(`写一个和 “${l.contrast}” 有关的区别例句。`, ''));
  } else if(idx===3){
    questions.push(qRead(title));
    questions.push(qChoice(`O/X：同一个语法只要中文翻译一样，用法就一定一样。`, ['O','X'], 1));
    questions.push(qChoice(`O/X：学韩语语法时，接续和语感都要确认。`, ['O','X'], 0));
  } else if(idx===4){
    questions.push(qText(`混合题 1：用 ${grammarChip} 写一句“学习/复习”相关句子。`, ''));
    questions.push(qText(`混合题 2：用 ${grammarChip} 写一句“韩国生活/朋友/项目”相关句子。`, ''));
    questions.push(qText(`混合题 3：写一个你容易混淆的相似语法，并比较。`, ''));
  } else {
    questions.push(qText(`自由输出：用 ${grammarChip} 写 5 句，或者写 80-150 字短文。写完后复制到下面“自由输出 + 我批改”。`, ''));
  }
  questions.forEach(q=>box.appendChild(q));
  return box;
}

function qText(prompt, answer){ const d=document.createElement('div'); d.className='question'; d.innerHTML=`<p>${prompt}</p><input data-answer="${escapeHtml(answer)}" placeholder="在这里作答" />`; return d; }
function qDialogue(prompt, title){ return qText(`<b>完成对话</b><pre>${escapeHtml(prompt)}</pre>要求使用 <span class="kbd">${escapeHtml(title)}</span>。`, ''); }
function qChoice(prompt, choices, correct){ const d=document.createElement('div'); d.className='question'; d.dataset.correct=correct; d.innerHTML=`<p>${prompt}</p>`+choices.map((c,i)=>`<label class="choice"><input type="radio" name="q${Math.random()}" value="${i}"> ${escapeHtml(c)}</label>`).join(''); return d; }
function qRead(title){ const d=document.createElement('div'); d.className='question'; d.innerHTML=`<p><b>阅读理解</b></p><p>요즘 저는 한국어 문법을 그냥 외우지 않고, 예문 속에서 익히려고 해요. 특히 <span class="kbd">${escapeHtml(title)}</span> 같은 표현은 뜻만 알면 부족해서 직접 문장을 만들어 봐야 해요.</p><p>问题：这段话的学习观念是什么？</p><input placeholder="用中文回答" />`; return d; }

function checkSession(session){
  let total=0, ok=0;
  session.querySelectorAll('.question').forEach(q=>{
    total++;
    if(q.dataset.correct!==undefined){
      const checked=q.querySelector('input:checked');
      if(checked && Number(checked.value)===Number(q.dataset.correct)) ok++;
    } else {
      const input=q.querySelector('input');
      if(input && input.value.trim().length>0) ok++;
    }
  });
  const fb=session.querySelector('.feedback');
  fb.innerHTML = ok===total ? `<span class="correct">${ok}/${total} 完成。</span> 很好，建议标记本次完成。` : `<span class="wrong">${ok}/${total} 完成。</span> 先把空着的题补上；选择题注意题干里的语感。`;
}

function saveNotes(){ ensureCurrent().notes=$('sourceNotes').value; save(); alert('已保存到本机浏览器。'); }
function resetCurrent(){ if(confirm('确定重置当前语法的诊断、复习和笔记吗？')){ delete state[currentId]; save(); renderCurrent(); }}
function markAllDone(){ const s=ensureCurrent(); s.output=$('freeOutput').value; s.sessions=[true,true,true,true,true,true]; save(); renderCurrent(); }
function copyTeachPrompt(){
  const g=item(), s=ensureCurrent();
  const text=`请按我正在做的韩语 NoRedInk 式语法练习网站，详细教授这个语法：${g.title}\n\n要求：\n1. 先判断我可能会不会；\n2. 根据我贴的资料笔记总结，不照搬教材原文；\n3. 中文+英文解释；\n4. 接续、语感、易混点；\n5. 给贴近我生活的例句；\n6. 最后给第1次复习的基础题。\n\n我的资料笔记：\n${s.notes||'(暂无)'}`;
  navigator.clipboard.writeText(text); alert('已复制讲解请求。');
}
function copyFeedbackPrompt(){
  const g=item(), out=$('freeOutput').value;
  ensureCurrent().output=out; save();
  const text=`请批改我的韩语自由输出。\n当前语法：${g.title}\n\n请按以下维度批改：\n1. 语法是否正确；\n2. 是否真的用到了目标语法；\n3. 韩语自然度；\n4. 更像母语者的替代表达；\n5. 用中文解释错误，用英文补充语感说明；\n6. 最后给我 3 个类似 NoRedInk 的针对性复习题。\n\n我的输出：\n${out||'(我还没写，请先给我自由输出任务)'}`;
  navigator.clipboard.writeText(text); alert('已复制批改请求，打开 ChatGPT 粘贴即可。');
}
function exportProgress(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='korean-grammar-progress.json'; a.click();
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

init();
