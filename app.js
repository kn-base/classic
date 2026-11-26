"use strict";
/* 他人のサイトの中に枠として埋め込まれたら表示しない（だまして操作させる手口を防ぐ） */
if(location.hostname==="kn-base.github.io"&&window.top!==window.self){document.documentElement.style.display="none";throw new Error("framed")}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=t=>{if(!isFinite(t)||t<0)t=0;t=Math.floor(t);return Math.floor(t/60)+":"+String(t%60).padStart(2,"0")};
let ROWS=6;const STEP=Math.PI/12;

/* ---------- 設定（この端末だけに保存） ---------- */
const prefs={click:true,body:"silver",framed:false};
try{Object.assign(prefs,JSON.parse(localStorage.getItem("cw-prefs")||"{}"))}catch(e){}
const savePrefs=()=>{try{localStorage.setItem("cw-prefs",JSON.stringify(prefs))}catch(e){}};
const applyBody=()=>{document.documentElement.classList.toggle("black",prefs.body==="black");if(typeof paintEdge==="function")paintEdge()};
applyBody();
if(navigator.standalone)document.documentElement.classList.add("standalone");
/* 表示モード：画面いっぱい ⇔ 白い机に置いた実物大。本体の何もないところ（または白い机）をタップで切り替え */
const applyMode=()=>{document.documentElement.classList.toggle("framed",!!prefs.framed);paintEdge()};
/* iPhone の全画面表示では、画面の一番下がアプリの外側になり、iPhone がページの背景色で塗る。
   その色を本体の下の端の色に合わせて、帯が見えないようにする（色は style.css の陰影の下端と同じ） */
function paintEdge(){
  const c=prefs.framed?"#ededef":(prefs.body==="black"?"#18191a":"#b4b5b8");
  document.documentElement.style.backgroundColor=c;
  let m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c);
}
applyMode();
function toggleMode(){
  const go=()=>{prefs.framed=!prefs.framed;savePrefs();applyMode();if(typeof render==="function")render()};
  if(document.startViewTransition&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.startViewTransition(go);else go();
}
let tapStart=null;
document.addEventListener("pointerdown",e=>{tapStart=e.target.closest(".bezel,.wheel")?null:{x:e.clientX,y:e.clientY,t:Date.now()}});
document.addEventListener("pointerup",e=>{const s=tapStart;tapStart=null;if(!s||e.target.closest(".bezel,.wheel"))return;
  if(Math.hypot(e.clientX-s.x,e.clientY-s.y)<10&&Date.now()-s.t<500)toggleMode()});

/* ---------- 音（クリック音） ---------- */
/* iPhone では、
   ・画面に触れた瞬間（タップ）にしか音の準備を始められない（ホイールを回す動きは含まれない）
   ・アプリの切り替えや曲の再生のあとに、音の準備が止まることがある
   ・アプリ内で作った効果音はマナーモードで消える
   そこで、触れるたびに準備を確かめて再開し、効果音を「音楽の再生」と同じ扱いにしてマナーモードでも鳴らす */
let actx=null,clickBuf=null;
/* ただし「音楽の再生」扱いの音は、ほかのアプリの音楽（Spotify）を止めてしまう。
   Spotify につないでいる間は「ほかの音と混ぜて鳴らす」扱い（ambient）にして、Spotify を止めない。
   その代わり、Spotify につないでいる間はマナーモードでクリック音が鳴らない */
function setAudioSession(){
  try{if(navigator.audioSession)navigator.audioSession.type=(typeof SP!=="undefined"&&SP.connected())?"ambient":"playback"}catch(e){}
}
setAudioSession();
/* 音の準備を始めた瞬間に iPhone で「ボッ」と小さな破裂音が出ることがあるため、
   アプリを開いたときには準備せず、ホイールや真ん中のボタンに触れたとき（最初のカチッの直前）にだけ準備する。
   裏に回ったら止めておき、戻ってもすぐには再開しない */
function audioReady(){
  if(!prefs.click)return;
  try{
    if(!actx){
      setAudioSession();
      actx=new (window.AudioContext||window.webkitAudioContext)();
      const n=Math.floor(actx.sampleRate*.004);clickBuf=actx.createBuffer(1,n,actx.sampleRate);
      const d=clickBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n)**2*.5;
    }
    if(actx.state!=="running")actx.resume();
  }catch(e){}
}
["pointerdown","touchstart"].forEach(ev=>document.getElementById("wheel").addEventListener(ev,audioReady,{capture:true,passive:true}));
document.addEventListener("keydown",audioReady,{capture:true});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&actx&&actx.state==="running")actx.suspend().catch(()=>{})});
function tick(){
  if(!prefs.click||!actx)return;
  try{
    if(actx.state!=="running"){actx.resume();return}
    const s=actx.createBufferSource();s.buffer=clickBuf;s.connect(actx.destination);s.start();
  }catch(e){}
}

