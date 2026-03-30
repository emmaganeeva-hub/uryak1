// p5.js sketch — 2D overlay layer
// Reads animation state from window.SHARED (set by scene.js)

function seededRng(s) {
    let h = s | 0;
    return () => { h = Math.imul(h^(h>>>16), 0x45d9f3b); h ^= h>>>16; return (h>>>0)/0xffffffff; };
}

function drawTatarBottomBand(dc, w, h) {
    const y = h * 0.895;
    const left = w * 0.04;
    const right = w * 0.96;
    const unit = w * 0.016;

    dc.save();
    dc.strokeStyle = 'rgba(201, 168, 74, 0.18)';
    dc.lineWidth = 1;

    for (let x = left; x < right; x += unit * 3) {
        dc.beginPath();
        dc.moveTo(x, y);
        dc.lineTo(x + unit, y - unit * 0.7);
        dc.lineTo(x + unit * 2, y);
        dc.lineTo(x + unit, y + unit * 0.7);
        dc.closePath();
        dc.stroke();
    }

    dc.restore();
}


const _sketch = (p) => {
    let grainSeed = 0;
    let scanOff   = 0;

    p.setup = () => {
        const area = document.querySelector('.canvas-area');
        const cv   = p.createCanvas(area.clientWidth, area.clientHeight);
        Object.assign(cv.elt.style, {
            position: 'absolute', top: '0', left: '0',
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '1',
        });
        area.appendChild(cv.elt);
        p.pixelDensity(Math.min(window.devicePixelRatio, 2));
        p.frameRate(60);
    };

    p.draw = () => {
        const S = window.SHARED;
        if (!S || !S.P) { p.clear(); return; }
        const P  = S.P;
        const dc = p.drawingContext;
        const w  = p.width, h = p.height;

        p.clear();

        // ── Glow halo ───────────────────────────────────────────
        if (P.glow > 0.02) {
            const g = dc.createRadialGradient(w/2, h/2, w*0.05, w/2, h/2, w*0.52);
            g.addColorStop(0, `rgba(80,120,220,${(P.glow*0.05).toFixed(3)})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            dc.fillStyle = g;
            dc.fillRect(0, 0, w, h);
        }

        // ── Vignette ────────────────────────────────────────────
        if (P.vignette > 0.01) {
            const cx=w/2, cy=h/2, r=Math.sqrt(cx*cx+cy*cy);
            const v = dc.createRadialGradient(cx,cy,r*0.28, cx,cy,r*1.08);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, `rgba(0,0,0,${P.vignette.toFixed(2)})`);
            dc.fillStyle = v;
            dc.fillRect(0, 0, w, h);
        }

        // ── Scanlines ───────────────────────────────────────────
        scanOff = (scanOff + 0.3) % 3;
        dc.fillStyle = 'rgba(0,0,0,0.032)';
        for (let y = scanOff|0; y < h; y += 3) dc.fillRect(0, y, w, 1);

        // ── Film grain ──────────────────────────────────────────
        if (P.grain > 0.01) {
            const rng = seededRng(grainSeed++);
            const cnt = Math.round(w * h * 0.001 * P.grain);
            dc.save();
            dc.globalCompositeOperation = 'screen';
            for (let i = 0; i < cnt; i++) {
                dc.fillStyle = `rgba(200,215,245,${(rng()*P.grain*0.2).toFixed(3)})`;
                dc.fillRect(rng()*w, rng()*h, 0.8+rng(), 0.8+rng());
            }
            dc.restore();
        }

        // ── Poster chrome ───────────────────────────────────────
        dc.save();

        drawTatarBottomBand(dc, w, h)

        // Top border
        dc.strokeStyle = 'rgba(255,255,255,0.09)'; dc.lineWidth = 0.5;
        dc.beginPath(); dc.moveTo(w*0.04, h*0.048); dc.lineTo(w*0.96, h*0.048); dc.stroke();

        dc.fillStyle = 'rgba(255,255,255,0.2)';
        dc.font = `400 ${Math.round(w*0.008)}px 'JetBrains Mono', monospace`;
        dc.letterSpacing = '0.18em'; dc.textAlign = 'right';
        dc.fillText('uryak', w*0.962, h*0.042);

        // Bottom border
        dc.strokeStyle = 'rgba(255,255,255,0.09)';
        dc.beginPath(); dc.moveTo(w*0.04, h*0.912); dc.lineTo(w*0.96, h*0.912); dc.stroke();

        // Main title
        dc.textAlign = 'left'; dc.letterSpacing = '0.06em';
        dc.fillStyle = 'rgba(240,244,255,0.92)';
        dc.font = `400 ${Math.round(w*0.042)}px 'Lora', serif`;
        dc.fillText('26', w*0.04, h*0.955);

        dc.fillStyle = 'rgba(255, 64, 0, 0.82)';
        dc.font = `400 ${Math.round(w*0.042)}px 'Lora', serif`;
        dc.fillText('CAMILA CHAMOMILE', w*0.44, h*0.955);

        dc.restore();

        // ── Waypoint sign ───────────────────────────────────────
        const alpha = S.signAlpha || 0;
        if (alpha > 0.004 && S.SIGN_DEFS?.length) {
            const def = S.SIGN_DEFS[S.wpIdx || 0];
            const text = def.text.toUpperCase();
            
            // Случайный коэффициент глюка (меняется каждый кадр)
            const glitchIntensity = 0.3;  // можно вынести в P.glitсhIntensity
            const r = Math.random();
            
            dc.save();
            dc.globalAlpha = alpha;
            dc.letterSpacing = '0.06em';
            dc.textAlign = 'center';
            dc.textBaseline = 'middle';
            const fs = Math.round(Math.min(w*0.20*def.sz, h*0.22*def.sz));
            dc.font = `400 ${fs}px 'Lora', serif`;
            dc.shadowColor = 'rgba(180,200,255,0.35)';
            dc.shadowBlur = 28;
            dc.fillStyle = 'rgba(255,255,255,0.95)';
            
            // Эффект глюка: если случайное число меньше порога, рисуем текст с искажениями
            if (r < glitchIntensity) {
                // Смещение по X на случайную величину
                const offsetX = (Math.random() - 0.5) * fs * 0.05;
                // Искажённый текст: случайная замена символов
                let glitchedText = '';
                for (let i = 0; i < text.length; i++) {
                    if (Math.random() < 0.2) {
                        glitchedText += String.fromCharCode(33 + Math.floor(Math.random() * 90));
                    } else {
                        glitchedText += text[i];
                    }
                }
                dc.fillText(glitchedText, w*0.5 + offsetX, h*0.42);
            } else {
                dc.fillText(text, w*0.5, h*0.42);
            }
            
            dc.restore();
}
    };

    p.windowResized = () => {
        const area = document.querySelector('.canvas-area');
        p.resizeCanvas(area.clientWidth, area.clientHeight);
    };
};

// Wait for DOM before creating p5 instance
document.addEventListener('DOMContentLoaded', () => new p5(_sketch));
