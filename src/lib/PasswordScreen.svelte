<script lang="ts">
  import { tryUnlock } from './passwordGate';

  let { onUnlocked }: { onUnlocked: () => void } = $props();

  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit() {
    if (busy || password.length === 0) return;
    busy = true;
    error = null;
    const ok = await tryUnlock(password);
    if (ok) {
      onUnlocked();
    } else {
      busy = false;
      error = 'Incorrect password';
      password = '';
    }
  }
</script>

<div class="screen">
  <div class="card">
    <svg class="icon" viewBox="0 0 24 24" width="64" height="64" fill="currentColor" aria-hidden="true">
      <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6-9h-1V6a5 5 0 1 0-10 0v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2ZM8.9 6a3.1 3.1 0 0 1 6.2 0v2H8.9V6ZM18 20H6V10h12v10Z"/>
    </svg>
    <h1>NH90 Performance Tool</h1>
    <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        autocomplete="off"
        disabled={busy}
        aria-label="Password"
      />
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <button type="submit" disabled={busy || password.length === 0}>
        {busy ? '…' : 'Unlock'}
      </button>
    </form>
  </div>
</div>

<style>
  .screen {
    min-height: 100vh;
    background: #303030;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .card {
    width: 100%;
    max-width: 360px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .icon {
    color: #448aff;
    margin-bottom: 16px;
  }
  h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 32px 0;
    text-align: center;
  }
  form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  input {
    background: #424242;
    border: 1px solid #616161;
    border-radius: 8px;
    padding: 14px 12px;
    color: #ffffff;
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  input:focus {
    border-color: #448aff;
  }
  input:disabled {
    opacity: 0.7;
  }
  .error {
    margin: -8px 0 0 0;
    color: #f48fb1;
    font-size: 13px;
  }
  button {
    background: #448aff;
    border: none;
    border-radius: 8px;
    color: #ffffff;
    font-size: 16px;
    font-weight: 700;
    padding: 14px;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