/* ---------- デモ音源（その場で合成） ---------- */
function wav(f,sr){const n=f.length,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,"RIFF");v.setUint32(4,36+n*2,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,f[i]))*32767,true);return new Blob([b],{type:"audio/wav"})}
function synth(bpm,mel,bass,bright){
  const sr=22050,beat=60/bpm,len=mel.reduce((a,x)=>a+x[1],0)*beat+1.2,out=new Float32Array(Math.ceil(len*sr));
  const lay=(seq,amp,dec,h)=>{let t=0;for(const [m,d] of seq){if(m!=null){const f=440*2**((m-69)/12),s0=Math.floor(t*sr),n=Math.floor((d*beat+.5)*sr);
    for(let i=0;i<n&&s0+i<out.length;i++){const x=i/sr,e=Math.min(1,x/.008)*Math.exp(-x/dec),p=2*Math.PI*f*x;
      out[s0+i]+=amp*e*(Math.sin(p)+h*Math.sin(2*p)+h*.4*Math.sin(3*p))}}t+=d*beat}};
  lay(mel,.28,.45,bright);lay(bass,.22,.7,.15);return wav(out,sr)}
const M=(s)=>s.trim().split(/\s+/).map(x=>{const [n,d]=x.split(":");return [n==="-"?null:+n,+(d||1)]});
const DEMO=[
  {title:"朝のホイール",bpm:112,b:.5,mel:"72 76 79 76 74:2 72:2 69 72 74 76 72:4 72 76 79 81 79:2 76:2 74 76 74 72 69:4 67 69 72 74 76:2 79:2 81 79 76 74 72:4",
   bass:"48:4 45:4 41:4 43:4 48:4 45:4 41:4 43:4 48:4 45:4 41:4 43:4"},
  {title:"銀色の午後",bpm:84,b:.25,mel:"69:2 72 74 76:3 74 72:2 69:2 67:4 69:2 72 74 79:3 76 74:4 - 72 74 76:2 74 72 69:2 67 69:4 72:4",
   bass:"45:4 41:4 43:4 40:4 45:4 41:4 43:4 40:4 45:4"},
  {title:"夜のシャッフル",bpm:128,b:.7,mel:"67 - 67 70 72 - 70 67 65 - 65 67 70:2 - - 67 - 67 70 72 75 74 72 70 67 65 67 67:4 72 - 72 75 77 75 72 70 72 70 67 65 67:4",
   bass:"43:2 43:2 41:2 41:2 43:2 43:2 39:2 41:2 43:2 43:2 41:2 41:2 43:2 43:2 39:2 41:2 43:4"},
].map((d,i)=>({id:"demo"+i,demo:true,title:d.title,artist:"デモ音源",album:"Classic デモ",no:i+1,art:null,
  gen:()=>synth(d.bpm,M(d.mel),M(d.bass),d.b)}));

/* ---------- 曲の保存（IndexedDB・この端末だけ） ---------- */
let db=null;
function openDB(){return new Promise(res=>{try{const r=indexedDB.open("classic-wheel",1);
  r.onupgradeneeded=()=>r.result.createObjectStore("tracks",{keyPath:"id"});
  r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>res()}catch(e){res()}})}
const tx=(mode,fn)=>new Promise(res=>{if(!db)return res(null);try{const t=db.transaction("tracks",mode),s=t.objectStore("tracks"),r=fn(s);
  t.oncomplete=()=>res(r&&r.result);t.onerror=()=>res(null)}catch(e){res(null)}});
let mine=[];
const lib=()=>mine.length?mine:DEMO;

function readTags(file){return new Promise(res=>{
  const done=v=>{clearTimeout(to);res(v)},to=setTimeout(()=>res({}),4000);
  if(!window.jsmediatags)return done({});
  try{window.jsmediatags.read(file,{onSuccess:t=>{const g=t.tags||{},o={title:g.title,artist:g.artist,album:g.album,no:parseInt(g.track)||0};
    if(g.picture&&g.picture.data){let s="";const a=g.picture.data;for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode.apply(null,a.slice(i,i+8192));
      o.art="data:"+(g.picture.format||"image/jpeg")+";base64,"+btoa(s)}done(o)},onError:()=>done({})})}catch(e){done({})}})}

async function addFiles(files){
  if(!files.length)return;
  toast("読み込み中…");
  let n=0;
  for(const f of files){
    const tg=await readTags(f);
    const base=f.name.replace(/\.[^.]+$/,""),m=base.match(/^(.+?)\s+-\s+(.+)$/);
    const t={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:tg.title||(m?m[2]:base),
      artist:tg.artist||(m?m[1]:"不明なアーティスト"),album:tg.album||"不明なアルバム",no:tg.no||0,art:tg.art||null,blob:f};
    mine.push(t);await tx("readwrite",s=>s.put(t));n++;
  }
  toast(n+"曲を追加しました");render();
}
$("#file").addEventListener("change",e=>{addFiles([...e.target.files]);e.target.value=""});

