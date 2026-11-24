/* The publish key is entered by the owner at runtime, never shipped in source.
   Publishing goes through a private relay (Cloudflare Worker); no GitHub token
   ever touches this browser. */
'use strict';
const NotesRelay = (() => {
 const endpoint = 'https://anthony-notes-publisher.mjanthony819.workers.dev';
 const storageKey = 'anthony-notes-publish-key-v1';
 let key = '';
 try { key = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey) || ''; } catch {}
 function forget() { key = ''; try { sessionStorage.removeItem(storageKey); localStorage.removeItem(storageKey); } catch {} }
 function remember(value, persistent) {
 forget(); key = value.trim();
 try { (persistent ? localStorage : sessionStorage).setItem(storageKey, key); } catch {}
 }
 async function call(route, payload) {
 if (!key) throw Error('Add your publish key above first. Your draft is safe.');
 let r;
 try { r = await fetch(endpoint + route, {method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({key, ...payload}), signal: AbortSignal.timeout(40000)}); }
 catch { throw Error('Cannot reach the publish relay. Check your connection; your draft is safe.'); }
 let out = null;
 try { out = await r.json(); } catch {}
 if (!r.ok) {
 if (r.status === 401) { forget(); throw Error('That publish key is wrong or was changed. Enter the current one; your draft is safe.'); }
 if (r.status === 409) throw Error('The notes changed while publishing. Nothing was overwritten. Try again after checking the latest notes.');
 if (r.status === 429) throw Error('Too many attempts. Wait a few minutes before trying again.');
 throw Error((out && out.error) || 'Publishing failed. Your draft is safe.');
 }
 return out;
 }
 return {check: () => call('/check', {}), publish: p => call('/publish', {post: p}), remove: id => call('/remove', {id}), remember, forget, connected: () => !!key};
})();

