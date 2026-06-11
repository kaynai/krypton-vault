/* ============================================
   Krypton Vault 鈥?绮掑瓙浜や簰绯荤粺
   閿佸畾鐣岄潰榧犳爣浜掑姩绮掑瓙鏁堟灉
   ============================================ */

(function () {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ---------- 閰嶇疆 ----------
    const CONFIG = {
        particleCount: 90,
        baseRadius: 1.8,
        maxRadius: 4.5,
        connectionDist: 130,
        mouseRadius: 150,       // 榧犳爣鏂ュ姏鑼冨洿
        mouseForce: 0.06,       // 榧犳爣鏂ュ姏寮哄害
        clickBurstForce: 8,     // 鐐瑰嚮鐖嗗彂鍔?
        speedLimit: 1.2,
        trailOpacity: 0.12,     // 鎷栧熬閫忔槑搴?
        glowColor: '124,92,252',// 涓昏壊璋?RGB
        glowColor2: '255,107,157',
        glowColor3: '0,212,170',
        fpsInterval: 1000 / 60,
    };

    // ---------- 鐘舵€?----------
    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    let isMouseOnCanvas = false;
    let width, height;
    let animFrame;
    let lastTime = 0;

    // ---------- 绮掑瓙绫?----------
    class Particle {
        constructor() {
            this.reset();
            // 鍒濆闅忔満鏁ｈ惤浣嶇疆
            this.x = Math.random() * width;
            this.y = Math.random() * height;
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * CONFIG.speedLimit;
            this.vy = (Math.random() - 0.5) * CONFIG.speedLimit;
            this.radius = CONFIG.baseRadius + Math.random() * (CONFIG.maxRadius - CONFIG.baseRadius);
            this.baseRadius = this.radius;

            // 闅忔満鍒嗛厤涓€绉嶅彂鍏夐鑹?
            const colors = [CONFIG.glowColor, CONFIG.glowColor2, CONFIG.glowColor3];
            this.color = colors[Math.floor(Math.random() * colors.length)];

            // 閫忔槑搴︽诞鍔ㄥ弬鏁?
            this.alphaPhase = Math.random() * Math.PI * 2;
            this.alphaSpeed = 0.008 + Math.random() * 0.015;
        }

        update() {
            // 榧犳爣浜や簰 鈥斺€?鏂ュ姏
            if (isMouseOnCanvas) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                if (dist < CONFIG.mouseRadius) {
                    const force = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce;
                    // 鍔犲叆寰皬鍒囧悜鍔涳紝浜х敓娑℃棆鏁堟灉
                    const angle = Math.atan2(dy, dx);
                    const tangentialAngle = angle + Math.PI / 2;
                    this.vx += Math.cos(angle) * force * 1.5 + Math.cos(tangentialAngle) * force * 0.3;
                    this.vy += Math.sin(angle) * force * 1.5 + Math.sin(tangentialAngle) * force * 0.3;

                    // 闈犺繎榧犳爣鏃跺井寰斁澶?
                    this.radius = this.baseRadius + (1 - dist / CONFIG.mouseRadius) * 3;
                } else {
                    this.radius += (this.baseRadius - this.radius) * 0.1;
                }
            } else {
                this.radius += (this.baseRadius - this.radius) * 0.1;
            }

            // 閫熷害琛板噺
            this.vx *= 0.97;
            this.vy *= 0.97;

            // 鏇存柊浣嶇疆
            this.x += this.vx;
            this.y += this.vy;

            // 杈圭晫鍥炲脊锛堟煍鍜岋級
            const margin = 30;
            if (this.x < -margin) { this.x = width + margin; }
            if (this.x > width + margin) { this.x = -margin; }
            if (this.y < -margin) { this.y = height + margin; }
            if (this.y > height + margin) { this.y = -margin; }

            // 缂撴參鍚戜腑蹇冨尯鍩熸紓绉伙紝閬垮厤绮掑瓙鍏ㄩ儴鏁ｅ紑
            const cx = width / 2;
            const cy = height / 2;
            const driftForce = 0.00015;
            this.vx += (cx - this.x) * driftForce;
            this.vy += (cy - this.y) * driftForce;

            // 鍔ㄦ€侀€忔槑搴?
            this.alphaPhase += this.alphaSpeed;
        }

        draw(ctx) {
            const alpha = 0.5 + 0.3 * Math.sin(this.alphaPhase);
            const r = this.radius;

            // 澶栧彂鍏?
            const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 4);
            glow.addColorStop(0, `rgba(${this.color},${alpha})`);
            glow.addColorStop(0.4, `rgba(${this.color},${alpha * 0.5})`);
            glow.addColorStop(1, `rgba(${this.color},0)`);
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 4, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // 鏍稿績鐧界偣
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
            ctx.fill();
        }
    }

    // ---------- 鍒濆鍖栫矑瀛?----------
    function initParticles() {
        particles = [];
        for (let i = 0; i < CONFIG.particleCount; i++) {
            particles.push(new Particle());
        }
    }

    // ---------- 鐢昏繛鎺ョ嚎 ----------
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONFIG.connectionDist) {
                    const opacity = (1 - dist / CONFIG.connectionDist) * 0.4;
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    // 娓愬彉杩炵嚎
                    const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                    const c1 = p1.color;
                    const c2 = p2.color;
                    gradient.addColorStop(0, `rgba(${c1},${opacity})`);
                    gradient.addColorStop(0.5, `rgba(255,255,255,${opacity * 0.3})`);
                    gradient.addColorStop(1, `rgba(${c2},${opacity})`);

                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
    }

    // ---------- 榧犳爣杩炵嚎 ----------
    function drawMouseConnections() {
        if (!isMouseOnCanvas) return;
        for (const p of particles) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONFIG.mouseRadius * 1.3) {
                const opacity = (1 - dist / (CONFIG.mouseRadius * 1.3)) * 0.5;
                ctx.beginPath();
                ctx.moveTo(mouse.x, mouse.y);
                ctx.lineTo(p.x, p.y);
                ctx.strokeStyle = `rgba(${p.color},${opacity})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    // ---------- 榧犳爣鍏夋爣鍏夋檿 ----------
    function drawMouseGlow() {
        if (!isMouseOnCanvas) return;
        const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 60);
        glow.addColorStop(0, 'rgba(124,92,252,0.15)');
        glow.addColorStop(0.5, 'rgba(124,92,252,0.05)');
        glow.addColorStop(1, 'rgba(124,92,252,0)');
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 60, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
    }

    // ---------- 娓叉煋寰幆 ----------
    function render(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const elapsed = timestamp - lastTime;

        if (elapsed > CONFIG.fpsInterval) {
            lastTime = timestamp - (elapsed % CONFIG.fpsInterval);

            // 鍗婇€忔槑瑕嗙洊瀹炵幇鎷栧熬鏁堟灉
            ctx.fillStyle = `rgba(15,12,41,${CONFIG.trailOpacity})`;
            ctx.fillRect(0, 0, width, height);

            // 鏇存柊绮掑瓙
            for (const p of particles) {
                p.update();
            }

            // 缁樺埗杩炴帴绾匡紙鍏堢敾绾垮啀鐢荤偣锛岀偣鍦ㄧ嚎涓婂眰锛?
            drawConnections();
            drawMouseConnections();
            drawMouseGlow();

            // 缁樺埗绮掑瓙
            for (const p of particles) {
                p.draw(ctx);
            }
        }

        animFrame = requestAnimationFrame(render);
    }

    // ---------- 绐楀彛澶у皬璋冩暣 ----------
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    // ---------- 浜嬩欢澶勭悊 ----------
    function onMouseMove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        isMouseOnCanvas = true;
    }

    function onMouseLeave() {
        isMouseOnCanvas = false;
    }

    function onMouseEnter(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        isMouseOnCanvas = true;
    }

    function onClick(e) {
        // 鐐瑰嚮鐖嗗彂锛氫互鐐瑰嚮浣嶇疆涓轰腑蹇冿紝缁欐墍鏈夌矑瀛愪竴涓悜澶栨帹鍔?
        const cx = e.clientX;
        const cy = e.clientY;
        for (const p of particles) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = Math.min(CONFIG.clickBurstForce / (dist * 0.01 + 1), 15);
            const angle = Math.atan2(dy, dx);
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
        }
    }

    // ---------- 瑙︽懜鏀寔 ----------
    function onTouchMove(e) {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            isMouseOnCanvas = true;
        }
    }

    function onTouchEnd() {
        isMouseOnCanvas = false;
    }

    // ---------- 鍚姩 ----------
    function start() {
        resize();
        initParticles();

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('mouseenter', onMouseEnter);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd);

        window.addEventListener('resize', () => {
            resize();
        });

        animFrame = requestAnimationFrame(render);
    }

    // ---------- 鍋滄锛堝垏鎹㈠睆骞曟椂璋冪敤锛?----------
    function stop() {
        cancelAnimationFrame(animFrame);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
        canvas.removeEventListener('mouseenter', onMouseEnter);
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        particles = [];
    }

    // ---------- 鏆撮湶 API 鍒板叏灞€ ----------
    window.particleSystem = {
        start,
        stop,
        canvas,
    };

    // 鑷姩鍚姩锛堥攣瀹氱晫闈㈤粯璁ゅ彲瑙侊級
    if (document.getElementById('lockScreen').classList.contains('active')) {
        start();
    }

    // 鐩戝惉灞忓箷鍒囨崲
    const lockScreen = document.getElementById('lockScreen');
    if (lockScreen) {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === 'class') {
                    if (lockScreen.classList.contains('active')) {
                        if (particles.length === 0) {
                            resize();
                            initParticles();
                            animFrame = requestAnimationFrame(render);
                        } else {
                            resize();
                        }
                    } else {
                        stop();
                    }
                }
            }
        });
        observer.observe(lockScreen, { attributes: true, attributeFilter: ['class'] });
    }

    console.log('%c鉁?绮掑瓙浜や簰绯荤粺 %c宸插氨缁?,
        'font-size:1em;color:#c4b5fd;',
        'color:#aaa;');
})();