/* ---------- 再生 ---------- */
const audio=new Audio();audio.preload="auto";audio.setAttribute("playsinline","");
const canVol=(()=>{const a=new Audio();a.volume=.5;return a.volume!==1})();
let queue=[],qi=-1,curUrl=null;
const cur=()=>queue[qi];
/* Spotify につないでいるか（つないでいる間は、ライブラリも再生も Spotify を使う） */
const SPM=()=>typeof SP!=="undefined"&&SP.connected();
function load(play=true){
  const t=cur();if(!t)return;
  if(curUrl)URL.revokeObjectURL(curUrl);
  if(!t.blob&&t.gen)t.blob=t.gen();
  curUrl=URL.createObjectURL(t.blob);audio.src=curUrl;
  if(play)audio.play().catch(()=>{});
  if("mediaSession" in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:t.album,
    artwork:t.art?[{src:t.art,sizes:"512x512"}]:[]})}catch(e){}}
  render();
}
function playList(list,i){queue=list.slice();qi=i;load();push(nowView())}
function shuffleAll(){const a=lib().slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}playList(a,0)}
function next(){if(qi<queue.length-1){qi++;load()}}
function prev(){if(audio.currentTime>3||qi===0){audio.currentTime=0}else{qi--;load()}}
function playPause(){if(!cur())return;if(audio.paused)audio.play().catch(()=>{});else audio.pause()}
audio.addEventListener("ended",()=>{if(qi<queue.length-1)next();else render()});
["play","pause"].forEach(ev=>audio.addEventListener(ev,()=>render()));
audio.addEventListener("timeupdate",()=>{if(cv().type==="now")drawNow()});
audio.addEventListener("loadedmetadata",()=>{if(cv().type==="now")drawNow()});
if("mediaSession" in navigator){try{const ms=navigator.mediaSession;
  ms.setActionHandler("play",()=>audio.play());ms.setActionHandler("pause",()=>audio.pause());
  ms.setActionHandler("nexttrack",next);ms.setActionHandler("previoustrack",prev)}catch(e){}}

/* ---------- 画面（メニューの階層） ---------- */
const by=(k)=>{const m=new Map();for(const t of lib()){const v=t[k];if(!m.has(v))m.set(v,[]);m.get(v).push(t)}return m};
const sortT=a=>a.slice().sort((x,y)=>x.album===y.album?(x.no-y.no)||x.title.localeCompare(y.title,"ja"):x.album.localeCompare(y.album,"ja"));
const songItems=list=>list.map((t,i)=>({label:t.title,act:()=>playList(list,i)}));
const menu=(title,items)=>({type:"menu",title,items,sel:0,top:0});

function rootView(){return menu("Classic",()=>SPM()?[
  {label:"ミュージック",sub:spMusicView},
  {label:"シャッフル再生",act:spShuffle},
  {label:"設定",sub:settingsView},
  ...(SP.state&&SP.state.item?[{label:"再生中",sub:nowView}]:[]),
]:[
  {label:"ミュージック",sub:musicView},
  {label:"シャッフル再生",act:shuffleAll},
  {label:"曲を追加",act:()=>$("#file").click()},
  {label:"設定",sub:settingsView},
  ...(cur()?[{label:"再生中",sub:nowView}]:[]),
])}
function musicView(){return menu("ミュージック",()=>[
  {label:"アーティスト",sub:()=>menu("アーティスト",()=>[...by("artist")].sort((a,b)=>a[0].localeCompare(b[0],"ja"))
     .map(([ar,ts])=>({label:ar,sub:()=>artistView(ar,ts)})))},
  {label:"アルバム",sub:()=>menu("アルバム",()=>[...by("album")].sort((a,b)=>a[0].localeCompare(b[0],"ja"))
     .map(([al,ts])=>({label:al,sub:()=>menu(al,()=>songItems(sortT(ts)))})))},
  {label:"曲",sub:()=>menu("曲",()=>songItems(lib().slice().sort((a,b)=>a.title.localeCompare(b.title,"ja"))))},
])}
function artistView(ar,ts){const albums=[...new Set(ts.map(t=>t.album))];
  return menu(ar,()=>[{label:"すべての曲",sub:()=>menu(ar,()=>songItems(sortT(ts)))},
    ...albums.map(al=>({label:al,sub:()=>menu(al,()=>songItems(sortT(ts.filter(t=>t.album===al))))}))])}
