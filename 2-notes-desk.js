/* Credentials are entered by the owner at runtime, never shipped in source. */
'use strict';
const NotesGitHub = (() => {
  const endpoint = 'https://api.github.com/repos/mjanthony819/anthony/contents/notes-data.json';
  const storageKey = 'anthony-notes-github-v1';
  let token = '';
  try { token = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey) || ''; } catch {}
  function forget() { token = ''; try { sessionStorage.removeItem(storageKey); localStorage.removeItem(storageKey); } catch {} }
  function remember(value, persistent) {
    forget(); token = value.trim();
    try { (persistent ? localStorage : sessionStorage).setItem(storageKey, token); } catch {}
  }
  function decode(s) { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0))); }
  function encode(s) { let out = ''; for (const byte of new TextEncoder().encode(s)) out += String.fromCharCode(byte); return btoa(out); }
  async function request(method, body) {
    if (!token) throw Error('Connect GitHub above first. Your draft is safe.');
    let r;
    try { r = await fetch(endpoint + (method === 'GET' ? '?ref=main' : ''), {method, cache: 'no-store', credentials: 'omit', redirect: 'error', headers: {'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(30000)}); }
    catch { throw Error(method === 'PUT' ? 'Could not confirm the commit. Check the repository before trying again. Your draft is safe.' : 'Cannot reach GitHub. Check your connection; your draft is safe.'); }
    if (!r.ok) {
      if (r.status === 401) { forget(); throw Error('GitHub token expired or was revoked. Connect a new one; your draft is safe.'); }
      if (r.status === 403 || r.status === 404) throw Error('GitHub refused access. Check that the fine-grained token selects anthony with Contents read and write, and is not expired.');
      if (r.status === 409 || r.status === 422) throw Error('GitHub changed while publishing. Nothing was overwritten. Try again after checking the latest notes.');
      if (r.status === 429) throw Error('GitHub is rate limiting requests. Wait before trying again.');
      throw Error('GitHub did not accept this request. Your draft is safe.');
    }
    return await r.json();
  }
  async function read() {
    const f = await request('GET');
    if (!f.sha || f.encoding !== 'base64' || !f.content) throw Error('Notes data is too large or unavailable. Nothing was changed.');
    const data = JSON.parse(decode(f.content));
    if (data.version !== 1 || !Array.isArray(data.posts)) throw Error('The notes file is not valid. Nothing was changed.');
    return {data, sha: f.sha};
  }
  async function write(data, sha, removal) {
    const content = encode(JSON.stringify(data, null, 2) + '\n');
    if (content.length > 1200000) throw Error('The notes file is getting too large. Use image URLs instead of uploaded photos. Nothing was changed.');
    const result = await request('PUT', {message: removal ? 'Remove a note from the writing desk' : 'Publish a note from the writing desk', content, sha, branch: 'main'});
    if (!result.commit || !result.content || !result.commit.html_url) throw Error('Commit response was incomplete. Check the repository before trying again.');
    return result;
  }
  return {read, write, remember, forget, connected: () => !!token};
})();

let base=null,baseRaw='',id=null,photoData='',busy=false;const fields=['title','date','body','image'];const key='anthony-notes-draft-v1';function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}function values(){return Object.fromEntries(fields.map(k=>[k,$('#'+k).value]))}function post(){return {...values(),id:id||crypto.randomUUID(),image:photoData||$('#image').value.trim()}}function status(s){$('#status').textContent=s}function save(){const p={...values(),id,photoData};try{localStorage.setItem(key,JSON.stringify(p));status('Draft saved on this device.')}catch{status('Draft could not save locally. Use Back up draft.')}$('#words').textContent=($('#body').value.trim().match(/\S+/g)||[]).length+' words';$('#published').hidden=true}function fill(p){for(const k of fields)$('#'+k).value=p[k]||'';if(!p.date)$('#date').value=today();id=p.id||null;photoData=p.photoData||(p.image&&p.image.startsWith('data:image/')?p.image:'');if(photoData)$('#image').value='';$('#photo').value='';$('#words').textContent=($('#body').value.trim().match(/\S+/g)||[]).length+' words'}function file(data,name){const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}for(const k of fields)$('#'+k).addEventListener('input',()=>{if(k==='image')photoData='';save()});$('#preview').onclick=()=>{const box=$('#previewBody');box.replaceChildren(article(post()));$('#dialog').showModal()};$('#close').onclick=()=>$('#dialog').close();$('#export').onclick=()=>file({...post(),photoData},'notes-draft-backup.json');$('#existing').onchange=()=>{if(!confirm('Replace the current local draft? Back it up first if needed.'))return;const p=base.posts.find(p=>p.id===$('#existing').value);fill(p||{});save()};$('#photo').onchange=async()=>{const f=$('#photo').files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>15000000){status('Choose a JPEG, PNG or WebP under 15 MB.');return}try{const bm=await createImageBitmap(f),c=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(bm.width,bm.height));c.width=Math.round(bm.width*scale);c.height=Math.round(bm.height*scale);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);photoData=c.toDataURL('image/jpeg',0.82);bm.close();$('#image').value='';save();status('Photo ready. Preview to check it.')}catch{status('Could not read this image. Try JPEG or PNG.')}};function options(){const select=$('#existing');select.replaceChildren(el('option','New note'));select.firstChild.value='';for(const p of base.posts){const o=el('option',p.title);o.value=p.id;select.append(o)}select.value=id||''}
function authState(){const on=NotesGitHub.connected();$('#connectionSummary').textContent=on?'GitHub connected · publishing settings':'Connect GitHub once to publish';$('#authStatus').textContent=on?'A token is stored in this browser. GitHub checks its permissions when publishing.':'Not connected. Drafting and preview still work.'}
$('#disconnect').onclick=()=>{NotesGitHub.forget();$('#githubToken').value='';authState();status('Token forgotten on this browser. Revoke it on GitHub to invalidate it everywhere.')};
$('#connect').onclick=async()=>{const value=$('#githubToken').value.trim();if(!value.startsWith('github_pat_')){status('Use a fine-grained GitHub token, not a password or classic token.');return}NotesGitHub.remember(value,$('#rememberToken').checked);$('#githubToken').value='';$('#connect').disabled=true;try{await NotesGitHub.read();authState();$('#connection').open=false;status('GitHub connected. You can now publish directly.')}catch(e){NotesGitHub.forget();authState();status(e.message)}finally{$('#connect').disabled=false}};
async function publishChange(p,removal=false){
 if(busy)return;if(!NotesGitHub.connected()){$('#connection').open=true;status('Connect GitHub above first. Your draft is safe.');return}
 busy=true;$('#publish').disabled=true;$('#remove').disabled=true;status('Checking the latest notes on GitHub…');
 try{
  const fresh=await NotesGitHub.read();const old=base.posts.find(n=>n.id===p.id),current=fresh.data.posts.find(n=>n.id===p.id);
  if(JSON.stringify(old)!==JSON.stringify(current))throw Error('This note changed elsewhere. Back up your draft and refresh before publishing. Nothing was overwritten.');
  const posts=fresh.data.posts.filter(n=>n.id!==p.id);if(!removal)posts.push(p);const data={...fresh.data,posts};
  status('Committing to GitHub…');const result=await NotesGitHub.write(data,fresh.sha,removal);
  base=data;baseRaw=JSON.stringify(data);if(removal){id=null;fill({});try{localStorage.removeItem(key)}catch{}}else{id=p.id;try{localStorage.setItem(key,JSON.stringify({...values(),id,photoData}))}catch{}}
  options();$('#commitLink').href=result.commit.html_url;$('#publishResult').textContent=removal?'Removal saved. The live site will update after the Pages build.':'Your note is saved in the repository. The live site will update after the Pages build.';$('#published').hidden=false;status('Commit saved. Waiting for GitHub Pages to update the live site.');
 }catch(e){status(e.message)}finally{busy=false;$('#publish').disabled=false;$('#remove').disabled=false;authState()}
}
$('#form').onsubmit=async e=>{e.preventDefault();if(!base)return;const p=post();id=p.id;save();if(!p.title.trim()||!p.body.trim()){status('Add a title and story.');return}try{if(p.image&&!cover(p.image))throw Error('Use an HTTPS image URL.');await publishChange(p)}catch(e){status(e.message)}};$('#remove').onclick=async()=>{if(!id||!base.posts.some(p=>p.id===id)){status('Choose a published note first.');return}if(!confirm('Remove this note from the live site? This commits immediately. It remains in GitHub history.'))return;try{await publishChange({id},true)}catch(e){status(e.message)}};getData().then(d=>{base=d;baseRaw=JSON.stringify(d);options();authState();let draft=null;try{draft=JSON.parse(localStorage.getItem(key)||'null')}catch{}fill(draft||{});$('#publish').disabled=false;status(draft?'Local draft restored.':'Ready. Your first note starts here.')}).catch(e=>status(e.message));