'use strict';
const $ = id => document.getElementById(id);
const wrongKey='jj_robot_zhenxing_20260920_wrong', favKey='jj_robot_zhenxing_20260920_fav';
const historyKey='jj_robot_zhenxing_20260920_history', statsKey='jj_robot_zhenxing_20260920_stats';
const memoryStore = new Map();
let storageWarning=false;
function read(key, fallback){
  try { const raw=memoryStore.has(key)?memoryStore.get(key):localStorage.getItem(key); return raw===null?fallback:JSON.parse(raw); }
  catch { warnStorage(); return fallback; }
}
function write(key,value){
  memoryStore.set(key,JSON.stringify(value));
  try {localStorage.setItem(key,JSON.stringify(value));} catch {warnStorage();}
}
function warnStorage(){storageWarning=true; if($('storageNotice')) $('storageNotice').hidden=false;}
const validIds=new Set(BANK.map(q=>q.id));
function ids(key){const a=read(key,[]); return Array.isArray(a)?[...new Set(a.filter(id=>validIds.has(id)))]:[];}
function stats(){
  const s=read(statsKey,{}), clean={};
  if(s&&typeof s==='object'&&!Array.isArray(s)) for(const [id,v] of Object.entries(s)){
    if(validIds.has(id)&&v&&Number.isSafeInteger(v.wrong)&&v.wrong>=0) clean[id]={wrong:v.wrong};
  }
  return clean;
}
function history(){const a=read(historyKey,[]);return Array.isArray(a)?a.filter(x=>x&&typeof x.mode==='string'&&Number.isFinite(x.score)&&Number.isFinite(x.max)&&Number.isFinite(x.time)).slice(0,10):[];}
let paper=[],idx=0,answers={},checked={},recorded={},examMode=false,reviewMode=false;
let modeName='',endAt=null,timerHandle=null,finished=false;
let issueMode=false;
let autoAdvanceTimer=null;
const uiPrefs=read('jj_robot_drill_ui_v1',{});
let autoNext=uiPrefs?.autoNext===true;
let questionSize=['19','22','25'].includes(uiPrefs?.fontSize)?uiPrefs.fontSize:'19';
function cancelAdvance(){clearTimeout(autoAdvanceTimer);autoAdvanceTimer=null;}
function scheduleAdvance(q){
  cancelAdvance();
  if(!autoNext||examMode||reviewMode||finished||q.incomplete||!submitted(q)||!isCorrect(q,answers[q.id])||idx===paper.length-1)return;
  const expected=idx;
  autoAdvanceTimer=setTimeout(()=>{if(idx===expected&&paper[idx]?.id===q.id&&!finished&&!document.hidden&&!document.querySelector('dialog[open]'))jump(idx+1);},850);
}
function uniqueQuestions(list){const seen=new Set();return list.filter(q=>{const key=q.dedupeKey||q.question;if(seen.has(key))return false;seen.add(key);return true;});}
const playable=BANK.filter(q=>!q.incomplete);
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pick(a,n){return shuffle(a).slice(0,n);}
function typeName(t){return {single:'单选题',multi:'多选题',judge:'判断题'}[t];}
function sourceLabel(q){return `${{single:'单选',multi:'多选',judge:'判断'}[q.type]} ${q.source_no_label}`;}
function answered(q){const a=answers[q.id];return !q.incomplete&&(q.type==='multi'?Array.isArray(a)&&a.length>0:typeof a==='string'&&a.length>0);}
function submitted(q){return answered(q)&&(examMode||!!checked[q.id]);}
function isCorrect(q,a){return !q.incomplete&&(q.type==='multi'?Array.isArray(a)&&[...new Set(a)].sort().join('')===q.source_answer.split('').sort().join(''):a===q.source_answer);}
function showScreen(name){cancelAdvance();for(const d of document.querySelectorAll('dialog[open]'))d.close();document.body.dataset.screen=name;for(const s of ['home','quiz','result']) $(s).classList.toggle('hidden',s!==name);$('toolbar').classList.toggle('hidden',name!=='quiz');window.scrollTo(0,0);}
function begin(list,name,seconds=0,issues=false){
  gesture=null;ignoreClickUntil=0;
  list=seconds?uniqueQuestions(list.filter(q=>!q.incomplete)):list;
  if(!list.length){alert('当前条件下没有题目。请调整筛选条件，或先完成答题、收藏。');return;}
  clearInterval(timerHandle);paper=[...list];modeName=name;examMode=seconds>0;reviewMode=false;issueMode=issues;finished=issues;
  idx=0;answers={};checked={};recorded={};endAt=seconds?Date.now()+seconds*1000:null;
  showScreen('quiz');render();tick();
  if(endAt)timerHandle=setInterval(tick,500);
}
function startExam(mode){
  const all=uniqueQuestions(shuffle(playable));
  const counts=mode==='standard'?{single:50,multi:10,judge:30}:{single:20,multi:3,judge:7};
  if(Object.entries(counts).some(([t,n])=>all.filter(q=>q.type===t).length<n))return alert('完整去重题量不足，暂不能生成该模拟卷。');
  begin(shuffle(Object.entries(counts).flatMap(([t,n])=>pick(all.filter(q=>q.type===t),n))),mode==='standard'?'90分钟模拟考试':'30题快速模拟',mode==='standard'?5400:1500);
}
function filtered(){const c=$('catSel').value,t=$('typeSel').value;return BANK.filter(q=>(c==='all'||q.category===c)&&(t==='all'||q.type===t));}
function startPractice(){begin(uniqueQuestions(shuffle(filtered().filter(q=>!q.incomplete))),'专项随机练习');}
function startRandom(){begin(pick(uniqueQuestions(shuffle(playable)),30),'随机刷题');}
function startSequential(){begin(filtered(),'顺序刷题');}
function startExplainMode(){begin(filtered(),'逐题解析');}
function openIssues(){begin(BANK.filter(q=>q.incomplete),'缺项原题浏览',0,true);}
function openFav(){begin(BANK.filter(q=>ids(favKey).includes(q.id)),'收藏练习');}
function openWrong(){begin(BANK.filter(q=>ids(wrongKey).includes(q.id)),'错题练习');}
function ranked(){const s=stats();return BANK.filter(q=>s[q.id]?.wrong>0).sort((a,b)=>s[b.id].wrong-s[a.id].wrong||a.source_order-b.source_order);}
function openFrequent(){begin(ranked(),'高频错题');}
function addImages(container,paths,alt){
  for(const path of paths||[]){
    if(!/^assets\/questions\/[a-zA-Z0-9_-]+\.png$/.test(path))continue;
    const img=document.createElement('img');img.src=path;img.alt=alt;img.className='question-image';
    img.onerror=()=>{const p=document.createElement('p');p.className='notice';p.textContent='图片加载失败，请联网更新后重试；本题不要凭空猜图。';img.replaceWith(p);};
    container.append(img);
  }
}
function render(){
  const q=paper[idx];if(!q)return;
  const readonly=issueMode||q.incomplete;
  const reveal=readonly||reviewMode||(!examMode&&checked[q.id]);
  $('qIndex').textContent=`${idx+1} / ${paper.length} · 原题 ${sourceLabel(q)}`;
  $('qType').textContent=typeName(q.type);$('qCat').textContent=q.category;
  $('quizMode').textContent=reviewMode?'试卷回顾':modeName;
  $('qText').textContent=q.question;
  $('questionImages').replaceChildren();addImages($('questionImages'),q.images,`${sourceLabel(q)}：原稿机构图，含(a)～(d)标记`);
  const eligible=paper.filter(x=>!x.incomplete).length;
  $('prog').style.width=(eligible?100*paper.filter(submitted).length/eligible:0)+'%';
  $('sourceBox').textContent=`来源：${q.source}｜PDF第${q.source_pages.join('、')}页（印刷页码${q.printed_pages.join('、')}）｜原题 ${sourceLabel(q)}｜${q.incomplete?'原稿有疑点，仅供浏览':q.explanation_status==='needs_review'?'解析待完善或需核对，按题源答案判分':'已有辅助学习解析'}${q.duplicate_source_ids.length?`｜原稿另有${q.duplicate_source_ids.length}条同题记录，随机同卷只抽一条`:''}`;
  $('options').replaceChildren();
  const current=answers[q.id],entries=q.type==='judge'?[['正确','正确'],['错误','错误']]:Object.entries(q.options);
  for(const [k,v] of entries){
    const b=document.createElement('button');b.className='option';b.type='button';
    const selected=q.type==='multi'?Array.isArray(current)&&current.includes(k):current===k,keyCorrect=q.type==='multi'?q.source_answer.includes(k):q.source_answer===k;
    b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=!!reveal;
    if(reveal&&!readonly){b.classList.toggle('correct',keyCorrect);b.classList.toggle('wrong',selected&&!keyCorrect);}
    const letter=document.createElement('span');letter.className='letter';letter.setAttribute('aria-hidden','true');letter.textContent=q.type==='judge'?(k==='正确'?'A':'B'):k;
    if(reveal&&!readonly&&(keyCorrect||selected)){
      letter.replaceChildren();const icon=document.createElement('i');icon.className='icon '+(keyCorrect?'icon-check-lg':'icon-x-lg');letter.append(icon);
    }
    const content=document.createElement('span');content.className='option-content';
    const text=document.createElement('span');text.textContent=(v||((q.option_images[k]||[]).length?'':'【原稿缺少此选项】'));
    b.setAttribute('aria-label',`${q.type==='judge'?(k==='正确'?'A':'B'):k} ${v}${reveal&&!readonly?(keyCorrect?'，题源正确项':selected?'，误选':''):''}`);
    content.append(text);addImages(content,q.option_images[k],`${sourceLabel(q)}：原稿${k}项公式`);
    b.append(letter,content);b.onclick=()=>selectAnswer(q,k);$('options').append(b);
  }
  const ex=$('explain');ex.replaceChildren();ex.className=reveal?'feedback '+(readonly||!submitted(q)?'feedback-neutral':isCorrect(q,current)?'feedback-correct':'feedback-wrong'):'hidden';
  if(reveal){
    const title=document.createElement('b');title.textContent=readonly?'原稿疑点 · 仅供浏览，不计分':!submitted(q)?'未提交答案':isCorrect(q,current)?'回答正确（按题源）':'回答错误（按题源）';
    const verdict=document.createElement('div');verdict.className='answer-verdict';
    const ans=document.createElement('p');ans.className='answer-line';ans.append('答案 ');
    const key=document.createElement('strong');key.textContent=q.type==='judge'?(q.source_answer==='正确'?'A':'B'):q.source_answer;ans.append(key,'　您选 ');
    const mine=document.createElement('span');mine.className='my-answer'+(submitted(q)&&!isCorrect(q,current)?' wrong':'');mine.textContent=!submitted(q)?'未提交':q.type==='multi'?[...current].sort().join(''):q.type==='judge'?(current==='正确'?'A':'B'):current;ans.append(mine);
    verdict.append(ans,title);
    const heading=document.createElement('h2');heading.className='analysis-title';heading.textContent='本题解析';
    const label=document.createElement('p');label.className='analysis-disclaimer';label.textContent='按原PDF答案列判分 · 辅助解析非官方解析'+(q.explanation_status==='needs_review'?' · 需核对':'');
    const desc=document.createElement('p');desc.className='explanation';desc.textContent=q.explanation;
    ex.append(verdict,heading,label,desc);
    if(readonly){const note=document.createElement('p');note.textContent=q.incomplete_reason;ex.append(note);}
    for(const source of q.references||[]){
      if(!/^https:\/\//.test(source.url))continue;
      const a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';ex.append(a,document.createElement('br'));
    }
  }
  const favorite=ids(favKey).includes(q.id);$('favLabel').textContent=favorite?'已收藏':'收藏';$('favIcon').className='icon '+(favorite?'icon-star-fill':'icon-star');$('favBtn').setAttribute('aria-pressed',String(favorite));
  $('confirmAnswer').hidden=q.type!=='multi'||examMode||!!reveal;
  $('confirmAnswer').disabled=!answered(q);
  $('multiHint').hidden=q.type!=='multi';
  $('multiHint').textContent=examMode?'多选题：可反复选择、取消；交卷时全选正确才得2分。':'多选题：选完后点击“确认答案”才提交。全选正确才得2分。';
  $('prevBtn').disabled=idx===0;
  $('nextBtn').textContent=idx===paper.length-1?(issueMode?'返回首页':reviewMode?'返回成绩':examMode?'交卷':'完成'):'下一题';
  $('finishBtn').textContent=issueMode?'返回首页':reviewMode?'返回成绩':examMode?'交卷':'结束练习';
  renderCard();
}
function selectAnswer(q,k){
  if(q.incomplete||issueMode||finished||reviewMode||(!examMode&&checked[q.id]))return;
  if(q.type==='multi'){
    const a=Array.isArray(answers[q.id])?answers[q.id]:[];
    answers[q.id]=a.includes(k)?a.filter(x=>x!==k):[...a,k];
  }else answers[q.id]=k;
  if(!examMode&&q.type!=='multi'){checked[q.id]=true;record(q);}
  render();
  scheduleAdvance(q);
}
function checkCurrent(){const q=paper[idx];if(!q||q.type!=='multi'||examMode||finished||reviewMode||q.incomplete||checked[q.id]||!answered(q))return;checked[q.id]=true;record(q);render();scheduleAdvance(q);}
function record(q){
  if(q.incomplete||issueMode||recorded[q.id]||!submitted(q))return;recorded[q.id]=true;
  let wrong=ids(wrongKey).filter(id=>id!==q.id);
  if(!isCorrect(q,answers[q.id])){wrong.push(q.id);const s=stats();s[q.id]={wrong:(s[q.id]?.wrong||0)+1};write(statsKey,s);}
  write(wrongKey,wrong);
}
function toggleFav(){const q=paper[idx],a=ids(favKey);write(favKey,a.includes(q.id)?a.filter(id=>id!==q.id):[...a,q.id]);render();}
function jump(i){if(!Number.isInteger(i)||i<0||i>=paper.length)return;cancelAdvance();closeSheet('answerCard');idx=i;render();window.scrollTo(0,0);}
function prevQ(){if(idx>0)jump(idx-1);}
function nextQ(){if(idx<paper.length-1)jump(idx+1);else finish();}
function renderCard(){
  const eligible=paper.filter(q=>!q.incomplete),done=eligible.filter(submitted).length;
  const hideResults=examMode&&!finished;
  $('rightCount').textContent=hideResults?done:eligible.filter(q=>submitted(q)&&isCorrect(q,answers[q.id])).length;
  $('wrongCount').textContent=hideResults?eligible.length-done:eligible.filter(q=>submitted(q)&&!isCorrect(q,answers[q.id])).length;
  $('rightLabel').textContent=hideResults?'已答':'答对';$('wrongLabel').textContent=hideResults?'未答':'答错';
  $('paperPosition').textContent=`${idx+1}/${paper.length}`;
  $('cardSummary').textContent=`答题卡 · 已提交 ${done} / ${eligible.length}`;
  $('cardHint').textContent=`未提交 ${eligible.length-done} 题；原稿缺项 ${paper.length-eligible.length} 题仅浏览。点击题号跳转。`;
  $('cardGrid').replaceChildren();
  paper.forEach((q,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i+1;b.className='card-number';
    let status=issueMode||q.incomplete?'待核对':submitted(q)?'已答':answered(q)?'待确认':'未答';
    if((!examMode||reviewMode)&&submitted(q))status=isCorrect(q,answers[q.id])?'答对':'答错';
    b.dataset.state=status;b.setAttribute('aria-label',`第 ${i+1} 题，原题 ${sourceLabel(q)}，${status}`);b.title=`${sourceLabel(q)} · ${status}`;
    if(i===idx)b.setAttribute('aria-current','true');b.onclick=()=>jump(i);$('cardGrid').append(b);});
}
function firstBlank(){const i=paper.findIndex(q=>!q.incomplete&&!submitted(q));if(i<0)alert('可答题目均已提交');else jump(i);}
function finish(force=false){
  cancelAdvance();
  if(issueMode||paper.every(q=>q.incomplete)){goHome();return;}
  if(reviewMode){reviewMode=false;showScreen('result');return;}
  if(finished||!paper.length)return;
  const scored=paper.filter(q=>!q.incomplete),blank=scored.filter(q=>!submitted(q)).length;
  if(!force&&blank&&!confirm(`还有 ${blank} 题未提交。确定结束并计为未答吗？取消后可用答题卡继续作答。`))return;
  finished=true;clearInterval(timerHandle);
  let score=0,max=0,correct=0;
  scored.forEach(q=>{const pts=q.type==='multi'?2:1;max+=pts;if(submitted(q)&&isCorrect(q,answers[q.id])){score+=pts;correct++;}record(q);});
  const item={time:Date.now(),mode:modeName,score,max,correct,total:scored.length,blank};
  write(historyKey,[item,...history()].slice(0,10));
  $('result').innerHTML=`<div class="card"><h2>${examMode?'考试':'练习'}结果${force?' · 时间到':''}</h2><div class="grid">
    <div class="stat"><b>${score} / ${max}</b><span>卷面得分</span></div>
    <div class="stat"><b>${(correct/scored.length*100).toFixed(1)}%</b><span>答题正确率（按题数）</span></div>
    <div class="stat"><b>${correct} / ${scored.length}</b><span>答对题数</span></div>
    <div class="stat"><b>${blank}</b><span>未提交题数</span></div></div>
    <p class="small">单选 / 判断每题1分，多选每题2分，按原PDF答案列判分。多选全对才得分（本网页判分设置）；疑点浏览题不计分，未提交不计入高频错题。</p>
    <div class="grid"><button onclick="reviewPaper()">查看本卷解析</button><button class="secondary" onclick="goHome()">返回首页</button></div></div>`;
  showScreen('result');renderHome();
}
function reviewPaper(){reviewMode=true;idx=0;showScreen('quiz');render();$('timer').textContent='试卷回顾';}
function goHome(){
  if(!finished&&paper.length&&!$('quiz').classList.contains('hidden')&&!confirm('返回首页将放弃当前未结束的练习或考试，是否继续？'))return;
  clearInterval(timerHandle);paper=[];endAt=null;reviewMode=false;issueMode=false;showScreen('home');renderHome();
}
function tick(){
  if(!endAt){$('timer').textContent=issueMode?'不计分':'不限时';return;}
  if(finished||reviewMode)return;
  const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));
  $('timer').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  if(left===0)finish(true);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!finished&&endAt)tick();});