function settingsView(){return menu("設定",()=>[
  {label:"Spotify",right:SPM()?"接続中":"未接続",sub:spSettingsView},
  {label:"クリック音",right:prefs.click?"オン":"オフ",act:()=>{prefs.click=!prefs.click;savePrefs();tick();render()}},
  {label:"本体カラー",right:prefs.body==="black"?"ブラック":"シルバー",act:()=>{prefs.body=prefs.body==="black"?"silver":"black";savePrefs();applyBody();render()}},
  ...(SPM()?[]:[{label:"曲数",right:mine.length?mine.length+"曲":"デモ "+DEMO.length+"曲",dis:true}]),
  ...(!SPM()&&mine.length?[{label:"追加した曲を消去",sub:()=>menu("消去しますか？",()=>[
    {label:"キャンセル",act:pop},
    {label:"すべて消去する",act:async()=>{await tx("readwrite",s=>s.clear());mine=[];audio.pause();queue=[];qi=-1;stack=[rootView()];toast("消去しました");render()}}])}]:[]),
])}
function nowView(){return {type:"now",title:"再生中",mode:"",modeT:0,seekTo:null}}

/* ---------- Spotify のメニュー ---------- */
/* 読み込み中・失敗のときは、その旨を1行で出す */
function asyncItems(c,mk){
  if(c.loading)return [{label:"読み込み中…",dis:true}];
  if(c.err)return [{label:spErrText(c.err),dis:true}];
  const it=mk(c.data);return it.length?it:[{label:"（ありません）",dis:true}];
}
const chunks=(t,n)=>{const a=[...t],o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n).join(""));return o};
const byName=(a,b)=>a.name.localeCompare(b.name,"ja");
/* すべての曲＝保存した曲＋保存したアルバムの曲（重複は1つに）。並べ替えた結果は覚えておき、ホイールを回すたびに並べ直さない */
let allMemo={a:null,t:null,v:null};
function allSongs(){
  const a=SP.savedAlbums(),t=SP.savedTracks();
  if(a.loading||t.loading)return {loading:true};
  if(a.err&&t.err)return {err:a.err};
  if(allMemo.a===a.data&&allMemo.t===t.data&&allMemo.v)return allMemo.v;
  const m=new Map();
  for(const x of (t.data||[]))m.set(x.uri,x);
  for(const al of (a.data||[]))for(const x of al.tracks)if(!m.has(x.uri))m.set(x.uri,x);
  const songs=[...m.values()].sort((x,y)=>x.title.localeCompare(y.title,"ja"));
  const ar=new Map();for(const x of songs){const n=x.artist.split(", ")[0]||"不明";if(!ar.has(n))ar.set(n,[]);ar.get(n).push(x)}
  const artists=[...ar].sort((x,y)=>x[0].localeCompare(y[0],"ja"));
  allMemo={a:a.data,t:t.data,v:{data:{songs,artists}}};
  return allMemo.v;
}
const spSongs=(ts,play)=>ts.map((t,i)=>({label:t.title,act:()=>spRun(()=>play(i),true)}));
function spMusicView(){return menu("ミュージック",()=>[
  {label:"プレイリスト",sub:()=>menu("プレイリスト",()=>asyncItems(SP.playlists(),d=>d.map(p=>({label:p.name,
    sub:()=>menu(p.name,()=>asyncItems(SP.playlistTracks(p.id),ts=>spSongs(ts,i=>SP.playContext(p.uri,ts[i].uri))))}))))},
  {label:"アーティスト",sub:()=>menu("アーティスト",()=>asyncItems(allSongs(),d=>d.artists.map(([a,ts])=>({label:a,
      sub:()=>menu(a,()=>spSongs(ts,i=>SP.playUris(ts.map(t=>t.uri),i)))}))))},
  {label:"アルバム",sub:()=>menu("アルバム",()=>asyncItems(SP.savedAlbums(),d=>d.slice().sort(byName).map(a=>({label:a.name,
    sub:()=>menu(a.name,()=>spSongs(a.tracks,i=>SP.playContext(a.uri,a.tracks[i].uri)))}))))},
  {label:"曲",sub:()=>menu("曲",()=>asyncItems(allSongs(),d=>spSongs(d.songs,i=>SP.playUris(d.songs.map(t=>t.uri),i))))},
])}
function spShuffle(){
  const c=allSongs();
  if(!c.data){toast(c.err?spErrText(c.err):"ライブラリを読み込み中です。少し待ってからもう一度選んでください");return}
  const a=c.data.songs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  if(!a.length){toast("保存した曲がありません");return}
  spRun(()=>SP.playUris(a.map(t=>t.uri),0),true);
}
const openSpotify=()=>{location.href="spotify:"};
function spErrText(e){
  if(e.nodevice||e.status===404||e.reason==="NO_ACTIVE_DEVICE")return "Spotify アプリが見つかりません";
  if(e.status===403)return "操作できません（Premium が必要）";
  if(e.status===401)return "ログインし直してください";
  if(e.status===429)return "混み合っています。少し待ってください";
  return "失敗："+(e.message||"不明なエラー");
}
/* Spotify への指示を送る。失敗したら、理由と次にすることを出す。
   Spotify アプリが眠っているときは、指示を覚えておき、Spotify アプリを開いて戻ってきたら自動でもう一度送る */
