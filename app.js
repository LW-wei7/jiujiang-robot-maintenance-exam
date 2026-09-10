'use strict';
const $ = id => document.getElementById(id);
const wrongKey='jj_robot_official_202609_wrong', favKey='jj_robot_official_202609_fav';
const historyKey='jj_robot_official_202609_history', statsKey='jj_robot_official_202609_stats';
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
function uniqueQuestions(list){const seen=new Set();return list.filter(q=>{const key=q.dedupeKey||q.question;if(seen.has(key))return false;seen.add(key);return true;});}
const playable=BANK.filter(q=>!q.incomplete);
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pick(a,n){return shuffle(a).slice(0,n);}
function typeName(t){return {single:'单选题',judge:'判断题'}[t];}
function sourceLabel(q){return `${q.type==='single'?'选择':'判断'} ${q.source_no_label}`;}
function answered(q){return !q.incomplete&&typeof answers[q.id]==='string'&&answers[q.id].length>0;}
function submitted(q){return answered(q)&&(examMode||!!checked[q.id]);}
function isCorrect(q,a){return !q.incomplete&&a===q.source_answer;}
function showScreen(name){for(const s of ['home','quiz','result']) $(s).classList.toggle('hidden',s!==name);$('toolbar').classList.toggle('hidden',name!=='quiz');window.scrollTo(0,0);}
function begin(list,name,seconds=0,issues=false){
  list=seconds?uniqueQuestions(list.filter(q=>!q.incomplete)):list;
  if(!list.length){alert('当前条件下没有题目。请调整筛选条件，或先完成答题、收藏。');return;}
  clearInterval(timerHandle);paper=[...list];modeName=name;examMode=seconds>0;reviewMode=false;issueMode=issues;finished=issues;
  idx=0;answers={};checked={};recorded={};endAt=seconds?Date.now()+seconds*1000:null;
  $('answerCard').open=false;showScreen('quiz');render();tick();
  if(endAt)timerHandle=setInterval(tick,500);
}
function startExam(mode){
  const total=mode==='standard'?90:30, all=uniqueQuestions(shuffle(playable));
  const singleCount=Math.round(total*BANK.filter(q=>q.type==='single').length/BANK.length);
  const counts={single:singleCount,judge:total-singleCount};
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
  $('qText').textContent=q.question;
  $('questionImages').replaceChildren();addImages($('questionImages'),q.images,`${sourceLabel(q)}：原稿机构图，含(a)～(d)标记`);
  const eligible=paper.filter(x=>!x.incomplete).length;
  $('prog').style.width=(eligible?100*paper.filter(submitted).length/eligible:0)+'%';
  $('sourceBox').textContent=`来源：${q.source}｜原题 ${sourceLabel(q)}｜${q.incomplete?'原稿缺项，仅供浏览':q.explanation_status==='needs_review'?'解析有疑点，按题源答案判分':'学习解析已撰写'}${q.duplicate_source_ids.length?`｜原稿另有${q.duplicate_source_ids.length}条同题记录，随机同卷只抽一条`:''}`;
  $('options').replaceChildren();
  const current=answers[q.id],entries=q.type==='judge'?[['正确','正确'],['错误','错误']]:Object.entries(q.options);
  for(const [k,v] of entries){
    const b=document.createElement('button');b.className='option';b.type='button';
    const selected=current===k,keyCorrect=q.source_answer===k;
    b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=!!reveal;
    if(reveal&&!readonly){b.classList.toggle('correct',keyCorrect);b.classList.toggle('wrong',selected&&!keyCorrect);}
    const letter=document.createElement('span');letter.className='letter';letter.textContent=q.type==='judge'?'':k;
    const content=document.createElement('span');content.className='option-content';
    const text=document.createElement('span');text.textContent=(v||((q.option_images[k]||[]).length?'':'【原稿缺少此选项】'))+(reveal&&!readonly?(keyCorrect?'（题源正确项）':selected?'（误选）':''):'');
    content.append(text);addImages(content,q.option_images[k],`${sourceLabel(q)}：原稿${k}项公式`);
    b.append(letter,content);b.onclick=()=>selectAnswer(q,k);$('options').append(b);
  }
  const ex=$('explain');ex.replaceChildren();ex.className=readonly?'notice':reveal?(isCorrect(q,current)?'okbox':'badbox'):'hidden';
  if(reveal){
    const title=document.createElement('b');title.textContent=readonly?'原稿缺项 · 仅供浏览，不计分':!submitted(q)?'未提交答案':isCorrect(q,current)?'回答正确（按题源）':'回答错误（按题源）';
    const ans=document.createElement('p');ans.textContent='题源答案：'+q.source_answer+'（主办方提供）';
    const label=document.createElement('p');label.className='small';label.textContent='学习解析：备赛辅助生成，并非主办方官方解析'+(q.explanation_status==='needs_review'?' · 需核对':'');
    const desc=document.createElement('p');desc.className='explanation';desc.textContent=q.explanation;
    ex.append(title,ans,label,desc);
    if(readonly){const note=document.createElement('p');note.textContent=q.incomplete_reason;ex.append(note);}
    for(const source of q.references||[]){
      if(!/^https:\/\//.test(source.url))continue;
      const a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';ex.append(a,document.createElement('br'));
    }
  }
  $('favBtn').textContent=ids(favKey).includes(q.id)?'已收藏':'收藏';
  $('prevBtn').disabled=idx===0;
  $('nextBtn').textContent=idx===paper.length-1?(issueMode?'返回首页':reviewMode?'返回成绩':examMode?'交卷':'完成'):'下一题';
  $('finishBtn').textContent=issueMode?'返回首页':reviewMode?'返回成绩':examMode?'交卷':'结束练习';
  renderCard();
}
function selectAnswer(q,k){
  if(q.incomplete||issueMode||finished||reviewMode||(!examMode&&checked[q.id]))return;
  answers[q.id]=k;
  if(!examMode){checked[q.id]=true;record(q);}
  render();
}
function record(q){
  if(q.incomplete||issueMode||recorded[q.id]||!submitted(q))return;recorded[q.id]=true;
  let wrong=ids(wrongKey).filter(id=>id!==q.id);
  if(!isCorrect(q,answers[q.id])){wrong.push(q.id);const s=stats();s[q.id]={wrong:(s[q.id]?.wrong||0)+1};write(statsKey,s);}
  write(wrongKey,wrong);
}
function toggleFav(){const q=paper[idx],a=ids(favKey);write(favKey,a.includes(q.id)?a.filter(id=>id!==q.id):[...a,q.id]);render();}
function jump(i){idx=i;render();$('qText').scrollIntoView({block:'center'});}
function prevQ(){if(idx>0)jump(idx-1);}
function nextQ(){if(idx<paper.length-1)jump(idx+1);else finish();}
function renderCard(){
  const eligible=paper.filter(q=>!q.incomplete),done=eligible.filter(submitted).length;
  $('cardSummary').textContent=`答题卡 · 已提交 ${done} / ${eligible.length}`;
  $('cardHint').textContent=`未提交 ${eligible.length-done} 题；原稿缺项 ${paper.length-eligible.length} 题仅浏览。点击题号跳转。`;
  $('cardGrid').replaceChildren();
  paper.forEach((q,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i+1;b.className='card-number';
    let status=issueMode||q.incomplete?'待核对':submitted(q)?'已答':'未答';
    if(reviewMode&&submitted(q))status=isCorrect(q,answers[q.id])?'答对':'答错';
    b.dataset.state=status;b.setAttribute('aria-label',`第 ${i+1} 题，原题 ${sourceLabel(q)}，${status}`);b.title=`${sourceLabel(q)} · ${status}`;
    if(i===idx)b.setAttribute('aria-current','true');b.onclick=()=>jump(i);$('cardGrid').append(b);});
}
function firstBlank(){const i=paper.findIndex(q=>!q.incomplete&&!submitted(q));if(i<0)alert('可答题目均已提交');else jump(i);}
function finish(force=false){
  if(issueMode||paper.every(q=>q.incomplete)){goHome();return;}
  if(reviewMode){reviewMode=false;showScreen('result');return;}
  if(finished||!paper.length)return;
  const scored=paper.filter(q=>!q.incomplete),blank=scored.filter(q=>!submitted(q)).length;
  if(!force&&blank&&!confirm(`还有 ${blank} 题未提交。确定结束并计为未答吗？取消后可用答题卡继续作答。`))return;
  finished=true;clearInterval(timerHandle);
  let score=0,max=0,correct=0;
  scored.forEach(q=>{const pts=1;max+=pts;if(submitted(q)&&isCorrect(q,answers[q.id])){score+=pts;correct++;}record(q);});
  const item={time:Date.now(),mode:modeName,score,max,correct,total:scored.length,blank};
  write(historyKey,[item,...history()].slice(0,10));
  $('result').innerHTML=`<div class="card"><h2>${examMode?'考试':'练习'}结果${force?' · 时间到':''}</h2><div class="grid">
    <div class="stat"><b>${score} / ${max}</b><span>卷面得分</span></div>
    <div class="stat"><b>${(correct/scored.length*100).toFixed(1)}%</b><span>答题正确率（按题数）</span></div>
    <div class="stat"><b>${correct} / ${scored.length}</b><span>答对题数</span></div>
    <div class="stat"><b>${blank}</b><span>未提交题数</span></div></div>
    <p class="small">单选 / 判断每题 1 分，均按主办方题源答案判分。原稿缺项题不计分；未答不计入高频错题。</p>
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
  for(const t of ['single','judge'])$('count-'+t).textContent=BANK.filter(q=>q.type===t).length;
  $('count-incomplete').textContent=BANK.length-playable.length;
  $('auditSummary').textContent=`原稿有${BANK.length}条，完整可答${playable.length}条，按题干去重后${uniqueQuestions(playable).length}条可组卷。选择188缺失，240之后又编号41；源编号均保留。${BANK.filter(q=>q.explanation_status==='needs_review').length}条解析有具体疑点，判分仍保留主办方答案。`;
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
function applyTheme(theme){document.documentElement.dataset.theme=theme; $('themeBtn').textContent=theme==='dark'?'切换浅色':'切换深色';$('themeBtn').setAttribute('aria-pressed',String(theme==='dark'));document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#111827':'#f5f7fb';}
const preferred=read('jj_robot_theme_v3',null);applyTheme(['dark','light'].includes(preferred)?preferred:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
$('themeBtn').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';write('jj_robot_theme_v3',t);applyTheme(t);};
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
