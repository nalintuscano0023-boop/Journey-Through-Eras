'use strict';

let ERAS_DATA = [];
let currentEraIdx = 0;
let voiceEnabled = false;
let particleRAF = null;
let globeRAF = null;
let vortexRAF = null;

const simState = { pollution: 50, tech: 50 };

let visitedEras = JSON.parse(localStorage.getItem('visitedEras') || '[]');

const $ = id => document.getElementById(id);
const dom = {
    bgImage: $('bg-image'),
    particleCanvas: $('particle-canvas'),
    globeCanvas: $('globe-canvas'),

    warpOverlay: $('time-travel-overlay'),
    vortexCanvas: $('time-vortex-canvas'),
    warpText: $('time-travel-text'),

    hero: $('hero'),
    startBtn: $('start-btn'),
    heroThemeBtn: $('hero-theme-btn'),
    heroThemeIcon: $('hero-theme-icon'),

    explorerContainer: $('explorer-container'),
    backBtn: $('back-btn'),
    themeToggleBtn: $('theme-toggle-btn'),
    themeIcon: $('theme-icon'),

    voiceToggleBtn: $('voice-toggle-btn'),
    voiceIcon: $('voice-icon'),
    voiceDot: $('voice-dot'),

    steps: document.querySelectorAll('.step'),
    timelineProgress: $('timeline-progress-bar'),

    eraContent: $('era-content'),
    eraTitle: $('era-title'),
    eraSubtitle: $('era-subtitle'),
    eraIcon: $('era-icon'),
    eraDesc: $('era-description'),
    eraImg: $('era-gallery-img'),
    eraKeyFacts: $('era-key-facts'),

    decisionPanel: $('decision-panel'),
    decisionTitle: $('decision-title'),
    decisionText: $('decision-text'),
    decisionChoices: $('decision-choices'),

    tempBar: $('temp-bar'),
    tempVal: $('temp-val'),
    popCircle: $('pop-circle'),
    popVal: $('pop-val'),
    techBar: $('tech-bar'),
    techVal: $('tech-val'),

    milestonesGrid: $('milestones-grid'),

    cmp1: $('compare-era-1'),
    cmp2: $('compare-era-2'),
    cmp1Content: $('compare-1-content'),
    cmp2Content: $('compare-2-content'),

    simPollution: $('pollution-slider'),
    simTech: $('tech-slider'),
    simPollutionVal: $('pollution-val-display'),
    simTechVal: $('tech-val-display'),
    simBtn: $('apply-sim-btn'),
    simResult: $('sim-result'),
    simFutureTitle: $('sim-future-title'),
    simFutureDesc: $('sim-future-desc'),

    trendChart: $('trend-chart-container'),

    prevBtn: $('prev-era-btn'),
    nextBtn: $('next-era-btn'),
    eraCounter: $('era-counter'),

    achievementContainer: $('achievement-container'),
    impactToast: $('impact-toast'),
};

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const lerp = (a, b, t) => a + (b - a) * t;

function attachRipple(btn) {
    btn.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const el = document.createElement('span');
        const size = Math.max(rect.width, rect.height) * 2;
        el.className = 'ripple-wave';
        el.style.cssText = `
            width:${size}px; height:${size}px;
            left:${e.clientX - rect.left - size / 2}px;
            top:${e.clientY - rect.top - size / 2}px;
        `;
        this.appendChild(el);
        setTimeout(() => el.remove(), 700);
    });
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const isDark = theme === 'dark';
    const icon = isDark ? '🌙' : '☀️';
    if (dom.themeIcon) dom.themeIcon.textContent = icon;
    if (dom.heroThemeIcon) dom.heroThemeIcon.textContent = icon;
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    showAchievement(next === 'light' ? 'Day Mode Unlocked' : 'Night Mode Engaged', next === 'light' ? '☀️' : '🌙');
}

function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!text || !voiceEnabled) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1;
    utt.volume = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        (v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Karen'))
    );
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
}

function setVoice(enabled) {
    voiceEnabled = enabled;
    if (dom.voiceToggleBtn) {
        dom.voiceToggleBtn.setAttribute('aria-pressed', enabled.toString());
        dom.voiceToggleBtn.classList.toggle('voice-active', enabled);
    }
    if (dom.voiceIcon) dom.voiceIcon.textContent = enabled ? '🔊' : '🔈';
    if (!enabled) window.speechSynthesis.cancel();
    else if (ERAS_DATA[currentEraIdx]) speak(ERAS_DATA[currentEraIdx].description);
}