let spPending=null;
const isSleep=e=>e&&(e.nodevice||e.status===404||e.reason==="NO_ACTIVE_DEVICE");
async function spRun(fn,goNow){
  if(goNow&&cv().type!=="now")push(nowView());
  try{await fn();spPending=null}
  catch(e){
    if(isSleep(e)){
      spPending={fn,at:Date.now()};
      const why="理由："+(e.status||"")+" "+(e.reason||"")+" "+(e.message||"");
      if(cv().type==="menu"&&cv().sleep)cv().why=why;
      else{const v=menu("Spotify",()=>[
        {label:"Spotify アプリを開く",act:openSpotify},
        {label:"もう一度試す",act:()=>spRetry(true)},
        {label:"戻ると自動で再生します",dis:true},
        {label:v.why,dis:true}]);v.sleep=true;v.why=why;push(v)}
      toast("Spotify アプリが眠っています。開いてから戻ってください");
    }else toast(spErrText(e));
  }
}
/* 覚えておいた指示を送り直す（Spotify アプリが目を覚ますまで少し待ちながら数回試す） */
async function spRetry(manual){
  const p=spPending;if(!p)return;
  if(!manual&&Date.now()-p.at>10*60*1000){spPending=null;return}
  toast("Spotify に再生を指示しています…");
  for(let i=0;i<4;i++){
    try{await p.fn();spPending=null;
      while(stack.length>1&&cv().type==="menu"&&cv().sleep)stack.pop();
      if(cv().type!=="now")stack.push(nowView());
      render();toast("再生しました");return}
    catch(e){if(!isSleep(e)){spPending=null;toast(spErrText(e));return}}
    await new Promise(r=>setTimeout(r,1200));
  }
  toast("まだ届きません。Spotify アプリで何か1曲再生してから戻ってください");
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&spPending&&SPM())setTimeout(()=>spRetry(false),600)});
function spSettingsView(){return menu("Spotify",()=>SPM()?[
  {label:"接続テスト",sub:spTestView},
  {label:"無音の曲",right:SP.silent.title,sub:()=>menu("無音の曲",()=>asyncItems(SP.silentCandidates(),d=>d.map(t=>({label:t.title,right:fmt(t.dur/1000),
    sub:()=>({type:"pick",title:"無音の曲",t})}))))},
  {label:"通信の記録",sub:()=>menu("通信の記録",()=>SP.log.length?SP.log.map(x=>({label:(x.st<300?"○ ":"× ")+x.st+" "+x.m+" "+x.p,right:x.t,
    sub:()=>menu("記録の詳細",()=>[{label:"時刻",right:x.t},{label:"指示",right:x.m},{label:"結果",right:String(x.st)},
      ...chunks("宛先 "+x.p,22).map(t=>({label:t,dis:true})),...(x.why?chunks("理由 "+x.why,22).map(t=>({label:t,dis:true})):[])])})):[{label:"（まだありません）",dis:true}])},
  {label:"Spotify アプリを開く",act:openSpotify},
  {label:"ログアウト",sub:()=>menu("ログアウトしますか？",()=>[{label:"キャンセル",act:pop},
    {label:"ログアウトする",act:()=>{SP.logout();setAudioSession();stack=[rootView()];toast("ログアウトしました");render()}}])},
]:[
  {label:"Spotify にログイン",act:()=>{toast("Spotify のログイン画面を開きます");setTimeout(()=>SP.login(),300)}},
  {label:"Premium と Spotify アプリが必要",dis:true},
])}
/* 接続テスト：ログイン・ライブラリ・端末・再生状態を順に確かめて、結果を右側に出す */
function spTestView(){
  const rows=[["ログイン","…"],["プレイリスト","…"],["保存した曲","…"],["保存したアルバム","…"],["再生できる端末","…"],["再生状態","…"]];
  const v=menu("接続テスト",()=>rows.map(([l,r])=>({label:l,right:r})));
  const set=(i,r)=>{rows[i][1]=r;if(cv()===v)drawMenu(v)};
  const go=async(i,fn)=>{try{set(i,await fn())}catch(e){set(i,"NG "+(e.status||"")+" "+(e.reason||e.message||""))}};
  (async()=>{
    await go(0,async()=>{const m=await SP.me();return "OK "+((m&&(m.display_name||m.id))||"")});
    await go(1,async()=>{const j=await SP.api("/me/playlists?limit=1");return "OK "+(j&&j.total!=null?j.total+"件":"")});
    await go(2,async()=>{const j=await SP.api("/me/tracks?limit=1");return "OK "+(j&&j.total!=null?j.total+"曲":"")});
    await go(3,async()=>{const j=await SP.api("/me/albums?limit=1");return "OK "+(j&&j.total!=null?j.total+"枚":"")});
    await go(4,async()=>{const d=await SP.devices();return d.length?d.map(x=>x.name).join("、"):"なし（Spotify を開く）"});
    await go(5,async()=>{await SP.refresh();if(SP.lastErr)throw SP.lastErr;const st=SP.state;return st&&st.item?(st.playing?"再生中":"一時停止中"):"止まっている"});
  })();
  return v;
}

