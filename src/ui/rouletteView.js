import { getDailyMoodIcon } from '../shared/emojiMoodRegistry.js';
import { renderIcon } from '../shared/iconRegistry.js';
import { renderChoreMarker, renderEditAssigneeCheckboxes, fireConfetti, fireEmojiRain } from './choreView.js';
import { escapeHtml } from '../shared/htmlSanitizer.js';

export function animateWheel(wheel, targetAngle, { duration = 7200, reducedMotion = false, onDone } = {}) {
  if (reducedMotion) {
    wheel.style.transform = `rotateZ(${targetAngle}deg)`;
    wheel.dataset.angle = String(targetAngle);
    onDone?.();
    return;
  }
  const start = performance.now();
  const initialAngle = Number(wheel.dataset.angle || 0);
  const step = now => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 5);
    const angle = initialAngle + ((targetAngle - initialAngle) * eased);
    wheel.style.transform = `rotateZ(${angle}deg)`;
    if (progress < 1) requestAnimationFrame(step);
    else {
      wheel.dataset.angle = String(targetAngle);
      onDone?.();
    }
  };
  requestAnimationFrame(step);
}

function renderSegments(segments) {
  const total = segments.reduce((sum, segment) => sum + segment.weight, 0) || 1;
  let start = 0;
  return segments.map((segment, index) => {
    const size = (segment.weight / total) * 360;
    const color = segment.color || `hsl(${(index * 67) % 360} 78% 66%)`;
    const middle = start + (size / 2);
    start += size;
    return `<span class="roulette-segment-label" style="--roulette-angle:${middle}deg;--roulette-color:${color}">${segment.iconKey ? renderIcon(segment.iconKey) : renderChoreMarker(segment.label, segment.id)}<span>${escapeHtml(segment.label)}</span></span>`;
  }).join('');
}