let base=null,baseRaw='',id=null,photoData='',busy=false;const fields=['title','date','body','image'];const key='anthony-notes-draft-v1';function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}function values(){return Object.fromEntries(fields.map(k=>[k,$('#'+k).value]))}function post(){return {...values(),id:id||crypto.randomUUID(),image:photoData||$('#image').value.trim()}}function status(s){$('#status').textContent=s}function save(){const p={...values(),id,photoData};try{localStorage.setItem(key,JSON.stringify(p));status('Draft saved on this device.')}catch{status('Draft could not save locally. Use Back up draft.')}$('#words').textContent=($('#body').value.trim().match(/\S+/g)||[]).length+' words';$('#published').hidden=true}function fill(p){for(const k of fields)$('#'+k).value=p[k]||'';if(!p.date)$('#date').value=today();id=p.id||null;photoData=p.photoData||(p.image&&p.image.startsWith('data:image/')?p.image:'');if(photoData)$('#image').value='';$('#photo').value='';$('#words').textContent=($('#body').value.trim().match(/\S+/g)||[]).length+' words'}function file(data,name){const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}for(const k of fields)$('#'+k).addEventListener('input',()=>{if(k==='image')photoData='';save()});$('#preview').onclick=()=>{const box=$('#previewBody');box.replaceChildren(article(post()));$('#dialog').showModal()};$('#close').onclick=()=>$('#dialog').close();$('#export').onclick=()=>file({...post(),photoData},'notes-draft-backup.json');$('#existing').onchange=()=>{if(!confirm('Replace the current local draft? Back it up first if needed.'))return;const p=base.posts.find(p=>p.id===$('#existing').value);fill(p||{});save()};$('#photo').onchange=async()=>{const f=$('#photo').files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>15000000){status('Choose a JPEG, PNG or WebP under 15 MB.');return}try{const bm=await createImageBitmap(f),c=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(bm.width,bm.height));c.width=Math.round(bm.width*scale);c.height=Math.round(bm.height*scale);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);photoData=c.toDataURL('image/jpeg',0.82);bm.close();$('#image').value='';save();status('Photo ready. Preview to check it.')}catch{status('Could not read this image. Try JPEG or PNG.')}};function options(){const select=$('#existing');select.replaceChildren(el('option','New note'));select.firstChild.value='';for(const p of base.posts){const o=el('option',p.title);o.value=p.id;select.append(o)}select.value=id||''}
function authState(){const on=NotesRelay.connected();$('#connectionSummary').textContent=on?'Publish key saved · publishing settings':'Add your publish key once to publish';$('#authStatus').textContent=on?'A publish key is saved in this browser. It is checked every time you publish.':'No key saved. Drafting and preview still work.'}
$('#disconnect').onclick=()=>{NotesRelay.forget();$('#publishKey').value='';authState();status('Publish key forgotten on this browser.')};
$('#connect').onclick=async()=>{const value=$('#publishKey').value.trim();if(!value){status('Enter your publish key first.');return}NotesRelay.remember(value,$('#rememberKey').checked);$('#publishKey').value='';$('#connect').disabled=true;try{await NotesRelay.check();authState();$('#connection').open=false;status('Publish key saved. You can now publish directly.')}catch(e){NotesRelay.forget();authState();status(e.message)}finally{$('#connect').disabled=false}};
async function publishChange(p,removal=false){
 if(busy)return;if(!NotesRelay.connected()){$('#connection').open=true;status('Add your publish key above first. Your draft is safe.');return}
 busy=true;$('#publish').disabled=true;$('#remove').disabled=true;status('Checking the latest published notes…');
 try{
 const fresh=await getData();const old=base.posts.find(n=>n.id===p.id),current=fresh.posts.find(n=>n.id===p.id);
 if(JSON.stringify(old)!==JSON.stringify(current))throw Error('This note changed elsewhere. Back up your draft and refresh before publishing. Nothing was overwritten.');
 status(removal?'Removing from the site…':'Publishing to the site…');
 const result=removal?await NotesRelay.remove(p.id):await NotesRelay.publish(p);
 let merged=null;try{merged=await getData()}catch{}
 if(merged){base=merged}else{const posts=base.posts.filter(n=>n.id!==p.id);if(!removal)posts.push(p);base={...base,posts}}
 baseRaw=JSON.stringify(base);if(removal){id=null;fill({});try{localStorage.removeItem(key)}catch{}}else{id=p.id;try{localStorage.setItem(key,JSON.stringify({...values(),id,photoData}))}catch{}}
 options();$('#commitLink').href=result.commit_url||('https://github.com/mjanthony819/anthony/commits/main');$('#publishResult').textContent=removal?'Removal saved. The live site will update after the Pages build.':'Your note is saved in the repository. The live site will update after the Pages build.';$('#published').hidden=false;status('Commit saved. Waiting for GitHub Pages to update the live site.');
 }catch(e){status(e.message)}finally{busy=false;$('#publish').disabled=false;$('#remove').disabled=false;authState()}
}
$('#form').onsubmit=async e=>{e.preventDefault();if(!base)return;const p=post();id=p.id;save();if(!p.title.trim()||!p.body.trim()){status('Add a title and story.');return}try{if(p.image&&!cover(p.image))throw Error('Use an HTTPS image URL.');await publishChange(p)}catch(e){status(e.message)}};$('#remove').onclick=async()=>{if(!id||!base.posts.some(p=>p.id===id)){status('Choose a published note first.');return}if(!confirm('Remove this note from the live site? This commits immediately. It remains in GitHub history.'))return;try{await publishChange({id},true)}catch(e){status(e.message)}};getData().then(d=>{base=d;baseRaw=JSON.stringify(d);options();authState();let draft=null;try{draft=JSON.parse(localStorage.getItem(key)||'null')}catch{}fill(draft||{});$('#publish').disabled=false;status(draft?'Local draft restored.':'Ready. Your first note starts here.')}).catch(e=>status(e.message));
