(() => {
    'use strict';
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));
    const mix = (a, b, t) => a + (b - a) * t;
    let paused = reduced.matches;
    let phase = 0, lastTime = 0, lastScroll = scrollY, travel = scrollY, speed = 0, energy = 0;
    let pointer = { x: innerWidth / 2, y: innerHeight / 2 };
    let target = { ...pointer }, pressure = 0;
    let palette = 0, wantedPalette = 0;
    const labels = { fire: 'ATO I: ABERTURA', electric: 'ATO II: CORAÇÃO', mono: 'ATO III: FUNDO' };
    const fragrance = {
        fire: ['01 / A PRIMEIRA IMPRESSÃO', 'Luz que desperta.', 'Bergamota · pimenta-rosa', 'Uma abertura luminosa, cítrica e levemente picante. O instante em que tudo começa.'],
        electric: ['02 / A PERSONALIDADE', 'Textura que envolve.', 'Íris · cedro', 'A delicadeza aveludada da íris encontra a estrutura seca do cedro. O perfume ganha corpo.'],
        mono: ['03 / A MEMÓRIA', 'Calor que permanece.', 'Âmbar · almíscar', 'Um fundo macio e ambarado. A impressão íntima que fica quando o primeiro encontro já passou.']
    };
    const coarse = matchMedia('(pointer: coarse)');
    function interactionHint() {
        const hint = document.querySelector('[data-interaction-hint]');
        if (hint) hint.textContent = coarse.matches ? 'Deslize para transformar. Toque na matéria para provocar.' : 'Role para transformar. Mova o cursor sobre a matéria para provocar.';
    }
    coarse.addEventListener('change', interactionHint);
    interactionHint();
    function renderSize(width, height, dpr, touch) {
        const budget = touch ? 900000 : 1800000;
        const ratio = Math.min(Math.max(1, dpr), touch ? 1.5 : 2, Math.sqrt(budget / Math.max(1, width * height)));
        return [Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio))];
    }
    const buttons = [...document.querySelectorAll('button[data-state]')];
    const motionButtons = [...document.querySelectorAll('[data-motion], #motion')];
    function syncMotion() {
        document.body.classList.toggle('paused', paused);
        motionButtons.forEach(button => {
            button.setAttribute('aria-pressed', String(paused));
            button.innerHTML = paused ? 'Retomar movimento <span aria-hidden="true">▶</span>' : 'Pausar movimento <span aria-hidden="true">Ⅱ</span>';
        });
    }
    motionButtons.forEach(button => button.addEventListener('click', () => { paused = !paused; syncMotion(); }));
    reduced.addEventListener('change', event => { paused = event.matches; syncMotion(); });
    syncMotion();
    buttons.forEach(button => button.addEventListener('click', () => {
        document.body.dataset.state = button.dataset.state;
        wantedPalette = { fire: 0, electric: 1, mono: 2 }[button.dataset.state];
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        document.getElementById('state-label').textContent = labels[button.dataset.state];
        ['scent-act', 'scent-title', 'scent-notes', 'scent-story'].forEach((id, index) => {
            const element = document.getElementById(id);
            if (element) element.textContent = fragrance[button.dataset.state][index];
        });
    }));
    function point(event) {
        const distance = Math.hypot(event.clientX - target.x, event.clientY - target.y);
        target = { x: event.clientX, y: event.clientY };
        pressure = Math.min(1, pressure + distance / 180);
    }
    window.addEventListener('pointermove', point, { passive: true });
    window.addEventListener('pointerdown', event => { point(event); pressure = 1; }, { passive: true });
    window.addEventListener('pointerup', () => { pressure *= .6; }, { passive: true });
    window.addEventListener('pointercancel', () => { pressure = 0; }, { passive: true });
    document.addEventListener('visibilitychange', () => { lastTime = 0; lastScroll = scrollY; });
    const vertex = `attribute vec2 position; varying vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
    const fragment = `precision mediump float;
    varying vec2 uv;
    uniform sampler2D image;
    uniform vec2 resolution, imageSize, pointer;
    uniform float time, scroll, force, energy, palette;
    void main(){
      vec2 p=uv;
      float aspect=resolution.x/resolution.y;
      vec2 center=vec2(.59,.51);
      vec2 q=p-center;
      q.x*=aspect;
      float radius=length(q);
      float angle=atan(q.y,q.x);
      float turn=sin(radius*7.-time*.72+scroll*3.)*.045;
      turn+=sin(angle*3.+time*.4+scroll*1.8)*.018;
      float c=cos(turn),s=sin(turn);
      q=mat2(c,-s,s,c)*q;
      q*=1.+sin(angle*4.+time*.7+scroll*2.)*.017;
      q.x/=aspect;
      p=center+q;
      p+=vec2(sin(p.y*14.+time*.8+scroll*3.),cos(p.x*12.-time*.6+scroll*2.))*.006;
      vec2 d=uv-pointer;
      d.x*=aspect;
      float r=length(d);
      float wave=sin(r*29.-time*3.5-scroll*6.);
      vec2 direction=d/max(r,.025);
      direction.x/=aspect;
      p+=direction*wave*exp(-r*4.8)*(.006+force*.023+energy*.014);
      float sourceAspect=imageSize.x/imageSize.y;
      vec2 fit=vec2(max(1.,aspect/sourceAspect),max(1.,sourceAspect/aspect));
      vec2 rawUV=(p-.5)*fit+.5;
      if(rawUV.x<0.||rawUV.x>1.||rawUV.y<0.||rawUV.y>1.){gl_FragColor=vec4(.0,.0,.0,1.);return;}
      vec2 sampleUV=clamp(rawUV,vec2(.002),vec2(.998));
      vec3 color=texture2D(image,sampleUV).rgb;
      float light=sin(angle*2.-time*.65+scroll*2.4)*.06+1.;
      float luminance=dot(color,vec3(.2126,.7152,.0722));
      color*=light;
      color+=vec3(.09,.055,.025)*pow(max(0.,wave),6.)*exp(-r*3.)*force*luminance;
      vec3 electric=mix(color,color.bgr,.8)*vec3(.76,.9,1.2);
      color=mix(color,electric,clamp(palette,0.,1.));
      color=mix(color,vec3(luminance),clamp(palette-1.,0.,1.));
      gl_FragColor=vec4(color,1.);
    }`;
    function createSurface(image) {
        const canvas = document.createElement('canvas');
        canvas.className = 'liquid-surface';
        canvas.setAttribute('aria-hidden', 'true');
        const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
        if (!gl) return null;
        const shaders = [];
        function shader(type, source) {
            const item = gl.createShader(type); shaders.push(item);
            gl.shaderSource(item, source); gl.compileShader(item);
            if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(item));
            return item;
        }
        let program;
        try {
            program = gl.createProgram();
            gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
            gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        } catch (error) {
            shaders.forEach(item => gl.deleteShader(item));
            if (program) gl.deleteProgram(program);
            console.warn('LIMIAR: imagem estática preservada.', error.message);
            return null;
        }
        gl.useProgram(program);
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        const uniforms = Object.fromEntries(['resolution', 'imageSize', 'pointer', 'time', 'scroll', 'force', 'energy', 'palette'].map(name => [name, gl.getUniformLocation(program, name)]));
        gl.uniform1i(gl.getUniformLocation(program, 'image'), 0);
        gl.uniform2f(uniforms.imageSize, image.naturalWidth, image.naturalHeight);
        image.parentElement.insertBefore(canvas, image.nextSibling);
        image.classList.add('liquid-original');
        let lost = false;
        canvas.addEventListener('webglcontextlost', () => { lost = true; canvas.hidden = true; image.classList.remove('liquid-original'); });
        let width = 1, height = 1, localX = .5, localY = .5, lastFrame = '';
        function resizeSurface() {
            [canvas.width, canvas.height] = renderSize(width, height, devicePixelRatio || 1, coarse.matches);
            gl.viewport(0, 0, canvas.width, canvas.height);
            lastFrame = '';
        }
        const resize = new ResizeObserver(entries => {
            const rect = entries[0].contentRect; width = rect.width; height = rect.height;
            resizeSurface();
        });
        window.addEventListener('resize', resizeSurface, { passive: true });
        coarse.addEventListener('change', resizeSurface);
        resize.observe(canvas);
        let visible = true;
        const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '100px' });
        observer.observe(canvas);
        return {
            draw() {
                if (lost || !visible) return;
                if (!paused) {
                    const rect = canvas.getBoundingClientRect();
                    localX = clamp((pointer.x - rect.left) / Math.max(1, rect.width));
                    localY = 1 - clamp((pointer.y - rect.top) / Math.max(1, rect.height));
                }
                const signature = [width, height, localX, localY, phase, travel, energy, speed, palette].join(',');
                if (signature === lastFrame) return;
                lastFrame = signature;
                gl.uniform2f(uniforms.resolution, width, Math.max(1, height));
                gl.uniform2f(uniforms.pointer, localX, localY);
                gl.uniform1f(uniforms.time, phase);
                gl.uniform1f(uniforms.scroll, travel / Math.max(innerHeight, 1));
                gl.uniform1f(uniforms.force, energy);
                gl.uniform1f(uniforms.energy, clamp(Math.abs(speed) / 900));
                gl.uniform1f(uniforms.palette, palette);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
        };
    }
    const surfaces = [];
    document.querySelectorAll('.art, .lab-art img').forEach(image => {
        const start = () => { try { const surface = createSurface(image); if (surface) surfaces.push(surface); } catch (error) { console.warn('LIMIAR: modo estático.', error.message); } };
        if (image.complete && image.naturalWidth) start(); else image.addEventListener('load', start, { once: true });
    });
    const hero = document.querySelector('.hero');
    const ticker = document.querySelector('.ticker div');
    const scenes = [...document.querySelectorAll('.manifesto, .experiment, footer')];
    const title = document.querySelector('h1');
    function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden) return;
        const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
        lastTime = now;
        const smoothing = 1 - Math.exp(-dt * 8);
        palette = paused ? wantedPalette : mix(palette, wantedPalette, smoothing);
        if (!paused) {
            phase += dt;
            const velocity = dt > 0 ? (scrollY - lastScroll) / dt : 0;
            speed = mix(speed, clamp(velocity, -3000, 3000), smoothing);
            travel = mix(travel, scrollY, smoothing);
            pointer.x = mix(pointer.x, target.x, smoothing); pointer.y = mix(pointer.y, target.y, smoothing);
            energy = mix(energy, pressure, smoothing); pressure *= Math.exp(-dt * 2.8);
            root.style.setProperty('--reading', String(clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight))));
            const progress = clamp(travel / Math.max(1, hero.offsetHeight));
            title.style.transform = `perspective(1100px) rotateX(${progress * 9}deg)`;
            title.style.opacity = String(1 - progress * .35);
            root.style.setProperty('--breathe', String(.5 + Math.sin(phase * .7 + travel * .003) * .5));
            ticker.style.transform = `translateX(${-((travel * .18) % Math.max(1, ticker.scrollWidth / 2))}px)`;
            scenes.forEach(scene => {
                const rect = scene.getBoundingClientRect();
                scene.style.setProperty('--scene', String(clamp((innerHeight - rect.top) / (innerHeight * .65))));
            });
        } else if (reduced.matches) {
            title.style.transform = 'none'; title.style.opacity = '1';
            scenes.forEach(scene => scene.style.setProperty('--scene', '1'));
        }
        lastScroll = scrollY;
        surfaces.forEach(surface => surface.draw());
    }
    requestAnimationFrame(frame);
})();
