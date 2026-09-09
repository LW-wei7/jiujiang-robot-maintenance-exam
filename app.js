'use strict';
const $ = id => document.getElementById(id);
const wrongKey='jj_robot_wrong_v1', favKey='jj_robot_fav_v1';
const historyKey='jj_robot_history_v3', statsKey='jj_robot_stats_v3';
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
    if(validIds.has(Number(id))&&v&&Number.isSafeInteger(v.wrong)&&v.wrong>=0) clean[id]={wrong:v.wrong};
  }
  return clean;
}
function history(){const a=read(historyKey,[]);return Array.isArray(a)?a.filter(x=>x&&typeof x.mode==='string'&&Number.isFinite(x.score)&&Number.isFinite(x.max)&&Number.isFinite(x.time)).slice(0,10):[];}
let paper=[],idx=0,answers={},checked={},recorded={},examMode=false,reviewMode=false;
let modeName='',endAt=null,timerHandle=null,finished=false;
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pick(a,n){return shuffle(a).slice(0,n);}
function typeName(t){return {single:'单选题',multi:'多选题',judge:'判断题'}[t];}
function answered(q){const a=answers[q.id];return q.type==='multi'?Array.isArray(a)&&a.length>0:typeof a==='string'&&a.length>0;}
function submitted(q){return answered(q)&&(examMode||!!checked[q.id]);}
function isCorrect(q,a){return q.type==='multi'?Array.isArray(a)&&[...a].sort().join('')===q.answer.split('').sort().join(''):a===q.answer;}
function showScreen(name){for(const s of ['home','quiz','result']) $(s).classList.toggle('hidden',s!==name);$('toolbar').classList.toggle('hidden',name!=='quiz');window.scrollTo(0,0);}
function begin(list,name,seconds=0){
  if(!list.length){alert('当前条件下没有题目');return;}
  clearInterval(timerHandle);paper=list;modeName=name;examMode=seconds>0;reviewMode=false;finished=false;
  idx=0;answers={};checked={};recorded={};endAt=seconds?Date.now()+seconds*1000:null;
  $('answerCard').open=false;showScreen('quiz');render();tick();
  if(endAt) timerHandle=setInterval(tick,500);
}
function startExam(mode){
  const high=BANK.filter(q=>q.priority==='高');
  if(mode==='standard'){
    const counts={single:50,multi:10,judge:30};
    if(Object.entries(counts).some(([t,n])=>high.filter(q=>q.type===t).length<n)) return alert('题库题量不足，无法生成标准模拟卷');
    begin(shuffle(Object.entries(counts).flatMap(([t,n])=>pick(high.filter(q=>q.type===t),n))),'标准模拟',5400);
  }else begin(pick(high,30),'快速模拟',1500);
}
function filtered(){const c=$('catSel').value,t=$('typeSel').value,p=$('priSel').value;return BANK.filter(q=>(c==='all'||q.category===c)&&(t==='all'||q.type===t)&&(p==='all'||q.priority==='高'));}
function startPractice(){begin(shuffle(filtered()),'专项练习');}
function startExplainMode(){begin(shuffle(filtered()),'逐题解析');}
function openFav(){begin(BANK.filter(q=>ids(favKey).includes(q.id)),'收藏练习');}
function openWrong(){begin(BANK.filter(q=>ids(wrongKey).includes(q.id)),'错题练习');}
function ranked(){const s=stats();return BANK.filter(q=>s[q.id]?.wrong>0).sort((a,b)=>s[b.id].wrong-s[a.id].wrong||a.id-b.id);}
function openFrequent(){begin(ranked(),'高频错题');}
function render(){
  const q=paper[idx];if(!q)return;
  const reveal=reviewMode||(!examMode&&checked[q.id]);
  $('qIndex').textContent=`${idx+1} / ${paper.length} · 题库 #${q.id}`;
  $('qType').textContent=typeName(q.type);$('qCat').textContent=q.category;
  $('qText').textContent=q.question;
  $('prog').style.width=100*paper.filter(submitted).length/paper.length+'%';
  $('sourceBox').textContent=`来源：${q.source}｜优先级：${q.priority}｜解析状态：${q.explanationStatus||'需核对'}`;
  $('options').replaceChildren();
  const current=answers[q.id],entries=q.type==='judge'?[['正确','正确'],['错误','错误']]:Object.entries(q.options);
  for(const [k,v] of entries){
    const b=document.createElement('button');b.className='option';b.type='button';
    const selected=Array.isArray(current)?current.includes(k):current===k;
    b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=!!reveal;
    const keyCorrect=q.type==='judge'?q.answer===k:q.answer.includes(k);
    if(reveal){b.classList.toggle('correct',keyCorrect);b.classList.toggle('wrong',selected&&!keyCorrect);}
    const letter=document.createElement('span');letter.className='letter';letter.textContent=q.type==='judge'?'':k;
    const text=document.createElement('span');text.textContent=v+(reveal?(keyCorrect?'（正确项）':selected?'（误选）':''):'');
    b.append(letter,text);b.onclick=()=>selectAnswer(q,k);$('options').append(b);
  }
  $('confirmAnswer').classList.toggle('hidden',examMode||reviewMode||q.type!=='multi'||!!checked[q.id]);
  $('confirmAnswer').disabled=!answered(q);$('confirmAnswer').onclick=checkCurrent;
  const ex=$('explain');ex.replaceChildren();ex.className=reveal?(isCorrect(q,current)?'okbox':'badbox'):'hidden';
  if(reveal){
    const title=document.createElement('b');title.textContent=!submitted(q)?'未提交答案':isCorrect(q,current)?'回答正确':'回答错误';
    const ans=document.createElement('p');ans.textContent='题库答案：'+q.answer;
    const desc=document.createElement('p');desc.className='explanation';desc.textContent=q.explanation;
    const note=document.createElement('p');note.className='small';note.textContent=`${q.explanationStatus}。原题库答案保留；解析用于备赛，不是赛事官方解答。`;
    ex.append(title,ans,desc,note);
    for(const source of q.references||[]){
      if(!/^https:\/\//.test(source.url))continue;
      const a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';ex.append(a,document.createElement('br'));
    }
  }
  $('favBtn').textContent=ids(favKey).includes(q.id)?'已收藏':'收藏';
  $('prevBtn').disabled=idx===0;
  $('nextBtn').textContent=idx===paper.length-1?(reviewMode?'返回成绩':examMode?'交卷':'完成'):'下一题';
  $('finishBtn').textContent=reviewMode?'返回成绩':examMode?'交卷':'结束练习';
  renderCard();
}
function selectAnswer(q,k){
  if(finished||reviewMode||(!examMode&&checked[q.id]))return;
  if(q.type==='multi'){const a=answers[q.id]||[];answers[q.id]=a.includes(k)?a.filter(x=>x!==k):[...a,k].sort();}
  else {answers[q.id]=k;if(!examMode){checked[q.id]=true;record(q);}}
  render();
}
function checkCurrent(){const q=paper[idx];if(!answered(q)||checked[q.id]||examMode||reviewMode)return;checked[q.id]=true;record(q);render();}
function record(q){
  if(recorded[q.id]||!submitted(q))return;recorded[q.id]=true;
  let wrong=ids(wrongKey).filter(id=>id!==q.id);
  if(!isCorrect(q,answers[q.id])){wrong.push(q.id);const s=stats();s[q.id]={wrong:(s[q.id]?.wrong||0)+1};write(statsKey,s);}
  write(wrongKey,wrong);
}
function toggleFav(){const q=paper[idx],a=ids(favKey);write(favKey,a.includes(q.id)?a.filter(id=>id!==q.id):[...a,q.id]);render();}
function jump(i){idx=i;render();$('qText').scrollIntoView({block:'center'});}
function prevQ(){if(idx>0)jump(idx-1);}
function nextQ(){if(idx<paper.length-1)jump(idx+1);else finish();}
function renderCard(){
  const done=paper.filter(submitted).length,pending=paper.filter(q=>answered(q)&&!submitted(q)).length;
  $('cardSummary').textContent=`答题卡 · 已答 ${done} / ${paper.length} · 未提交 ${paper.length-done}`;
  $('cardHint').textContent=`空白 ${paper.length-done-pending} 题，已选待确认 ${pending} 题。点击题号跳转。`;
  $('cardGrid').replaceChildren();
  paper.forEach((q,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i+1;b.className='card-number';
    let status=submitted(q)?'已答':answered(q)?'待确认':'未答';
    if(reviewMode&&submitted(q)) status=isCorrect(q,answers[q.id])?'答对':'答错';
    b.dataset.state=status;b.setAttribute('aria-label',`第 ${i+1} 题，${status}`);b.title=status;
    if(i===idx)b.setAttribute('aria-current','true');b.onclick=()=>jump(i);$('cardGrid').append(b);});
}
function firstBlank(){const i=paper.findIndex(q=>!submitted(q));if(i<0)alert('所有题目均已提交');else jump(i);}
function finish(force=false){
  if(reviewMode){reviewMode=false;showScreen('result');return;}
  if(finished||!paper.length)return;
  const blank=paper.filter(q=>!submitted(q)).length;
  if(!force&&blank&&!confirm(`还有 ${blank} 题未提交（包括多选待确认）。确定结束并计为未答吗？取消后可用答题卡继续作答。`))return;
  finished=true;clearInterval(timerHandle);
  let score=0,max=0,correct=0;
  paper.forEach(q=>{const pts=q.type==='multi'?2:1;max+=pts;if(submitted(q)&&isCorrect(q,answers[q.id])){score+=pts;correct++;}record(q);});
  const item={time:Date.now(),mode:modeName,score,max,correct,total:paper.length,blank};
  write(historyKey,[item,...history()].slice(0,10));
  $('result').innerHTML=`<div class="card"><h2>${examMode?'考试':'练习'}结果${force?' · 时间到':''}</h2><div class="grid">
    <div class="stat"><b>${score} / ${max}</b><span>卷面得分</span></div>
    <div class="stat"><b>${(correct/paper.length*100).toFixed(1)}%</b><span>答题正确率（按题数）</span></div>
    <div class="stat"><b>${correct} / ${paper.length}</b><span>答对题数</span></div>
    <div class="stat"><b>${blank}</b><span>未提交题数</span></div></div>
    <p class="small">单选 / 判断每题 1 分，多选每题 2 分；多选全对才得分。未答不计入高频错题。</p>
    <div class="grid"><button onclick="reviewPaper()">查看本卷解析</button><button class="secondary" onclick="goHome()">返回首页</button></div></div>`;
  showScreen('result');renderHome();
}
function reviewPaper(){reviewMode=true;idx=0;showScreen('quiz');render();$('timer').textContent='试卷回顾';}
function goHome(){
  if(!finished&&paper.length&&!$('quiz').classList.contains('hidden')&&!confirm('返回首页将放弃当前未结束的练习或考试，是否继续？'))return;
  clearInterval(timerHandle);paper=[];endAt=null;reviewMode=false;showScreen('home');renderHome();
}
function tick(){
  if(!endAt){$('timer').textContent='不限时';return;}
  const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));
  $('timer').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  if(left===0)finish(true);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!finished&&endAt)tick();});