let stack=[rootView()];
const cv=()=>stack[stack.length-1];
function push(v){stack.push(v);render()}
function pop(){if(stack.length>1){stack.pop();render()}}

/* ---------- 描画 ---------- */
const view=$("#view");
/* 液晶の高さに合わせて、1画面に出す行数を決める（行の高さはほぼ一定） */
function fitRows(){const w=$("#ipod").clientWidth,h=view.clientHeight;if(!w||!h)return;
  const n=Math.max(5,Math.min(9,Math.round(h/(w*.086))));if(n!==ROWS){ROWS=n;document.documentElement.style.setProperty("--rows",n)}}
addEventListener("resize",()=>{fitRows();render()});
function render(){
  fitRows();
  const v=cv();
  $("#ttl").textContent=v.title;
  hdr();
  if(v.type==="menu")drawMenu(v);else if(v.type==="pick")drawPick(v);else drawNow(true);
}
function hdr(){
  $("#st").textContent=SPM()?(SP.state&&SP.state.item?(SP.state.playing?"▶":"❚❚"):""):(cur()?(audio.paused?"❚❚":"▶"):"");
}
function drawMenu(v){
  const items=v.items();v.sel=Math.min(v.sel,Math.max(0,items.length-1));
  if(v.sel<v.top)v.top=v.sel;if(v.sel>=v.top+ROWS)v.top=v.sel-ROWS+1;
  if(!items.length){view.innerHTML='<div class="empty">ここには何もありません</div>';return}
  let h='<div class="rows"'+(items.length>ROWS?"":' style="right:0"')+">";
  items.slice(v.top,v.top+ROWS).forEach((it,k)=>{const i=v.top+k;
    h+='<div class="row'+(i===v.sel?" sel":"")+(it.dis?" dis":"")+'"><span class="l">'+esc(it.label)+"</span>"+
      (it.right?'<span class="r">'+esc(it.right)+"</span>":"")+(it.sub?'<span class="a">›</span>':"")+"</div>"});
  h+="</div>";
  if(items.length>ROWS){const hgt=ROWS/items.length*100,tp=v.top/items.length*100;h+='<div class="sb"><i style="top:'+tp+"%;height:"+hgt+'%"></i></div>'}
  view.innerHTML=h;
}
function hue(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h%360}
/* Spotify の再生画面：Spotify から受け取った「今の曲」と再生位置を出す */
let spDrawn=null;
function drawNowSp(full){
  const v=cv(),s=SP.state,t=s&&s.item;
  if(!t){spDrawn=null;view.innerHTML='<div class="empty">Spotify で再生中の曲はありません<br>曲を選ぶと Spotify アプリで再生します</div>';return}
  if(v.mode&&Date.now()-v.modeT>2500){v.mode="";v.seekTo=null}
  const d=(t.dur||0)/1000,c=(v.seekTo!=null?v.seekTo:SP.progress())/1000,p=d>0?Math.min(100,c/d*100):0;
  const bottom='<div class="meter"><i style="width:'+p+'%"></i>'+(v.mode==="scrub"?'<b style="left:'+p+'%"></b>':"")+
    '</div><div class="times"><span>'+fmt(c)+"</span><span>-"+fmt(Math.max(0,d-c))+"</span></div>";
  if(!full&&spDrawn===t.uri&&view.querySelector(".np")){view.querySelector(".np .bot").innerHTML=bottom;return}
  spDrawn=t.uri;
  const h=hue(t.album);
  const art=t.art?'<img src="'+esc(t.art)+'" alt="">':'<div class="ph" style="background:linear-gradient(135deg,hsl('+h+' 60% 62%),hsl('+((h+50)%360)+' 55% 38%))">'+esc([...t.album][0]||"♪")+"</div>";
  view.innerHTML='<div class="np"><div class="cnt">'+esc(s.device?s.device.name:"Spotify")+'</div><div class="main"><div class="art">'+art+
    '</div><div class="meta"><div class="ti">'+esc(t.title)+'</div><div class="ar">'+esc(t.artist)+'</div><div class="al">'+esc(t.album)+
    '</div></div></div><div class="bot" style="display:flex;flex-direction:column;gap:1.4cqw">'+bottom+"</div></div>";
}
/* 無音の曲の候補を、ジャケット付きで大きく見せる */
function drawPick(v){
  const t=v.t,h=hue(t.album),cur=SP.silent.uri===t.uri,on=SP.trialUri===t.uri;
  const art=t.art?'<img src="'+esc(t.art)+'" alt="">':'<div class="ph" style="background:linear-gradient(135deg,hsl('+h+' 60% 62%),hsl('+((h+50)%360)+' 55% 38%))">'+esc([...t.album][0]||"♪")+"</div>";
  view.innerHTML='<div class="np"><div class="cnt">'+(cur?"今使っている曲":"候補")+'</div><div class="main"><div class="art">'+art+
    '</div><div class="meta"><div class="ti">'+esc(t.title)+'</div><div class="ar">'+esc(t.artist)+'</div><div class="al">'+esc(fmt(t.dur/1000))+
    '</div></div></div><div class="times"><span>'+(on?"試し聴き中（音量を上げて確認）":"▶❚❚で試し聴き")+'</span></div>'+
    '<div class="times"><span>真ん中で決定</span><span>MENUで戻る</span></div></div>';
}
function drawNow(full){
  if(SPM())return drawNowSp(full);
  const v=cv(),t=cur();
  if(!t){view.innerHTML='<div class="empty">再生中の曲はありません</div>';return}
  if(v.mode&&Date.now()-v.modeT>2500)v.mode="";
  const d=audio.duration,c=audio.currentTime,p=isFinite(d)&&d>0?c/d*100:0;
  let bottom;
  if(v.mode==="vol"){const vp=audio.volume*100;
    bottom='<div class="volrow"><span>🔈</span><div class="meter"><i style="width:'+vp+'%"></i></div><span>🔊</span></div><div class="times"><span>音量</span><span>'+Math.round(vp)+"</span></div>"}
  else bottom='<div class="meter"><i style="width:'+p+'%"></i>'+(v.mode==="scrub"?'<b style="left:'+p+'%"></b>':"")+'</div><div class="times"><span>'+fmt(c)+"</span><span>-"+fmt((d||0)-c)+"</span></div>";
  if(!full&&view.querySelector(".np")){view.querySelector(".np .bot").innerHTML=bottom;return}
  const h=hue(t.album);
  const art=t.art?'<img src="'+esc(t.art)+'" alt="">':'<div class="ph" style="background:linear-gradient(135deg,hsl('+h+' 60% 62%),hsl('+((h+50)%360)+' 55% 38%))">'+esc([...t.album][0]||"♪")+"</div>";
  view.innerHTML='<div class="np"><div class="cnt">'+(qi+1)+" / "+queue.length+'</div><div class="main"><div class="art">'+art+
    '</div><div class="meta"><div class="ti">'+esc(t.title)+'</div><div class="ar">'+esc(t.artist)+'</div><div class="al">'+esc(t.album)+
    '</div></div></div><div class="bot" style="display:flex;flex-direction:column;gap:1.4cqw">'+bottom+"</div></div>";
}
let toastT;
function toast(msg){clearTimeout(toastT);let el=$("#lcd .toast");if(!el){el=document.createElement("div");el.className="toast";$("#lcd").appendChild(el)}
  el.textContent=msg;toastT=setTimeout(()=>el.remove(),1800)}