function initGlobe() {
    const canvas = dom.globeCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 200;
    canvas.width = size;
    canvas.height = size;

    const earthImg = new Image();
    earthImg.crossOrigin = 'anonymous';

    earthImg.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png';

    let offset = 0;
    let lastT = 0;

    function draw(ts) {
        const dt = ts - lastT;
        lastT = ts;
        offset += dt * 0.022;

        ctx.clearRect(0, 0, size, size);

        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.clip();

        if (earthImg.complete && earthImg.naturalWidth > 0) {
            const scale = size / earthImg.naturalHeight;
            const drawW = earthImg.naturalWidth * scale;
            const x = -(offset % drawW);
            ctx.drawImage(earthImg, x, 0, drawW, size);
            ctx.drawImage(earthImg, x + drawW, 0, drawW, size);
        } else {

            const grad = ctx.createRadialGradient(size * 0.35, size * 0.3, 0, size / 2, size / 2, size / 2);
            grad.addColorStop(0, '#1a6fa8');
            grad.addColorStop(0.4, '#0d4f82');
            grad.addColorStop(1, '#072c50');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
        }

        const atmo = ctx.createRadialGradient(size * 0.3, size * 0.25, 0, size / 2, size / 2, size / 2);
        atmo.addColorStop(0, 'rgba(160,210,255,0.18)');
        atmo.addColorStop(0.6, 'transparent');
        ctx.fillStyle = atmo;
        ctx.fillRect(0, 0, size, size);

        const shadow = ctx.createRadialGradient(size * 0.75, size * 0.65, size * 0.1, size * 0.75, size * 0.65, size * 0.9);
        shadow.addColorStop(0, 'transparent');
        shadow.addColorStop(1, 'rgba(0,0,0,0.72)');
        ctx.fillStyle = shadow;
        ctx.fillRect(0, 0, size, size);

        ctx.restore();

        globeRAF = requestAnimationFrame(draw);
    }

    globeRAF = requestAnimationFrame(draw);
}

function initVortex() {
    const canvas = dom.vortexCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const W = canvas.width;
    const H = canvas.height;
    const STAR_COUNT = 500;
    let speed = 0;

    const stars = Array.from({ length: STAR_COUNT }, () => ({
        x: (Math.random() - 0.5) * W * 2.4,
        y: (Math.random() - 0.5) * H * 2.4,
        z: Math.random() * W,
        pz: 0,
    }));

    const startTime = performance.now();

    function draw(now) {
        const elapsed = (now - startTime) / 1000;
        speed = Math.min(elapsed * 40, 200);

        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fillRect(0, 0, W, H);

        stars.forEach(s => {
            s.pz = s.z;
            s.z -= speed;
            if (s.z < 1) {
                s.z = W; s.pz = W;
                s.x = (Math.random() - 0.5) * W * 2.4;
                s.y = (Math.random() - 0.5) * H * 2.4;
            }
            const sx = (s.x / s.z) * 500 + W / 2;
            const sy = (s.y / s.z) * 500 + H / 2;
            const px = (s.x / s.pz) * 500 + W / 2;
            const py = (s.y / s.pz) * 500 + H / 2;
            const size = clamp((1 - s.z / W) * 2.5, 0.1, 2.5);
            const alpha = clamp(1 - s.z / W, 0, 1);

            ctx.strokeStyle = `rgba(180,220,255,${alpha})`;
            ctx.lineWidth = size;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        });

        vortexRAF = requestAnimationFrame(draw);
    }
    vortexRAF = requestAnimationFrame(draw);
}

function stopVortex() {
    if (vortexRAF) { cancelAnimationFrame(vortexRAF); vortexRAF = null; }
}