window.addEventListener('beforeunload',e=>{if(paper.length&&!finished){e.preventDefault();e.returnValue='';}});
function renderHome(){
  $('historyList').replaceChildren();const h=history();
  if(!h.length)$('historyList').textContent='暂无成绩，完成考试或练习后自动保存。';
  for(const x of h){const p=document.createElement('p');p.className='history-row';p.textContent=`${new Date(x.time).toLocaleString('zh-CN')} · ${x.mode} · ${x.score}/${x.max} 分 · 未答 ${x.blank??'—'} 题`;$('historyList').append(p);}
  $('frequentList').replaceChildren();const list=ranked(),s=stats();
  if(!list.length)$('frequentList').textContent='暂无统计。每轮正式提交答错计 1 次；答对移出错题本，累计次数仍保留。';
  for(const q of list.slice(0,10)){const b=document.createElement('button');b.className='ghost frequent-row';b.textContent=`错 ${s[q.id].wrong} 次 · #${q.id} ${q.question}`;b.onclick=()=>begin([q],'高频错题');$('frequentList').append(b);}
}
function applyTheme(theme){document.documentElement.dataset.theme=theme; $('themeBtn').textContent=theme==='dark'?'切换浅色':'切换深色';$('themeBtn').setAttribute('aria-pressed',String(theme==='dark'));document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#111827':'#f5f7fb';}
const preferred=read('jj_robot_theme_v3',null);applyTheme(['dark','light'].includes(preferred)?preferred:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
$('themeBtn').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';write('jj_robot_theme_v3',t);applyTheme(t);};
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn').hidden=false;});
$('installBtn').onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installBtn').hidden=true;}};
window.addEventListener('appinstalled',()=>{$('installBtn').hidden=true;$('pwaStatus').textContent='已安装到设备。';});
if('serviceWorker' in navigator&&['http:','https:'].includes(location.protocol)&&window.isSecureContext){
  navigator.serviceWorker.register('./sw.js').then(async()=>{await navigator.serviceWorker.ready;$('pwaStatus').textContent='离线资源已准备好。可通过浏览器菜单安装或添加到主屏幕。';}).catch(()=>{$('pwaStatus').textContent='离线资源准备失败，请联网刷新重试。';});
}else $('pwaStatus').textContent='直接打开文件可答题；安装 PWA 需通过 HTTPS 或本机 localhost 访问。iPhone 请用 Safari 的“添加到主屏幕”。';
renderHome();
if(storageWarning)warnStorage();
