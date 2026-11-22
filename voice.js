export function wireVoice(tools) {
  const form = document.querySelector('#voice');
  const status = form.querySelector('output');
  const start = form.querySelector('[type=submit]');
  const stop = form.querySelector('[type=button]');
  let session, connecting = false;
  const update = () => { start.disabled = connecting || !!session; stop.disabled = !session; };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (session || connecting) return;
    const id = form.querySelector('input').value.trim();
    if (!/^agent_[a-z0-9]+$/i.test(id)) { status.textContent = 'Enter a valid agent ID.'; return; }
    connecting = true;
    status.textContent = 'Connecting…';
    update();
    try {
      const { Conversation } = await import('@elevenlabs/client');
      session = await Conversation.startSession({
        agentId:id,
        clientTools:Object.fromEntries(Object.entries(tools).map(([name,fn]) => [name, async args => {
          try { return JSON.stringify(await fn(args || {})); }
          catch { return JSON.stringify({ok:false,error:'App request failed.'}); }
        }])),
        onConnect:() => { status.textContent = 'Connected'; },
        onDisconnect:() => { session = undefined; status.textContent = 'Disconnected'; update(); },
        onError:() => { status.textContent = 'Voice error. Check the agent settings and microphone access.'; }
      });
    } catch { status.textContent = 'Could not connect. Check your agent ID, account, and microphone.'; }
    finally { connecting = false; update(); }
  });
  stop.addEventListener('click', async () => {
    stop.disabled = true;
    try { await session?.endSession(); }
    catch { status.textContent = 'Could not end the session. Try again.'; }
    finally { update(); }
  });
}

export async function api(path, body, headers = {}) {
  const response = await fetch('/api/' + path, {
    method:body === undefined ? 'GET' : 'POST',
    headers:{...headers,...(body === undefined ? {} : {'Content-Type':'application/json'})},
    body:body === undefined ? undefined : JSON.stringify(body)
  });
  return response.json();
}