/* ---------- 操作 ---------- */
let seekT=null;
function step(dir){
  const v=cv();wake();
  if(v.type==="pick")return;
  if(v.type==="menu"){const n=v.items().length,s=Math.max(0,Math.min(n-1,v.sel+dir));if(s!==v.sel){v.sel=s;tick();drawMenu(v)}return}
  if(SPM()){   // Spotify：ホイールで早送り・巻き戻し（止めてから少しして、まとめて指示を送る）
    if(!SP.state||!SP.state.item)return;
    v.seekTo=Math.max(0,(v.seekTo!=null?v.seekTo:SP.progress())+dir*3000);v.mode="scrub";v.modeT=Date.now();tick();
    clearTimeout(seekT);seekT=setTimeout(()=>{const to=v.seekTo;spRun(()=>SP.seek(to)).then(()=>{v.seekTo=null})},450);
    drawNow();return;
  }
  if(!cur())return;
  if(v.mode!=="scrub"&&canVol){audio.volume=Math.max(0,Math.min(1,audio.volume+dir*.04));v.mode="vol"}
  else{if(isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration-.2,audio.currentTime+dir*3));v.mode="scrub"}
  v.modeT=Date.now();tick();drawNow();
}
function select(){
  const v=cv();wake();tick();
  if(v.type==="menu"){const it=v.items()[v.sel];if(!it||it.dis)return;if(it.sub)push(it.sub());else it.act()}
  else if(v.type==="pick"){SP.endTrial();SP.setSilent(v.t);stack.pop();stack.pop();render();toast("無音の曲を「"+v.t.title+"」にしました")}
  else{v.mode=v.mode==="scrub"?"":"scrub";v.modeT=Date.now();drawNow()}
}
const press={menu:()=>{tick();if(cv().type==="pick")SP.endTrial();pop()},
  next:()=>{tick();if(SPM())spRun(SP.next);else if(cur())next()},
  prev:()=>{tick();if(SPM())spRun(()=>SP.progress()>3000?SP.seek(0):SP.prev());else if(cur())prev()},
  play:()=>{tick();const v=cv();
    if(v.type==="pick"){if(SP.trialUri===v.t.uri)SP.endTrial().then(()=>drawPick(v));else spRun(()=>SP.trial(v.t.uri)).then(()=>{if(cv()===v)drawPick(v)});drawPick(v);return}
    if(SPM())spRun(SP.toggle);else playPause()}};

