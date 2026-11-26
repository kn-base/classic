"use strict";
/* ============================================================
   Spotify とのつなぎ（リモコン方式）
   ・Classic は Spotify アプリに「この曲を再生して」と指示を送るだけ。音を鳴らすのは Spotify アプリ
   ・Spotify から受け取るのはデータ（曲名・ジャケットの住所など）だけで、Spotify のプログラムは読み込まない
   ・ログインはサーバー不要の方式（PKCE）。秘密の鍵（Client secret）は使わない
   ・権限は「再生の操作」「再生状態を見る」「ライブラリとプレイリストを見る」だけ（書き込みはしない）
   ============================================================ */
const SP=(()=>{
  const CID="4af71328e470481db42a0a5228971162";            // Client ID（公開してよい番号）
  const REDIRECT="https://kn-base.github.io/classic/";       // Spotify の開発者サイトに登録した戻り先と完全に同じにする
  const SCOPES=["user-read-playback-state","user-modify-playback-state","user-read-currently-playing",
                "user-library-read","playlist-read-private","playlist-read-collaborative"].join(" ");
  const KEY="cw-sp",PKCE="cw-sp-pkce";
  let tok=null;try{tok=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
  const save=()=>{try{tok?localStorage.setItem(KEY,JSON.stringify(tok)):localStorage.removeItem(KEY)}catch(e){}};
  let onChange=()=>{};

  /* ---------- ログイン ---------- */
  const b64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  async function login(){
    const v=b64u(crypto.getRandomValues(new Uint8Array(48)));
    const ch=b64u(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
    const st=b64u(crypto.getRandomValues(new Uint8Array(16)));
    try{localStorage.setItem(PKCE,JSON.stringify({v,st}))}catch(e){}
    const q=new URLSearchParams({client_id:CID,response_type:"code",redirect_uri:REDIRECT,
      code_challenge_method:"S256",code_challenge:ch,scope:SCOPES,state:st});
    location.href="https://accounts.spotify.com/authorize?"+q;
  }
  async function tokenReq(body){
    const r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(body)});
    let j=null;try{j=await r.json()}catch(e){}
    if(!r.ok){const e=new Error((j&&(j.error_description||j.error))||("HTTP "+r.status));e.status=r.status;throw e}
    tok={access:j.access_token,refresh:j.refresh_token||(tok&&tok.refresh),exp:Date.now()+((j.expires_in||3600)-60)*1000};save();
  }
  /* Spotify のログイン画面から戻ってきたとき（住所に ?code= が付いている）にトークンを受け取る */
  async function handleRedirect(){
    const p=new URLSearchParams(location.search);
    if(!p.has("code")&&!p.has("error"))return null;
    let saved=null;try{saved=JSON.parse(localStorage.getItem(PKCE)||"null")}catch(e){}
    try{localStorage.removeItem(PKCE)}catch(e){}
    history.replaceState(null,"",location.pathname);               // 住所から code を消す
    if(p.has("error"))return "ログインがキャンセルされました";
    if(!saved||saved.st!==p.get("state"))return "ログインの確認に失敗しました。もう一度ログインしてください";
    try{await tokenReq({grant_type:"authorization_code",code:p.get("code"),redirect_uri:REDIRECT,client_id:CID,code_verifier:saved.v});
      return "ok"}catch(e){return "ログインに失敗しました（"+e.message+"）"}
  }
  function logout(){tok=null;save();state=null;for(const k in cache)delete cache[k];onChange()}
  async function access(){
    if(!tok)throw Object.assign(new Error("ログインしていません"),{status:401});
    if(Date.now()>tok.exp){
      try{await tokenReq({grant_type:"refresh_token",refresh_token:tok.refresh,client_id:CID})}
      catch(e){if(e.status===400||e.status===401){logout()}throw e}
    }
    return tok.access;
  }

  /* ---------- Web API ---------- */
  async function api(path,opt={}){
    const t=await access();
    const r=await fetch(path.startsWith("https://api.spotify.com/")?path:"https://api.spotify.com/v1"+path,
      {method:opt.method||"GET",body:opt.body,headers:{Authorization:"Bearer "+t,...(opt.body?{"Content-Type":"application/json"}:{})}});
    if(r.status===204||r.status===202)return null;
    let j=null;try{j=await r.json()}catch(e){}
    if(!r.ok){
      const er=j&&j.error;const e=new Error((er&&(er.message||er))||("HTTP "+r.status));
      e.status=r.status;e.reason=er&&er.reason;throw e}
    return j;
  }
  async function pages(path,max=600){
    let out=[],url=path;
    while(url&&out.length<max){const j=await api(url);out=out.concat((j&&j.items)||[]);url=j&&j.next}
    return out;
  }
  const safeImg=u=>typeof u==="string"&&/^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\//i.test(u)?u:null;
  const pickArt=imgs=>{if(!imgs||!imgs.length)return null;const s=imgs.slice().sort((a,b)=>(a.width||0)-(b.width||0));
    return safeImg((s.find(i=>(i.width||0)>=280)||s[s.length-1]).url)};
  const norm=(t,al)=>{
    if(!t||!t.uri||!/^spotify:(track|episode):/.test(t.uri))return null;
    const a=al||t.album||{};
    return {uri:t.uri,title:t.name||"",artist:(t.artists||[]).map(x=>x.name).join(", ")||(t.show&&t.show.name)||"",
      album:a.name||"",art:pickArt(a.images||(t.images)),dur:t.duration_ms||0,no:t.track_number||0};
  };

  /* ライブラリ（読み込んだものはこの画面を開いている間だけ覚えておく） */
  const cache={};
  function cached(key,fn){
    const c=cache[key];if(c)return c;
    cache[key]={loading:true};
    fn().then(d=>{cache[key]={data:d};onChange()}).catch(e=>{cache[key]={err:e};onChange()});
    return cache[key];
  }
  const playlists=()=>cached("pl",async()=>(await pages("/me/playlists?limit=50"))
    .filter(Boolean).map(p=>({id:p.id,uri:p.uri,name:p.name||"",art:pickArt(p.images)})));
  const playlistTracks=id=>cached("pt:"+id,async()=>{
    let items;
    try{items=await pages("/playlists/"+encodeURIComponent(id)+"/items?limit=100")}
    catch(e){items=await pages("/playlists/"+encodeURIComponent(id)+"/tracks?limit=100")}   // 古い住所でも試す
    return items.map(x=>norm(x&&(x.item||x.track))).filter(Boolean);
  });
  const savedTracks=()=>cached("st",async()=>(await pages("/me/tracks?limit=50")).map(x=>norm(x&&x.track)).filter(Boolean));
  const savedAlbums=()=>cached("sa",async()=>(await pages("/me/albums?limit=50",300)).map(x=>{
    const a=x&&x.album;if(!a)return null;
    return {uri:a.uri,name:a.name||"",artist:(a.artists||[]).map(r=>r.name).join(", "),art:pickArt(a.images),
      tracks:((a.tracks&&a.tracks.items)||[]).map(t=>norm(t,a)).filter(Boolean)};
  }).filter(Boolean));

  /* ---------- 再生の状態 ---------- */
  let state=null,lastErr=null;
  async function refresh(){
    if(!tok)return;
    try{const j=await api("/me/player?additional_types=track,episode");
      state=j&&j.item?{playing:!!j.is_playing,prog:j.progress_ms||0,at:Date.now(),item:norm(j.item),device:j.device||null}:
        (j?{playing:false,prog:0,at:Date.now(),item:null,device:j.device||null}:null);
      lastErr=null}
    catch(e){lastErr=e}
    onChange();
  }
  const progress=()=>state?Math.min((state.item&&state.item.dur)||Infinity,state.prog+(state.playing?Date.now()-state.at:0)):0;

  async function devices(){const j=await api("/me/player/devices");return (j&&j.devices)||[]}
  /* 指示を送る。再生先が見つからないときは、この iPhone の Spotify を探して指定し直す */
  async function cmd(method,path,body){
    const opt={method,body:body?JSON.stringify(body):undefined};
    try{await api(path,opt)}
    catch(e){
      if(e.status!==404&&e.reason!=="NO_ACTIVE_DEVICE")throw e;
      const ds=(await devices()).filter(d=>!d.is_restricted);
      const d=ds.find(x=>x.is_active)||ds.find(x=>/smartphone/i.test(x.type))||ds[0];
      if(!d)throw Object.assign(new Error("再生できる端末がありません"),{nodevice:true});
      await api(path+(path.includes("?")?"&":"?")+"device_id="+encodeURIComponent(d.id),opt);
    }
    setTimeout(refresh,500);setTimeout(refresh,1500);
  }
  const playContext=(uri,trackUri)=>cmd("PUT","/me/player/play",{context_uri:uri,offset:{uri:trackUri},position_ms:0});
  const playUris=(uris,pos)=>cmd("PUT","/me/player/play",{uris:uris.slice(pos,pos+100),offset:{position:0},position_ms:0});
  async function toggle(){
    const was=state&&state.playing;
    if(state){state.prog=progress();state.at=Date.now();state.playing=!was;onChange()}  // 先に表示だけ切り替える
    await cmd("PUT",was?"/me/player/pause":"/me/player/play");
  }
  const next=()=>cmd("POST","/me/player/next");
  const prev=()=>cmd("POST","/me/player/previous");
  async function seek(ms){
    if(state){state.prog=Math.max(0,ms);state.at=Date.now();onChange()}
    await cmd("PUT","/me/player/seek?position_ms="+Math.max(0,Math.round(ms)));
  }
  const me=()=>api("/me");

  return {
    connected:()=>!!tok,login,logout,handleRedirect,setOnChange:f=>{onChange=f},
    playlists,playlistTracks,savedTracks,savedAlbums,refresh,progress,get state(){return state},get lastErr(){return lastErr},
    devices,playContext,playUris,toggle,next,prev,seek,me,api,
  };
})();
