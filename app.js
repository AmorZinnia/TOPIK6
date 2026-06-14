const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = JSON.parse(localStorage.getItem('kgp_state') || '{}');
state.progress ||= {}; state.notes ||= {}; state.answers ||= {}; state.settings ||= {schedule:[0,1,3,5,7,14]};
let selected = null; let currentStage = 1;
const save = () => localStorage.setItem('kgp_state', JSON.stringify(state));
const cleanTitle = t => t.replace(/（.*?）/g,'').trim();
const lessonOf = title => SEED_LESSONS[title] || SEED_LESSONS[cleanTitle(title)] || null;
const progressOf = id => state.progress[id] || {level:0, stage:0, status:'未诊断', due:null, history:[]};
const setProgress = (id, patch) => {state.progress[id] = {...progressOf(id), ...patch}; save(); renderGrammarList();};
function statusBadge(p){
  if(p.status==='已掌握') return '<span class="badge good">已掌握</span>';
  if(p.status==='需讲解') return '<span class="badge hot">需讲解</span>';
  if(p.stage>0) return `<span class="badge warn">复习${p.stage}/6</span>`;
  return '<span class="badge">未诊断</span>';
}
function renderGrammarList(){
  const q = $('#searchInput').value.trim().toLowerCase();
  const list = GRAMMAR_LIST.filter(g => !q || g.title.toLowerCase().includes(q) || String(g.id)===q).slice(0, q?100:297);
  $('#grammarList').innerHTML = list.map(g => {
    const p=progressOf(g.id);
    return `<button class="gitem" data-id="${g.id}"><span class="badge">${g.id}</span><span>${g.title}</span>${statusBadge(p)}</button>`;
  }).join('');
  $$('.gitem').forEach(b=>b.onclick=()=>openGrammar(Number(b.dataset.id)));
}
function defaultLesson(g){
  return {
    pattern: cleanTitle(g.title),
    cn:'这里先不硬编教材定义。点击“复制给 ChatGPT 讲解”后，把你上传资料中对应页/截图或你已有笔记一起发给我，我会按你资料的说法整理成：接续、核心语感、不能用的情况、相似语法区别、中文+英文说明。',
    en:'No fixed explanation is pre-filled for this item yet. Use the ChatGPT prompt to turn your source notes into a precise bilingual lesson before practicing.',
    pitfalls:['不要在没有讲解的情况下直接刷题；先做诊断，确认你到底是“形式不会”“语感不会”还是“输出不会”。','练习必须要求变形、判断语境、改错、输出，而不是只填一个空。'],
    samples:['请先生成专属例句。','请先生成对比句。','请先生成真实输出任务。']
  }
}
function openGrammar(id){
  selected = GRAMMAR_LIST.find(g=>g.id===id); currentStage = Math.max(1, progressOf(id).stage || 1); renderGrammarView();
}
function renderGrammarView(){
  $('#welcome').classList.add('hidden'); $('#grammarView').classList.remove('hidden');
  const g=selected, p=progressOf(g.id), l=lessonOf(g.title)||defaultLesson(g);
  $('#grammarView').innerHTML = `
    <section class="grammar-head card">
      <div><p class="eyebrow">Grammar #${g.id}</p><h2>${g.title}</h2><p class="small">当前状态：${p.status} · 复习进度：${p.stage}/6 · 掌握度：${p.level}/4 ${p.due?'· 下次复习：'+p.due:''}</p><div class="progress"><span style="width:${Math.min(100,(p.stage/6)*100)}%"></span></div></div>
      <div class="toolbar"><button class="ghost" id="markNeed">标记需讲解</button><button class="ghost" id="markKnow">我已经会了</button><button class="primary" id="askTeach">复制给 ChatGPT 讲解</button></div>
    </section>
    <section class="content-card card">
      <h3>先看我会不会</h3>
      ${diagnosticBlock(g,l)}
    </section>
    <section class="content-card card">
      <h3>讲解区 / Lesson</h3>
      <div class="explain"><div class="box"><h4>中文说明</h4><p>${l.cn}</p></div><div class="box"><h4>English explanation</h4><p>${l.en}</p></div></div>
      <div class="box"><h4>接续 Pattern</h4><p class="korean">${l.pattern}</p></div>
      <div class="box"><h4>注意点</h4><ul>${l.pitfalls.map(x=>`<li>${x}</li>`).join('')}</ul></div>
      <div class="box"><h4>例句</h4><ol>${l.samples.map(x=>`<li class="korean">${x}</li>`).join('')}</ol></div>
      <textarea id="userNote" class="answer" placeholder="把你资料里的讲解/老师说法/自己的疑问贴在这里，网站会保存。">${state.notes[g.id]||''}</textarea>
    </section>
    <section class="content-card card">
      <div class="tabs">${[1,2,3,4,5,6].map(n=>`<button class="tab ${n===currentStage?'active':''}" data-stage="${n}">第 ${n} 次</button>`).join('')}</div>
      <div id="stageView"></div>
    </section>`;
  $('#markNeed').onclick=()=>setProgress(g.id,{status:'需讲解',level:0});
  $('#markKnow').onclick=()=>setProgress(g.id,{status:'复习中',level:2,stage:Math.max(1,p.stage)});
  $('#askTeach').onclick=()=>copyPrompt(buildTeachPrompt(g,l));
  $('#userNote').oninput=e=>{state.notes[g.id]=e.target.value; save();};
  $$('.tab').forEach(t=>t.onclick=()=>{currentStage=Number(t.dataset.stage); renderGrammarView();});
  renderStage();
}
function diagnosticBlock(g,l){
return `<div class="task"><h4>1. 语感选择</h4><p>这个语法最接近哪种功能？</p>${['原因/根据','目的/意图','许可/禁止','背景/转折','经验/尝试','决定/计划','条件/假设','其他，需要讲解'].map(x=>`<label class="choice"><input name="diag-${g.id}" type="radio">${x}</label>`).join('')}</div>
<div class="task"><h4>2. 接续快筛</h4><p class="korean">보다 → <input class="inline-input" placeholder="写出接上 ${l.pattern} 的形态"></p><p class="korean">먹다 → <input class="inline-input" placeholder="写出接续形"></p><p class="korean">하다 → <input class="inline-input" placeholder="写出接续形"></p></div>
<div class="task"><h4>3. 输出快筛</h4><p>用 <b>${g.title}</b> 写一句和你真实生活有关的韩语句子。</p><textarea class="answer diag-output" placeholder="例如：今天为什么要复习/为了什么去哪里/什么不能做……"></textarea><div class="skill-row"><label class="chip"><input type="checkbox">形式会</label><label class="chip"><input type="checkbox">意思会</label><label class="chip"><input type="checkbox">相似语法能区分</label><label class="chip"><input type="checkbox">能自由输出</label></div><button class="ghost diag-save">保存诊断结果</button></div>`;
}
function renderStage(){
  const g=selected, l=lessonOf(g.title)||defaultLesson(g), p=progressOf(g.id);
  const holder=$('#stageView');
  holder.innerHTML = stageHTML(currentStage,g,l,p);
  $('.stage-done', holder).onclick=()=>completeStage(g.id,currentStage);
  $('.copy-stage', holder).onclick=()=>copyPrompt(buildReviewPrompt(g,l,currentStage));
  $('.open-chat', holder).onclick=()=>window.open('https://chatgpt.com/','_blank');
}
function stageHTML(n,g,l,p){
 const bank = makeTasks(n,g,l);
 return `<div class="stage-header"><div><p class="eyebrow">Review ${n}/6</p><h3 class="stage-title">${stageTitle(n)}</h3><p class="small">目标不是“做完”，而是确认你能否解释错因并迁移到新句子。</p></div><div class="toolbar"><button class="ghost copy-stage">复制本轮给 ChatGPT 批改</button><button class="primary stage-done">完成本轮</button></div></div>${bank}
 <div class="feedback"><textarea id="promptPreview" class="promptbox" readonly>${buildReviewPrompt(g,l,n)}</textarea><button class="ghost open-chat">打开 ChatGPT</button></div>`;
}
function stageTitle(n){return ['讲解 + 基础题','变形 + 填空','对话 + 改错','阅读理解 + O/X','混合题','自由输出 + 批改'][n-1]}
function makeTasks(n,g,l){
 const T = cleanTitle(g.title);
 if(n===1) return `<div class="task"><h4>A. 解释重构</h4><p>不要照抄讲解。用自己的中文说明：这个语法的核心功能是什么？什么情况下最自然？</p><textarea class="answer"></textarea></div><div class="task"><h4>B. 韩译中 + 功能标注</h4>${l.samples.map(s=>`<p class="korean">${s}</p><textarea class="answer" placeholder="翻译 + 标出 ${T} 在这里承担的功能"></textarea>`).join('')}</div><div class="task"><h4>C. 选择语境</h4><p>下面哪个语境更适合用 <b>${T}</b>？说明为什么，不能只选答案。</p><label class="choice"><input type="radio" name="c1">给朋友解释迟到原因</label><label class="choice"><input type="radio" name="c1">命令别人现在立刻做某事</label><label class="choice"><input type="radio" name="c1">写日记里表达真实计划/感受</label><textarea class="answer" placeholder="我的理由："></textarea></div>`;
 if(n===2) return `<div class="task"><h4>A. 变形表</h4><p>按接续规则变形，尤其注意收音、ㄹ、하다。</p><table class="mini-table"><tr><th>原形</th><th>${T}</th><th>一句真实例句</th></tr>${['가다','먹다','듣다','만들다','공부하다','어렵다'].map(v=>`<tr><td>${v}</td><td><input class="inline-input"></td><td><input class="inline-input" style="min-width:260px"></td></tr>`).join('')}</table></div><div class="task"><h4>B. 关键词完成句子</h4>${['한국어 수업 / 일찍 나가다','피곤하다 / 오늘은 조금 쉬다','친구 / 주말에 만나다','글쓰기 / 예문을 많이 보다'].map(k=>`<p>${k}</p><p class="korean">→ <input class="inline-input" style="min-width:70%"></p>`).join('')}</div><div class="task"><h4>C. 相似语法边界</h4><p>写出一个“不该用 ${T}，而该用别的语法”的句子，并说明原因。</p><textarea class="answer"></textarea></div>`;
 if(n===3) return `<div class="task"><h4>A. 完成对话</h4><p class="korean">A: 왜 오늘 연습을 못 했어요?<br>B: ____________________________.</p><textarea class="answer" placeholder="必须自然使用 ${T}"></textarea><p class="korean">A: 내일 같이 갈래요?<br>B: 음, ____________________________.</p><textarea class="answer"></textarea></div><div class="task"><h4>B. 改错 + 错因分类</h4>${['비가 오기 때문에 우산을 가져가세요.','저는 한국어를 잘하기 때문에 매일 연습하려고 해요.','시간이 없는데 그래서 못 갔어요.'].map(x=>`<p class="korean">${x}</p><textarea class="answer" placeholder="自然吗？若不自然，请改写并说明错因：接续/语感/搭配/句尾限制"></textarea>`).join('')}</div><div class="task"><h4>C. 语气改写</h4><p>把同一个意思分别写成：正式说明、朋友聊天、日记自言自语。</p><textarea class="answer"></textarea></div>`;
 if(n===4) return `<div class="task"><h4>A. 小段阅读</h4><p class="korean">요즘 저는 문법을 외우기만 하면 금방 잊어버려요. 그래서 예문을 직접 만들고, 틀린 이유를 적어 보려고 해요. 시간이 많지 않지만 매일 조금씩 하면 자연스러워질 것 같아요.</p><p>问题：段落中哪一句可以自然改写为 <b>${T}</b>？改写后语气有什么变化？</p><textarea class="answer"></textarea></div><div class="task"><h4>B. O/X 判断</h4>${['这个语法只要中文能翻译出来，就一定自然。','接续正确不代表语境正确。','同一个语法在写作和口语里的自然度可能不同。','我需要能解释“为什么不用另一个语法”。'].map(x=>`<label class="choice"><input type="checkbox">${x}</label>`).join('')}<textarea class="answer" placeholder="把 X 的句子改成正确说法。"></textarea></div><div class="task"><h4>C. 读后输出</h4><p>用 ${T} 回答：你最近韩语学习里最需要解决的问题是什么？</p><textarea class="answer"></textarea></div>`;
 if(n===5) return `<div class="task"><h4>A. 混合选择 + 改写</h4><p>在同一主题里同时使用本语法和一个相似语法，写 4 句，必须体现差异。</p><textarea class="answer"></textarea></div><div class="task"><h4>B. NoRedInk 式错因追踪</h4><p>给每个错误贴标签，然后重写：形式错误 / 语感错误 / 句尾限制 / 相似语法混淆 / 太中式。</p><textarea class="answer"></textarea></div><div class="task"><h4>C. 真实任务</h4><p>写一段你可能真的会发给老师/朋友的韩语消息，必须自然使用 ${T}。</p><textarea class="answer"></textarea></div>`;
 return `<div class="task"><h4>A. 自由输出</h4><p>写 120–200 字韩语短文。主题任选：韩语学习、女团企划、MV 拍摄、韩国生活、今天的情绪。要求自然使用 <b>${T}</b> 至少 3 次，但不能硬塞。</p><textarea class="answer" style="min-height:190px"></textarea></div><div class="task"><h4>B. 自查清单</h4><div class="rubric"><div><b>形式</b><p class="small">接续是否正确？时态是否自然？</p></div><div><b>语感</b><p class="small">是否真需要这个语法？</p></div><div><b>搭配</b><p class="small">前后句关系是否合理？</p></div><div><b>可替换性</b><p class="small">能解释为什么不用相似语法吗？</p></div></div></div><div class="task"><h4>C. 批改要求</h4><p>复制本轮给 ChatGPT 时，会要求：逐句改、解释错因、给更自然替代表达、最后生成下一轮错题。</p></div>`;
}
function completeStage(id,stage){
 const today=new Date(); const offset=state.settings.schedule[Math.min(stage, state.settings.schedule.length-1)]||0; const due=new Date(today); due.setDate(today.getDate()+offset);
 const p=progressOf(id); const next=Math.min(6, Math.max(p.stage, stage)); const status=stage>=6?'已掌握':'复习中';
 setProgress(id,{stage:next,status,level:Math.min(4, Math.ceil(stage/2)), due:due.toISOString().slice(0,10), history:[...(p.history||[]),{stage,date:today.toISOString()}]});
 renderGrammarView();
}
async function copyPrompt(text){
 $('#promptPreview') && ($('#promptPreview').value=text);
 try{await navigator.clipboard.writeText(text); alert('已复制提示词！现在打开 ChatGPT 粘贴即可 ✨');}catch(e){alert('复制失败，请手动复制右下方提示词。');}
}
function buildTeachPrompt(g,l){return `你现在是我的韩语 NoRedInk 式语法老师。请根据我上传/粘贴的资料讲解这个语法：${g.title}\n\n我的要求：\n1. 先用 3 个诊断问题判断我会不会，不要直接长篇讲。\n2. 如果我不会，请按资料说法总结，不要泛泛而谈。\n3. 输出中文 + English explanation。\n4. 必须包含：接续、核心语感、最常见使用场景、不能用的情况、相似语法区别、5 个贴近我生活的例句。\n5. 然后生成第 1 次复习：讲解 + 基础题，题型参考 Sejong/Korean Grammar in Use/延世文法练习/NoRedInk，题目必须需要思考。\n\n我现在的笔记：\n${state.notes[g.id]||'（暂无，我会继续粘贴资料）'}`;}
function buildReviewPrompt(g,l,stage){return `请批改我在“韩语 NoRedInk 式语法练习窗口”里的第 ${stage} 次复习。\n\n语法：${g.title}\n接续/核心：${l.pattern}\n本轮目标：${stageTitle(stage)}\n\n批改方式：\n1. 不只说对错，要逐题指出错因标签：接续错误 / 语感错误 / 相似语法混淆 / 太中式 / 句尾限制 / 搭配不自然。\n2. 每个错题给“最小修改版”和“更自然韩语版”。\n3. 用中文解释 + 必要时 English explanation 辅助语感。\n4. 最后根据我的错误生成 5 道同类补救题，题型不要泛泛，要让我判断、改错、解释原因、再输出。\n\n我的答案如下：\n（请我从网页答案区复制粘贴到这里）`;}
$('#searchInput').oninput=renderGrammarList; renderGrammarList();
$('#startDiagnostic').onclick=()=>{ $('#diagChoices').innerHTML=GRAMMAR_LIST.slice(0,80).map(g=>`<label class="diag-card"><input type="checkbox" value="${g.id}"> ${g.id}. ${g.title}</label>`).join(''); $('#diagnosticDialog').showModal(); };
$('#runDiagnostic').onclick=(e)=>{ const ids=$$('#diagChoices input:checked').map(x=>Number(x.value)); ids.forEach(id=>setProgress(id,{status:'需诊断',stage:0,level:0})); if(ids[0]) setTimeout(()=>openGrammar(ids[0]),80); };
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='korean-grammar-progress.json'; a.click();};
$('#importFile').onchange=e=>{const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{try{Object.assign(state,JSON.parse(r.result)); save(); location.reload();}catch(err){alert('导入失败：不是有效 JSON');}}; r.readAsText(f);};
$('#resetBtn').onclick=()=>{if(confirm('确定清空本机保存的进度和笔记吗？')){localStorage.removeItem('kgp_state'); location.reload();}};
document.addEventListener('click', e=>{ if(e.target.classList.contains('diag-save') && selected){ const checks=$$('.skill-row input:checked').length; setProgress(selected.id,{status:checks>=3?'复习中':'需讲解',level:checks,stage:checks>=3?1:0}); }});