function launchParticles(type, accentColor) {
    const canvas = dom.particleCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (particleRAF) { cancelAnimationFrame(particleRAF); particleRAF = null; }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const W = canvas.width;
    const H = canvas.height;

    const configs = {
        snow: {
            count: 120,
            create: () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 3 + 1,
                vy: Math.random() * 1.5 + 0.4,
                vx: (Math.random() - 0.5) * 0.6,
                alpha: Math.random() * 0.6 + 0.3,
            }),
            draw: (ctx, p, _color) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,235,255,${p.alpha})`;
                ctx.fill();
            },
            update: (p) => {
                p.x += p.vx + Math.sin(Date.now() * 0.001 + p.y) * 0.3;
                p.y += p.vy;
                if (p.y > H + 5) { p.y = -5; p.x = Math.random() * W; }
            },
        },
        fireflies: {
            count: 60,
            create: () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 2.5 + 0.8,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                phase: Math.random() * Math.PI * 2,
                alpha: Math.random() * 0.5 + 0.3,
            }),
            draw: (ctx, p, color) => {
                const a = (Math.sin(Date.now() * 0.002 + p.phase) + 1) / 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,220,80,${a * 0.9})`;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ffd050';
                ctx.fill();
                ctx.shadowBlur = 0;
            },
            update: (p) => {
                p.x += p.vx + Math.sin(Date.now() * 0.0015 + p.phase) * 0.3;
                p.y += p.vy + Math.cos(Date.now() * 0.001 + p.phase) * 0.3;
                if (p.x < 0) p.x = W;
                if (p.x > W) p.x = 0;
                if (p.y < 0) p.y = H;
                if (p.y > H) p.y = 0;
            },
        },
        smog: {
            count: 80,
            create: () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 18 + 8,
                vx: Math.random() * 0.5 + 0.15,
                alpha: Math.random() * 0.12 + 0.04,
            }),
            draw: (ctx, p) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(160,140,120,${p.alpha})`;
                ctx.fill();
            },
            update: (p) => {
                p.x += p.vx;
                if (p.x > W + p.r) { p.x = -p.r; p.y = Math.random() * H; }
            },
        },
        data: {
            count: 70,
            create: () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                char: String.fromCharCode(0x30A0 + Math.random() * 96),
                vy: Math.random() * 2.5 + 0.8,
                alpha: Math.random() * 0.5 + 0.1,
                size: Math.random() * 8 + 9,
            }),
            draw: (ctx, p, color) => {
                ctx.font = `${p.size}px monospace`;
                ctx.fillStyle = `rgba(86,207,225,${p.alpha})`;
                ctx.fillText(p.char, p.x, p.y);
            },
            update: (p) => {
                p.y += p.vy;
                if (Math.random() < 0.03) p.char = String.fromCharCode(0x30A0 + Math.random() * 96);
                if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
            },
        },
        energy: {
            count: 90,
            create: () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 2 + 0.5,
                vx: (Math.random() - 0.5) * 1.2,
                vy: (Math.random() - 0.5) * 1.2,
                alpha: Math.random() * 0.7 + 0.2,
                color: Math.random() > 0.5 ? accentColor || '#56cfe1' : '#80ffdb',
            }),
            draw: (ctx, p) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color.replace(')', `,${p.alpha})`).replace('rgb', 'rgba') || `rgba(86,207,225,${p.alpha})`;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
                ctx.fill();
                ctx.shadowBlur = 0;
            },
            update: (p) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > W) p.vx *= -1;
                if (p.y < 0 || p.y > H) p.vy *= -1;
            },
        },
    };

    const cfg = configs[type] || configs.snow;
    const particles = Array.from({ length: cfg.count }, cfg.create);

    function loop() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
            cfg.update(p);
            cfg.draw(ctx, p, accentColor);
        });
        particleRAF = requestAnimationFrame(loop);
    }
    loop();
}

function renderEra(index, initial = false) {
    if (!ERAS_DATA.length) return;
    const era = ERAS_DATA[index];
    if (!era) return;

    currentEraIdx = index;

    if (!visitedEras.includes(index)) {
        visitedEras.push(index);
        localStorage.setItem('visitedEras', JSON.stringify(visitedEras));
        if (visitedEras.length === ERAS_DATA.length) {
            setTimeout(() => showAchievement('Time Traveler', '⏳'), 600);
        }
    }

    document.documentElement.style.setProperty('--accent', era.themeColor);

    const hex = era.themeColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty('--accent-rgb', `${r},${g},${b}`);
    document.documentElement.style.setProperty('--accent-glow', era.themeGlow || `rgba(${r},${g},${b},0.35)`);
    document.documentElement.style.setProperty('--accent-subtle', `rgba(${r},${g},${b},0.1)`);

    const flash = document.querySelector('.era-transition-flash');
    if (flash && !initial) {
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 300);
    }

    if (era.bgImage && dom.bgImage) {
        dom.bgImage.classList.remove('bg-visible');
        setTimeout(() => {
            dom.bgImage.src = era.bgImage;
            dom.bgImage.onload = () => dom.bgImage.classList.add('bg-visible');
            if (dom.bgImage.complete) dom.bgImage.classList.add('bg-visible');
        }, initial ? 0 : 350);
    }

    launchParticles(era.particleEffect || 'snow', era.themeColor);

    if (dom.eraTitle) dom.eraTitle.textContent = era.name;
    if (dom.eraSubtitle) dom.eraSubtitle.textContent = era.subtitle || '';
    if (dom.eraIcon) dom.eraIcon.textContent = era.eraIcon || '';
    if (dom.eraDesc) dom.eraDesc.textContent = era.description;

    if (dom.eraImg) {
        dom.eraImg.classList.remove('loaded');
        dom.eraImg.src = era.galleryImage;
        dom.eraImg.alt = `${era.name} scene`;
        dom.eraImg.onload = () => dom.eraImg.classList.add('loaded');
        if (dom.eraImg.complete) dom.eraImg.classList.add('loaded');
    }

    renderKeyFacts(era.keyFacts || []);

    renderStats(era);

    renderMilestones(era.milestones || []);

    renderDecision(era.decision, index);

    dom.steps.forEach((step, i) => {
        step.classList.toggle('active', i === index);
        step.classList.toggle('visited', visitedEras.includes(i));
        step.setAttribute('aria-current', i === index ? 'true' : 'false');
    });

    let pct = ERAS_DATA.length <= 1
        ? 100
        : (index / (ERAS_DATA.length - 1)) * 100;

    if (index === ERAS_DATA.length - 1) pct = 108;

    if (dom.timelineProgress) {
        dom.timelineProgress.style.width = `${pct}%`;
        dom.timelineProgress.setAttribute('aria-valuenow', Math.round(pct));
    }

    if (dom.prevBtn) dom.prevBtn.disabled = (index === 0);
    if (dom.nextBtn) dom.nextBtn.disabled = (index === ERAS_DATA.length - 1);
    if (dom.eraCounter) dom.eraCounter.textContent = `${index + 1} / ${ERAS_DATA.length}`;

    renderTrendChart();

    if (voiceEnabled) speak(era.description);

    if (!initial && dom.eraContent) {
        dom.eraContent.classList.remove('anim-slide-up');
        void dom.eraContent.offsetWidth;
        dom.eraContent.classList.add('anim-slide-up');
    }
}

function renderKeyFacts(facts) {
    if (!dom.eraKeyFacts) return;
    dom.eraKeyFacts.innerHTML = facts.map(f => `
        <div class="key-fact-chip">
            <span class="key-fact-icon">${f.icon}</span>
            <div>
                <span class="key-fact-label">${f.label}</span>
                <span class="key-fact-value">${f.value}</span>
            </div>
        </div>
    `).join('');
}

function renderStats(era) {
    const stats = era.stats;
    const disp = era.statsDisplay;
    if (!stats) return;

    if (dom.tempBar) {
        dom.tempBar.style.width = `${stats.temp}%`;
        dom.tempBar.setAttribute('aria-valuenow', stats.temp);
    }
    if (dom.tempVal) dom.tempVal.textContent = disp.temp;

    if (dom.popCircle) {
        const circumference = 2 * Math.PI * 32;
        const fill = circumference * (stats.pop / 100);
        const empty = circumference - fill;
        dom.popCircle.style.strokeDashoffset = (circumference - fill).toFixed(2);
    }
    if (dom.popVal) dom.popVal.textContent = disp.pop;

    if (dom.techBar) {
        dom.techBar.style.width = `${stats.tech}%`;
        dom.techBar.setAttribute('aria-valuenow', stats.tech);
    }
    if (dom.techVal) dom.techVal.textContent = disp.tech;
}

function renderMilestones(milestones) {
    if (!dom.milestonesGrid) return;
    dom.milestonesGrid.innerHTML = milestones.map((m, i) => `
        <div class="milestone-card" style="animation-delay:${i * 0.07}s" role="listitem">
            <span class="milestone-icon">${m.icon}</span>
            <span class="milestone-year">${m.year}</span>
            <span class="milestone-title">${m.title}</span>
            <p class="milestone-desc">${m.desc}</p>
        </div>
    `).join('');
}

function renderDecision(decision, eraIdx) {
    if (!dom.decisionPanel) return;
    if (!decision || !decision.show) {
        dom.decisionPanel.classList.add('hidden');
        return;
    }
    dom.decisionPanel.classList.remove('hidden');
    if (dom.decisionTitle) dom.decisionTitle.textContent = decision.title;
    if (dom.decisionText) dom.decisionText.textContent = decision.text;

    if (dom.decisionChoices) {
        dom.decisionChoices.innerHTML = decision.choices.map((c, idx) => `
            <button class="decision-choice-btn ripple" data-choice-idx="${idx}" data-era="${eraIdx}">
                <strong>${c.text}</strong>
                <small>${c.impact}</small>
            </button>
        `).join('');

        dom.decisionChoices.querySelectorAll('.decision-choice-btn').forEach(btn => {
            attachRipple(btn);
            btn.addEventListener('click', () => {
                const ci = parseInt(btn.dataset.choiceIdx);
                const ch = decision.choices[ci];
                applyDecision(ch);
            });
        });
    }
}

function applyDecision(choice) {
    simState.pollution = clamp(simState.pollution + (choice.pol || 0), 0, 100);
    simState.tech = clamp(simState.tech + (choice.tech || 0), 0, 100);

    if (dom.simPollution) dom.simPollution.value = simState.pollution;
    if (dom.simPollutionVal) dom.simPollutionVal.textContent = `${simState.pollution}%`;
    if (dom.simTech) dom.simTech.value = simState.tech;
    if (dom.simTechVal) dom.simTechVal.textContent = `${simState.tech}%`;

    if (dom.decisionPanel) dom.decisionPanel.classList.add('hidden');

    showImpactToast(choice);
    showAchievement('Decision Maker', '⚖️');
}

function showImpactToast(choice) {
    if (!dom.impactToast) return;
    dom.impactToast.innerHTML = `
        <h4>${choice.text}</h4>
        <p>${choice.impact}</p>
    `;
    dom.impactToast.classList.remove('hidden');
    setTimeout(() => dom.impactToast.classList.add('visible'), 20);
    setTimeout(() => {
        dom.impactToast.classList.remove('visible');
        setTimeout(() => dom.impactToast.classList.add('hidden'), 350);
    }, 3200);
}

function initCompare() {
    if (!dom.cmp1 || !dom.cmp2) return;
    ERAS_DATA.forEach((era, i) => {
        dom.cmp1.add(new Option(era.name, i));
        dom.cmp2.add(new Option(era.name, i));
    });
    dom.cmp2.selectedIndex = Math.min(1, ERAS_DATA.length - 1);
    updateCompare();
}

function updateCompare() {
    const e1 = ERAS_DATA[parseInt(dom.cmp1.value)];
    const e2 = ERAS_DATA[parseInt(dom.cmp2.value)];
    if (!e1 || !e2) return;
    dom.cmp1Content.innerHTML = buildCompareCard(e1);
    dom.cmp2Content.innerHTML = buildCompareCard(e2);
}

function buildCompareCard(era) {
    const s = era.stats;
    const d = era.statsDisplay;
    return `
        <h4>${era.eraIcon || ''} ${era.name}</h4>
        <div class="compare-stat-row"><span class="c-label">🌡️ Temp</span><span class="c-value">${d.temp}</span></div>
        <div class="compare-bar-mini"><div class="compare-bar-fill temp-fill" style="width:${s.temp}%"></div></div>
        <div class="compare-stat-row"><span class="c-label">👥 Pop</span><span class="c-value">${d.pop}</span></div>
        <div class="compare-bar-mini"><div class="compare-bar-fill pop-fill" style="width:${s.pop}%"></div></div>
        <div class="compare-stat-row"><span class="c-label">⚙️ Tech</span><span class="c-value">${d.tech}</span></div>
        <div class="compare-bar-mini"><div class="compare-bar-fill tech-fill" style="width:${s.tech}%"></div></div>
    `;
}

function runSimulator() {
    const pol = parseInt(dom.simPollution.value);
    const tech = parseInt(dom.simTech.value);
    const futureEra = ERAS_DATA.find(e => e.name === 'Future Era');
    const scenarios = futureEra?.futureScenarios;

    let key = 'balanced';
    let color = '#f4a261';

    if (tech > 70 && pol < 30) {
        key = 'utopia'; color = '#38b000';
    } else if (tech > 70 && pol > 70) {
        key = 'techUtopia'; color = '#4361ee';
    } else if (pol > 70) {
        key = 'dystopia'; color = '#e63946';
    }

    const scenario = scenarios?.[key] || {
        title: 'Balanced Future',
        desc: 'Humanity finds an imperfect equilibrium between progress and preservation.',
    };

    if (dom.simResult) dom.simResult.classList.remove('hidden');
    if (dom.simFutureTitle) {
        dom.simFutureTitle.textContent = scenario.title || 'Future Prediction';
        dom.simFutureTitle.style.color = color;
    }
    if (dom.simFutureDesc) dom.simFutureDesc.textContent = scenario.desc || '';

    dom.simResult.classList.remove('anim-scale-in');
    void dom.simResult.offsetWidth;
    dom.simResult.classList.add('anim-scale-in');
}

function renderTrendChart() {
    if (!dom.trendChart || !ERAS_DATA.length) return;
    dom.trendChart.innerHTML = ERAS_DATA.map((era, i) => {
        const isActive = i === currentEraIdx;
        const bars = [
            { cls: 'bar-temp', h: era.stats.temp },
            { cls: 'bar-pop', h: era.stats.pop },
            { cls: 'bar-tech', h: era.stats.tech },
        ];
        return `
            <div class="chart-col ${isActive ? 'active-col' : ''}">
                <div class="chart-bars-group">
                    ${bars.map(b => `<div class="chart-bar ${b.cls}" style="height:${b.h}%"></div>`).join('')}
                </div>
                <div class="chart-label">${era.name.split(' ')[0]}</div>
            </div>
        `;
    }).join('');
}

function showAchievement(title, emoji) {
    const achieved = JSON.parse(localStorage.getItem('achievements') || '[]');
    if (achieved.includes(title)) return;
    achieved.push(title);
    localStorage.setItem('achievements', JSON.stringify(achieved));

    if (!dom.achievementContainer) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <span class="toast-emoji">${emoji}</span>
        <div class="toast-body">
            <span class="toast-label">Achievement</span>
            <span class="toast-title">${title}</span>
        </div>
    `;
    dom.achievementContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
}