export function renderRouletteView(container, { state, activeRole, activePeriodId = null, rouletteService, onRefresh, onComplete }) {
  if (!container) return;
  const isKid = activeRole !== 'parent';
  const segments = state?.wheel?.segments || [];
  container.innerHTML = isKid ? `
    <section class="card roulette-card roulette-kid" aria-label="Opgaveroulette">
      <div class="roulette-heading"><div><h2 class="section-title">${renderIcon('target')} Opgaveroulette</h2><p>Vælg en ny heltemission.</p></div></div>
      <button class="button button-primary roulette-open" data-roulette-open ${segments.length ? '' : 'disabled'}>${renderIcon('target')} Åbn roulette</button>
      <div class="roulette-modal" data-roulette-modal hidden role="dialog" aria-modal="true" aria-labelledby="roulette-modal-title">
        <div class="roulette-modal-backdrop" data-roulette-close></div>
        <div class="roulette-modal-content">
          <button class="button button-secondary roulette-close" data-roulette-close aria-label="Luk roulette">Luk</button>
          <h2 id="roulette-modal-title" class="section-title">${renderIcon('target')} Opgaveroulette</h2>
          <div class="roulette-targets" role="group" aria-label="Vælg opgavetildeling">
            <button class="button button-secondary roulette-target is-selected" data-roulette-target="self" aria-pressed="true">Kun mig</button>
            <button class="button button-secondary roulette-target" data-roulette-target="both" aria-pressed="false">Begge helte</button>
          </div>
          <div class="roulette-stage" data-roulette-stage tabindex="0" role="application" aria-label="Roulettehjul. Tryk på mellemrum eller Enter for at spinne.">
            <span class="roulette-pointer" aria-hidden="true">▼</span>
            <div class="roulette-wheel" data-roulette-wheel>${renderSegments(segments)}</div>
          </div>
          <p class="roulette-live" data-roulette-live role="status" aria-live="polite">${segments.length ? 'Klar til at spinne.' : 'Ingen opgaver passer til dette valg.'}</p>
          <button class="button button-primary roulette-spin" data-roulette-spin ${segments.length ? '' : 'disabled'}>${renderIcon('target')} Spin hjulet</button>
          <div class="roulette-result" data-roulette-result hidden></div>
        </div>
      </div>
    </section>` : `
    <section class="card roulette-card" aria-label="Rediger opgaveroulette">
      <div class="roulette-heading"><div><h2 class="section-title">${renderIcon('target')} Opgaveroulette</h2><p>Hjulet bruger aktive opgaver automatisk. Tilpas vægt og farve her.</p></div><button class="button button-secondary" data-roulette-preview>Prøvespin</button></div>
      <ol class="roulette-editor" data-roulette-editor>${segments.map(segment => `<li draggable="true" data-segment-id="${escapeHtml(segment.id)}"><span class="roulette-drag" aria-hidden="true">☷</span>${renderChoreMarker(segment.label, segment.id)}<strong>${escapeHtml(segment.label)}</strong><label>Vægt <input type="range" min="1" max="10" value="${segment.weight}" data-roulette-weight="${escapeHtml(segment.id)}" /></label><span>${renderEditAssigneeCheckboxes(segment.id, segment.assignedTo)}</span></li>`).join('')}</ol>
      <form data-roulette-add class="form-row"><input class="input" name="label" maxlength="80" placeholder="Ekstra mission" required /><button class="button button-primary">Tilføj</button></form>
    </section>`;

  if (!isKid) {
    container.querySelector('[data-roulette-add]')?.addEventListener('submit', event => {
      event.preventDefault();
      const result = rouletteService.addSegment({ label: new FormData(event.currentTarget).get('label'), assignedTo: ['Hans Jørgen', 'Andrea'], weight: 1 }, { actorRole: 'parent' });
      onRefresh(result.message);
    });
    container.querySelectorAll('[data-roulette-weight]').forEach(input => input.addEventListener('change', () => {
      const result = rouletteService.updateSegment(input.dataset.rouletteWeight, { weight: Number(input.value) }, { actorRole: 'parent' });
      onRefresh(result.message);
    }));
    container.querySelector('[data-roulette-preview]')?.addEventListener('click', () => {
      const wheel = container.querySelector('[data-roulette-wheel]');
      if (wheel) animateWheel(wheel, 2160 + 90, { duration: 1400, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
    });
    return;
  }

  let target = 'self';
  const modal = container.querySelector('[data-roulette-modal]');
  const wheel = container.querySelector('[data-roulette-wheel]');
  const live = container.querySelector('[data-roulette-live]');
  const openModal = () => {
    modal.hidden = false;
    modal.querySelector('[data-roulette-stage]')?.focus();
  };
  const closeModal = () => { modal.hidden = true; };
  container.querySelector('[data-roulette-open]')?.addEventListener('click', openModal);
  container.querySelectorAll('[data-roulette-close]').forEach(button => button.addEventListener('click', closeModal));
  const spin = () => {
    const result = rouletteService.spinWheel({
      actorRole: activeRole,
      actorId: activeRole,
      targetKid: target === 'both' ? 'both' : activeRole,
      activePeriodId,
      seed: Date.now()
    });
    if (!result.ok) return onRefresh(result.message);
    live.textContent = 'Hjulet spinner…';
    animateWheel(wheel, Number(wheel.dataset.angle || 0) + result.state.result.animationParams.targetAngle, {
      duration: result.state.result.animationParams.duration,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onDone: () => {
        const selected = result.state.wheel.segments.find(item => item.id === result.state.result.chosenSegmentId);
        const resultElement = container.querySelector('[data-roulette-result]');
        resultElement.hidden = false;
        resultElement.innerHTML = `<strong>${selected ? escapeHtml(selected.label) : 'Mission valgt!'}</strong><p>${result.state.result.sharedSuggestion ? 'Fælles forslag — spørg en forælder, før begge bliver tildelt.' : `Tildelt til: ${result.state.result.assignedTo.join(' og ')}`}</p>${selected?.meta?.choreId && !result.state.result.sharedSuggestion ? `<button class="button button-success" data-roulette-complete="${escapeHtml(selected.meta.choreId)}">Markér fuldført</button>` : ''}`;
        live.textContent = `Mission valgt: ${selected?.label || ''}`;
        fireConfetti({ particleCount: 80 });
        fireEmojiRain([selected?.iconKey || getDailyMoodIcon('fallback', selected?.id || 'roulette')], 20);
        resultElement.querySelector('[data-roulette-complete]')?.addEventListener('click', () => onComplete?.(selected.meta.choreId));
      }
    });
  };
  container.querySelectorAll('[data-roulette-target]').forEach(button => button.addEventListener('click', () => {
    target = button.dataset.rouletteTarget;
    container.querySelectorAll('[data-roulette-target]').forEach(item => {
      const selected = item === button;
      item.setAttribute('aria-pressed', String(selected));
      item.classList.toggle('is-selected', selected);
    });
  }));
  container.querySelector('[data-roulette-spin]')?.addEventListener('click', spin);
  modal?.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
  });
  const stage = container.querySelector('[data-roulette-stage]');
  let pointerStartX = 0;
  stage?.addEventListener('pointerdown', event => { pointerStartX = event.clientX; });
  stage?.addEventListener('pointerup', event => {
    if (Math.abs(event.clientX - pointerStartX) >= 12 || event.pointerType !== 'mouse') spin();
  });
  stage?.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); spin(); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const labels = [...container.querySelectorAll('.roulette-segment-label')];
      const next = event.key === 'ArrowRight' ? labels[0] : labels.at(-1);
      live.textContent = next?.textContent?.trim() || 'Roulettefelt';
    }
  });
}