window.addEventListener('beforeunload',e=>{if(paper.length&&!finished){e.preventDefault();e.returnValue='';}});
function renderHome(){
  $('bankTotal').textContent=BANK.length;
  for(const t of ['single','multi','judge'])$('count-'+t).textContent=BANK.filter(q=>q.type===t).length;
  $('count-incomplete').textContent=BANK.length-playable.length;
  $('auditSummary').textContent=`PDF原稿${BANK.length}条，${playable.length}条可答，去重后${uniqueQuestions(playable).length}组可组卷；另有${BANK.length-playable.length}条仅供浏览。全部原题号、页码和答案列均保留。${BANK.filter(q=>q.explanation_status==='needs_review').length}条解析待完善或需核对，答案转录核对不代表专业正确性认证。`;
  const current=$('catSel').value;
  $('catSel').replaceChildren(new Option('全部模块','all'));
  for(const category of [...new Set(BANK.map(q=>q.category))].sort())$('catSel').add(new Option(`${category}（${BANK.filter(q=>q.category===category).length}条）`,category));
  if([...$('catSel').options].some(o=>o.value===current))$('catSel').value=current;
  $('historyList').replaceChildren();const h=history();
  if(!h.length)$('historyList').textContent='暂无成绩，完成考试或练习后自动保存。';
  for(const x of h){const p=document.createElement('p');p.className='history-row';p.textContent=`${new Date(x.time).toLocaleString('zh-CN')} · ${x.mode} · ${x.score}/${x.max} 分 · 未答 ${x.blank??'—'} 题`;$('historyList').append(p);}
  $('frequentList').replaceChildren();const list=ranked(),s=stats();
  if(!list.length)$('frequentList').textContent='暂无统计。每轮提交答错计1次；答对移出错题本，累计次数保留。';
  for(const q of list.slice(0,10)){const b=document.createElement('button');b.className='ghost frequent-row';b.textContent=`错 ${s[q.id].wrong} 次 · ${sourceLabel(q)} ${q.question}`;b.onclick=()=>begin([q],'高频错题');$('frequentList').append(b);}
}
function applyTheme(theme){document.documentElement.dataset.theme=theme; $('themeBtn').textContent=theme==='dark'?'切换浅色':'切换深色';$('themeBtn').setAttribute('aria-pressed',String(theme==='dark'));$('darkSetting').checked=theme==='dark';document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#1b242d':'#f6f8fa';}
const preferred=read('jj_robot_theme_v3',null);applyTheme(['dark','light'].includes(preferred)?preferred:'dark');
$('themeBtn').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';write('jj_robot_theme_v3',t);applyTheme(t);};
function closeSheet(id){const d=$(id);if(d?.open)d.close();}
function openAnswerCard(){cancelAdvance();renderCard();if(!$('answerCard').open)$('answerCard').showModal();}
function openSettings(){cancelAdvance();$('autoNextSetting').checked=autoNext;$('fontSetting').value=questionSize;if(!$('settingsSheet').open)$('settingsSheet').showModal();}
function setQuizTheme(dark){const theme=dark?'dark':'light';write('jj_robot_theme_v3',theme);applyTheme(theme);}
function saveUiPrefs(){write('jj_robot_drill_ui_v1',{autoNext,fontSize:questionSize});}
function setAutoNext(value){cancelAdvance();autoNext=!!value;saveUiPrefs();}
function setQuestionSize(value){if(!['19','22','25'].includes(value))return;questionSize=value;document.documentElement.style.setProperty('--qsize',value+'px');saveUiPrefs();}
document.documentElement.style.setProperty('--qsize',questionSize+'px');
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
let gesture=null,ignoreClickUntil=0;
const surface=$('questionSurface');
surface.addEventListener('touchstart',e=>{ignoreClickUntil=0;gesture=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()}:null;},{passive:true});
surface.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
surface.addEventListener('touchend',e=>{
  if(!gesture||!e.changedTouches.length)return;const start=gesture;gesture=null;
  const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
  if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.6&&Date.now()-start.t<1000&&!document.querySelector('dialog[open]')){
    e.preventDefault();ignoreClickUntil=Date.now()+450;if(dx<0&&idx<paper.length-1)jump(idx+1);else if(dx>0&&idx>0)jump(idx-1);
  }
},{passive:false});
surface.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAdvance();});
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn').hidden=false;});
$('installBtn').onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installBtn').hidden=true;}};
window.addEventListener('appinstalled',()=>{$('installBtn').hidden=true;$('pwaStatus').textContent='已安装到设备。';});
if('serviceWorker' in navigator&&['http:','https:'].includes(location.protocol)&&window.isSecureContext){
  let updating=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload();});
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async reg=>{
    const offer=()=>{if(!reg.waiting)return;$('updateNotice').hidden=false;$('updateBtn').onclick=()=>{
      if(paper.length&&!finished){alert('请先完成当前答题或返回首页，再更新。');return;}
      updating=true;reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});
    };};
    offer();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offer();});});
    await navigator.serviceWorker.ready;$('pwaStatus').textContent='离线资源已准备好。可通过浏览器菜单安装或添加到主屏幕。';
  }).catch(()=>{$('pwaStatus').textContent='离线资源准备失败，请联网刷新重试。';});
}else $('pwaStatus').textContent='直接打开文件可答题；安装 PWA 需通过 HTTPS 或本机 localhost 访问。iPhone 请用 Safari 的“添加到主屏幕”。';
renderHome();
if(storageWarning)warnStorage();