function setupEvents() {

    if (dom.startBtn) {
        attachRipple(dom.startBtn);
        dom.startBtn.addEventListener('click', () => {
            startExploring();
        });
    }

    function startExploring() {
        cancelAnimationFrame(globeRAF);

        if (dom.warpOverlay) {
            dom.warpOverlay.classList.remove('hidden');
            initVortex();

            setTimeout(() => {
                const bar = document.querySelector('.warp-bar');
                const fill = document.querySelector('.warp-bar-fill');
                if (bar) bar.classList.add('visible');
                if (fill) fill.classList.add('running');
            }, 200);

            setTimeout(() => {
                if (dom.warpText) dom.warpText.classList.add('visible');
                const messages = ['Initiating time displacement…', 'Warping through millennia…', 'Approaching destination…'];
                let mi = 0;
                const cycleMsg = setInterval(() => {
                    mi = (mi + 1) % messages.length;
                    if (dom.warpText) dom.warpText.textContent = messages[mi];
                }, 1600);
                setTimeout(() => clearInterval(cycleMsg), 4800);
            }, 800);

            setTimeout(() => {
                stopVortex();
                dom.hero.classList.add('hidden');
                dom.warpOverlay.classList.add('fade-out');
                setTimeout(() => {
                    dom.warpOverlay.classList.add('hidden');
                    dom.warpOverlay.classList.remove('fade-out');
                    dom.explorerContainer.classList.remove('hidden');
                    dom.explorerContainer.classList.add('anim-fade-in');
                    renderEra(0, true);
                    initCompare();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    showAchievement('Explorer Initiated', '🚀');
                }, 800);
            }, 5200);
        } else {

            dom.hero.classList.add('hidden');
            dom.explorerContainer.classList.remove('hidden');
            renderEra(0, true);
            initCompare();
        }
    }

    if (dom.backBtn) {
        dom.backBtn.addEventListener('click', () => {
            dom.explorerContainer.classList.add('hidden');
            dom.hero.classList.remove('hidden');
            if (particleRAF) { cancelAnimationFrame(particleRAF); particleRAF = null; }
            dom.bgImage.classList.remove('bg-visible');
            initGlobe();
        });
    }

    dom.steps.forEach(step => {
        step.addEventListener('click', () => {
            const idx = parseInt(step.dataset.era);
            if (idx !== currentEraIdx) renderEra(idx);
        });

        step.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                step.click();
            }
        });
    });

    document.addEventListener('keydown', e => {
        if (dom.hero.classList.contains('hidden')) {

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentEraIdx < ERAS_DATA.length - 1) renderEra(currentEraIdx + 1);
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentEraIdx > 0) renderEra(currentEraIdx - 1);
            }
        }
    });

    if (dom.prevBtn) dom.prevBtn.addEventListener('click', () => {
        if (currentEraIdx > 0) renderEra(currentEraIdx - 1);
    });
    if (dom.nextBtn) dom.nextBtn.addEventListener('click', () => {
        if (currentEraIdx < ERAS_DATA.length - 1) renderEra(currentEraIdx + 1);
    });

    if (dom.voiceToggleBtn) {
        dom.voiceToggleBtn.addEventListener('click', () => setVoice(!voiceEnabled));
    }

    if (dom.themeToggleBtn) dom.themeToggleBtn.addEventListener('click', toggleTheme);
    if (dom.heroThemeBtn) dom.heroThemeBtn.addEventListener('click', toggleTheme);

    if (dom.cmp1) dom.cmp1.addEventListener('change', updateCompare);
    if (dom.cmp2) dom.cmp2.addEventListener('change', updateCompare);

    if (dom.simPollution) {
        dom.simPollution.addEventListener('input', e => {
            simState.pollution = parseInt(e.target.value);
            if (dom.simPollutionVal) dom.simPollutionVal.textContent = `${simState.pollution}%`;
        });
    }
    if (dom.simTech) {
        dom.simTech.addEventListener('input', e => {
            simState.tech = parseInt(e.target.value);
            if (dom.simTechVal) dom.simTechVal.textContent = `${simState.tech}%`;
        });
    }

    if (dom.simBtn) {
        attachRipple(dom.simBtn);
        dom.simBtn.addEventListener('click', () => {
            runSimulator();
            showAchievement('Future Visionary', '🔮');
        });
    }

    window.addEventListener('resize', () => {
        if (dom.particleCanvas) {
            dom.particleCanvas.width = window.innerWidth;
            dom.particleCanvas.height = window.innerHeight;
        }
        if (vortexRAF && dom.vortexCanvas) {
            dom.vortexCanvas.width = window.innerWidth;
            dom.vortexCanvas.height = window.innerHeight;
        }
    });
}