const wheel=$("#wheel");let drag=null;
function flash(deg){const el=$("#press"),r=deg*Math.PI/180,x=50+Math.cos(r)*36,y=50+Math.sin(r)*36;
  el.style.background="radial-gradient(circle at "+x+"% "+y+"%,rgba(0,0,0,.1),rgba(0,0,0,0) 22%)";
  el.classList.add("on");requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove("on")))}
const ang=e=>{const r=wheel.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))};
wheel.addEventListener("pointerdown",e=>{if(e.target.closest("#center"))return;e.preventDefault();
  try{wheel.setPointerCapture(e.pointerId)}catch(_){}drag={a:ang(e),acc:0,moved:0}});
wheel.addEventListener("pointermove",e=>{if(!drag)return;let a=ang(e),d=a-drag.a;
  if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;drag.a=a;drag.acc+=d;drag.moved+=Math.abs(d);
  while(drag.acc>STEP){drag.acc-=STEP;step(1)}while(drag.acc<-STEP){drag.acc+=STEP;step(-1)}});
const endDrag=e=>{if(!drag)return;const moved=drag.moved;drag=null;if(e.type==="pointercancel"||moved>.3)return;
  const deg=ang(e)*180/Math.PI;wake();
  flash(deg);
  if(deg>-135&&deg<=-45)press.menu();else if(deg>-45&&deg<=45)press.next();else if(deg>45&&deg<=135)press.play();else press.prev()};
wheel.addEventListener("pointerup",endDrag);wheel.addEventListener("pointercancel",endDrag);
$("#center").addEventListener("click",select);
document.addEventListener("keydown",e=>{const k=e.key;
  if(k==="ArrowDown"||k==="ArrowRight"&&cv().type==="now"){e.preventDefault();step(1)}
  else if(k==="ArrowUp"||k==="ArrowLeft"&&cv().type==="now"){e.preventDefault();step(-1)}
  else if(k==="Enter"){e.preventDefault();select()}
  else if(k==="Escape"||k==="Backspace"){e.preventDefault();press.menu()}
  else if(k===" "){e.preventDefault();press.play()}});

/* バックライト：しばらく触らないと少し暗くなる */
let idleT;function wake(){$("#lcd").classList.remove("dim");clearTimeout(idleT);idleT=setTimeout(()=>$("#lcd").classList.add("dim"),20000)}

openDB().then(async()=>{const all=await tx("readonly",s=>s.getAll());if(all&&all.length){mine=all;render()}});
render();wake();

/* ---------- Spotify の初期化 ---------- */
if(typeof SP!=="undefined"){
  // 再生状態が変わったら、見出しと今の画面だけ描き直す
  SP.setOnChange(()=>{hdr();const v=cv();if(v.type==="now")drawNow(false);else if(v.type==="menu")drawMenu(v)});
  SP.handleRedirect().then(r=>{
    if(r==="ok"){setAudioSession();stack=[rootView()];render();toast("Spotify につながりました");SP.refresh()}
    else if(r)toast(r);
  });
  if(SP.connected())SP.refresh();
  setInterval(()=>{if(SPM()&&!document.hidden)SP.refresh()},3000);                       // 3秒ごとに再生状態をもらう
  setInterval(()=>{if(SPM()&&cv().type==="now"&&SP.state&&SP.state.playing)drawNow()},500); // 再生位置のバーを進める
  // アプリに戻ってきたら、再生状態とライブラリを読み直す（今の画面がライブラリならすぐ読み直しが始まる）
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&SPM()){SP.refresh();SP.stale();const v=cv();if(v.type==="menu")drawMenu(v)}});
}

/* オフラインでも開けるようにする */
if("serviceWorker" in navigator&&location.protocol==="https:"){navigator.serviceWorker.register("sw.js").catch(()=>{})}
