<!-- Missions home. Entry point after unlock. Lists every saved mission and
     opens one on tap. Create/rename/duplicate/delete UI lands in Phase 4 —
     for Phase 3 we just need list + open + create-new so the shell can be
     exercised end-to-end. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { missionStore } from '$lib/missionStore.svelte';
  import { computeMissionRecap } from '$lib/mission';
  import Icon from '$lib/Icon.svelte';

  let mounted = $state(false);

  onMount(() => {
    missionStore.ensureLoaded();
    mounted = true;
  });

  function createMission() {
    const name = window.prompt(
      'Mission name?',
      `Mission ${missionStore.list.length + 1}`,
    );
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    missionStore.create(trimmed);
  }
</script>

<div class="page">
  <header>
    <h1>Missions</h1>
    <button class="new-btn" onclick={createMission} aria-label="New mission">
      <Icon name="add" size={22} />
      <span>New</span>
    </button>
  </header>

  {#if !mounted}
    <p class="muted">Loading…</p>
  {:else}
    <ul class="missions">
      {#each missionStore.list as m (m.id)}
        {@const recap = computeMissionRecap(m.id)}
        <li>
          <a
            class="card"
            href={`/m/${m.id}/configuration`}
            onclick={() => missionStore.setActive(m.id)}
            data-sveltekit-preload-data="tap"
          >
            <div class="card-header">
              <span class="name">{m.name}</span>
              {#if m.id === missionStore.activeId}
                <span class="badge">ACTIVE</span>
              {/if}
            </div>
            <dl class="recap">
              <div><dt>Dist</dt><dd>{recap.totalDistNm.toFixed(0)} nm</dd></div>
              <div><dt>Time</dt><dd>{recap.totalHours.toFixed(2)} h</dd></div>
              <div><dt>Fuel</dt><dd>{recap.requiredFuel.toFixed(0)} kg</dd></div>
              <div>
                <dt>TOW</dt>
                <dd>
                  {recap.tow.toFixed(0)} kg
                  {#if recap.mtow != null && recap.tow > recap.mtow}
                    <span class="over">over MTOW</span>
                  {/if}
                </dd>
              </div>
            </dl>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page {
    min-height: 100dvh;
    background: #303030;
    padding-top: env(safe-area-inset-top);
    padding-bottom: max(env(safe-area-inset-bottom), 16px);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #424242;
    background: #1e1e1e;
  }
  h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.02em;
  }
  .new-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #448aff;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .new-btn:active { opacity: 0.7; }
  .muted {
    color: #888;
    padding: 24px;
    text-align: center;
  }
  .missions {
    list-style: none;
    margin: 0;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .card {
    display: block;
    background: #1e1e1e;
    border-radius: 12px;
    padding: 14px 16px;
    border: 1px solid transparent;
    transition: border-color 0.15s, background 0.15s;
    /* Make the whole card a comfortable touch target. */
    min-height: 88px;
  }
  .card:active { background: #2a2a2a; }
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .name {
    font-size: 17px;
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #448aff;
    border: 1px solid #448aff;
    border-radius: 4px;
    padding: 2px 6px;
  }
  .recap {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 0;
  }
  .recap > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  dt {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  dd {
    margin: 0;
    font-size: 14px;
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
    color: #e0e0e0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .over {
    color: #ef5350;
    font-size: 10px;
    margin-left: 4px;
    font-weight: 700;
  }
</style>