function injectUtilityDOM() {
    const flash = document.createElement('div');
    flash.className = 'era-transition-flash';
    document.body.appendChild(flash);
}

function boot(data) {
    ERAS_DATA = Array.isArray(data) && data.length ? data : getBuiltInData();

    initTheme();
    injectUtilityDOM();
    setupEvents();

    initGlobe();

    ERAS_DATA.forEach(era => {
        if (era.bgImage) { const img = new Image(); img.src = era.bgImage; }
    });
}

function getBuiltInData() {
    return [
        {
            id: 0, name: 'Ice Age', subtitle: '2.6 Million – 11,700 Years Ago',
            bgImage: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1920',
            galleryImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=900',
            eraIcon: '❄️', particleEffect: 'snow', themeColor: '#00b4d8', themeGlow: 'rgba(0,180,216,0.35)',
            description: 'A frozen world where massive glaciers covered large parts of the Earth. Early human ancestors traversed the harsh tundra, hunting woolly mammoths. Survival meant mastering fire, crafting bone tools, and painting cave walls with ochre dreams.',
            keyFacts: [{ label: 'Temp', value: '-10°C', icon: '🌡️' }, { label: 'Population', value: '~1M', icon: '👥' }, { label: 'Ice Cover', value: '30%', icon: '🧊' }, { label: 'Sea Level', value: '120m lower', icon: '🌊' }],
            milestones: [
                { year: '2.6 Mya', title: 'Pleistocene Begins', desc: 'Earth enters Ice Age cycles.', icon: '🧊' },
                { year: '300 Kya', title: 'Fire Mastered', desc: 'Early humans tame fire.', icon: '🔥' },
                { year: '40 Kya', title: 'Cave Art', desc: 'Abstract art marks symbolic thought.', icon: '🎨' },
                { year: '11.7 Kya', title: 'The Thaw', desc: 'Glaciers retreat; Holocene begins.', icon: '☀️' },
            ],
            decision: { show: false },
            stats: { temp: 10, pop: 1, tech: 5 }, statsDisplay: { temp: '-10°C', pop: '~1 Million', tech: 'Stone Tools' }
        },
        {
            id: 1, name: 'Ancient Era', subtitle: '10,000 BCE – 500 CE',
            bgImage: 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?q=80&w=1920',
            galleryImage: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=900',
            eraIcon: '🏛️', particleEffect: 'fireflies', themeColor: '#f4a261', themeGlow: 'rgba(244,162,97,0.35)',
            description: 'The dawn of civilisation. Humanity settled near great rivers, invented writing, raised pyramids, and built empires. From Mesopotamia to Rome, a dazzling tapestry of art, law, and philosophy emerged.',
            keyFacts: [{ label: 'Temp', value: '14°C', icon: '🌡️' }, { label: 'Population', value: '~300M', icon: '👥' }, { label: 'Writing', value: '3200 BCE', icon: '📜' }, { label: 'Largest City', value: 'Rome ~1M', icon: '🏙️' }],
            milestones: [
                { year: '10,000 BCE', title: 'Agriculture', desc: 'Farming begins in Fertile Crescent.', icon: '🌾' },
                { year: '3200 BCE', title: 'Writing', desc: 'Cuneiform script invented.', icon: '📜' },
                { year: '2560 BCE', title: 'Great Pyramid', desc: 'Egypt raises its eternal wonder.', icon: '🔺' },
                { year: '500 BCE', title: 'Philosophy', desc: 'Socrates, Confucius, Buddha.', icon: '🤔' },
            ],
            decision: { show: false },
            stats: { temp: 40, pop: 15, tech: 20 }, statsDisplay: { temp: '14°C', pop: '~300 Million', tech: 'Agriculture/Bronze' }
        },
        {
            id: 2, name: 'Industrial Era', subtitle: '1760 – 1900 CE',
            bgImage: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=1920',
            galleryImage: 'https://images.unsplash.com/photo-1516035054744-d474c5209db5?q=80&w=900',
            eraIcon: '⚙️', particleEffect: 'smog', themeColor: '#e76f51', themeGlow: 'rgba(231,111,81,0.35)',
            description: 'Steam, iron and coal rewired society. Factories roared, railways stretched, cities swelled. Wealth exploded but so did pollution. The Industrial Revolution seeded both modernity and the climate crisis.',
            keyFacts: [{ label: 'Temp', value: '14.5°C', icon: '🌡️' }, { label: 'Population', value: '1.5B', icon: '👥' }, { label: 'CO₂', value: '285 ppm', icon: '💨' }, { label: 'Railways', value: '1M km', icon: '🚂' }],
            milestones: [
                { year: '1769', title: 'Steam Engine', desc: 'Watt perfects the steam engine.', icon: '♨️' },
                { year: '1830', title: 'First Railway', desc: 'Liverpool–Manchester opens.', icon: '🚂' },
                { year: '1879', title: 'Electric Light', desc: 'Edison lights the night.', icon: '💡' },
                { year: '1903', title: 'First Flight', desc: 'Wright Brothers fly 12 seconds.', icon: '✈️' },
            ],
            decision: {
                show: true, title: '⚙️ Industrial Crossroads', text: 'Coal or waterways?', choices: [
                    { text: '🏭 Double Down on Coal', impact: 'Pollution +35, tech +15.', pol: 35, tech: 15 },
                    { text: '🌊 Invest in Waterways', impact: 'Pollution −15, tech +5.', pol: -15, tech: 5 }
                ]
            },
            stats: { temp: 45, pop: 40, tech: 50 }, statsDisplay: { temp: '14.5°C', pop: '~1.5 Billion', tech: 'Steam/Machinery' }
        },
        {
            id: 3, name: 'Modern Era', subtitle: '1900 – Present',
            bgImage: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=1920',
            galleryImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=900',
            eraIcon: '🌐', particleEffect: 'data', themeColor: '#4361ee', themeGlow: 'rgba(67,97,238,0.35)',
            description: 'Two world wars, the Moon landing, and the internet in 120 years. Eight billion souls connected on glowing screens. The same coal smoke of Manchester now tips a planet into fever. Our greatest challenge is our own success.',
            keyFacts: [{ label: 'Temp', value: '15.5°C', icon: '🌡️' }, { label: 'Population', value: '8B+', icon: '👥' }, { label: 'CO₂', value: '420 ppm', icon: '💨' }, { label: 'Internet', value: '5.4B users', icon: '🌐' }],
            milestones: [
                { year: '1945', title: 'Nuclear Age', desc: 'The atomic age dawns.', icon: '☢️' },
                { year: '1969', title: 'Moon Landing', desc: 'Apollo 11 lands on the Moon.', icon: '🌕' },
                { year: '1991', title: 'WWW', desc: 'Berners-Lee publishes the web.', icon: '🕸️' },
                { year: '2023', title: 'AI Inflexion', desc: 'Generative AI reaches 100M users.', icon: '🤖' },
            ],
            decision: {
                show: true, title: '🌐 Modern Policy', text: 'AI acceleration or Green Deal?', choices: [
                    { text: '🤖 Accelerate AI', impact: 'Tech +40, Pollution +10.', pol: 10, tech: 40 },
                    { text: '🌿 Green New Deal', impact: 'Pollution −40, Tech −10.', pol: -40, tech: -10 }
                ]
            },
            stats: { temp: 65, pop: 85, tech: 80 }, statsDisplay: { temp: '15.5°C', pop: '8+ Billion', tech: 'Digital/Nuclear' }
        },
        {
            id: 4, name: 'Future Era', subtitle: '2050 – 2150 CE',
            bgImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920',
            galleryImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=900',
            eraIcon: '🚀', particleEffect: 'energy', themeColor: '#56cfe1', themeGlow: 'rgba(86,207,225,0.35)',
            description: 'The future is a choice. In one vision: eco towers, clean fusion and climate-repair drones heal the planet. In another: +4°C scorches fertile zones and two billion people become climate refugees. Both futures begin with decisions made today.',
            keyFacts: [{ label: 'Best Case', value: '+1.5°C', icon: '🌡️' }, { label: 'Worst Case', value: '+4°C', icon: '🔥' }, { label: 'Population', value: '9–11B', icon: '👥' }, { label: 'Key Tech', value: 'AI/Fusion', icon: '⚡' }],
            milestones: [
                { year: '2035', title: 'EV Tipping Point', desc: 'EVs surpass combustion globally.', icon: '🔋' },
                { year: '2050', title: 'Net Zero Target', desc: 'Nations pledged carbon target.', icon: '🌿' },
                { year: '2070', title: 'Fusion Energy', desc: 'Commercial fusion reactors online.', icon: '⚡' },
                { year: '2100', title: 'Climate Reckoning', desc: '1.5°C or 4°C paths diverge.', icon: '🌍' },
            ],
            futureScenarios: {
                utopia: { title: '🌿 Ecological Utopia', desc: 'Fusion energy and rewilding. Temps stabilise at +1.2°C. Humanity reaches the stars.', color: '#38b000' },
                techUtopia: { title: '🤖 Technological Nirvana', desc: 'AGI solves climate and disease. Nanobot swarms purify oceans. Humans live to 150.', color: '#4361ee' },
                balanced: { title: '⚖️ Cautious Progress', desc: 'Imperfect cooperation. Temps rise +2.1°C before stabilising. Coastal cities adapt.', color: '#f4a261' },
                dystopia: { title: '☠️ Climate Collapse', desc: '550 ppm CO₂. +4°C scorched zones. 2 billion climate refugees by 2100.', color: '#e63946' },
            },
            decision: { show: false },
            stats: { temp: 80, pop: 95, tech: 100 }, statsDisplay: { temp: '+1.5–4°C', pop: '9–11 Billion', tech: 'AI/Fusion' }
        }
    ];
}

fetch('eras-data.json')
    .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
    .then(data => boot(data))
    .catch(() => boot(getBuiltInData()));
