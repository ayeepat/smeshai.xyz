// смэш — the backdrop: a shelf of plaster geometry-class solids, raymarched
// in a fragment shader at a quarter of the screen resolution and ordered-
// dithered down to four tones, so it reads as moving pixel art. The glass
// surfaces on top blur it. No library: one shader, ~30 fps, paused when the
// tab is hidden, a single still frame for reduced-motion visitors, and a
// plain CSS wash (html.no-scene) when WebGL is unavailable.

(function () {
  var PIXEL = 4;          // CSS px per art pixel
  var coarse = window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  var FPS = coarse ? 20 : 30;   // phones: fewer frames, less re-blurring of the glass
  var PARALLAX = 0.55;    // backdrop scrolls slower than the page
  var COUNT = 6;

  var root = document.documentElement;
  var canvas = document.createElement("canvas");
  canvas.className = "scene";
  canvas.setAttribute("aria-hidden", "true");

  var gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  } catch (_) {}
  if (!gl) { root.classList.add("no-scene"); return; }

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 uRes;",
    "uniform float uTime, uScroll, uScale, uStrength, uGlow;",
    "uniform vec2 uMouse;",
    "uniform vec3 uBg, uAccent, uT0, uT1, uT2, uT3;",
    "uniform vec3 uPos[6];",
    "uniform mat3 uRot[6];",

    "float bayer2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}",
    "float bayer4(vec2 a){return bayer2(.5*a)*.25+bayer2(a);}",

    "float sdBox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}",
    "float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}",
    "float sdCone(vec3 p,float h,float r1,float r2){",
    "  vec2 q=vec2(length(p.xz),p.y);vec2 k1=vec2(r2,h);vec2 k2=vec2(r2-r1,2.*h);",
    "  vec2 ca=vec2(q.x-min(q.x,(q.y<0.)?r1:r2),abs(q.y)-h);",
    "  vec2 cb=q-k1+k2*clamp(dot(k1-q,k2)/dot(k2,k2),0.,1.);",
    "  float s=(cb.x<0.&&ca.y<0.)?-1.:1.;",
    "  return s*sqrt(min(dot(ca,ca),dot(cb,cb)));}",
    "float sdHex(vec3 p,vec2 h){",
    "  const vec3 k=vec3(-.8660254,.5,.57735);p=abs(p.xzy);",
    "  p.xy-=2.*min(dot(k.xy,p.xy),0.)*k.xy;",
    "  vec2 d=vec2(length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x),h.x))*sign(p.y-h.x),p.z-h.y);",
    "  return min(max(d.x,d.y),0.)+length(max(d,0.));}",
    "float sdOcta(vec3 p,float s){p=abs(p);return (p.x+p.y+p.z-s)*.57735;}",

    // one solid per slot, each in its own rotating frame
    "float o0(vec3 p){p=uRot[0]*p;return min(length(p)-.30,sdTorus(p,vec2(.47,.035)));}",
    "float o1(vec3 p){p=uRot[1]*p;return sdBox(p,vec3(.25),.03);}",
    "float o2(vec3 p){p=uRot[2]*p;return sdCone(p,.33,.30,.0)-.015;}",
    "float o3(vec3 p){p=uRot[3]*p;return sdTorus(p,vec2(.30,.125));}",
    "float o4(vec3 p){p=uRot[4]*p;",
    "  float b=sdHex(p,vec2(.085,.34));",
    "  float t=sdCone(p-vec3(0.,.46,0.),.12,.085,.0);",
    "  float e=length(vec2(length(p.xz)-.0,0.))-.09;e=max(e,abs(p.y+.39)-.05);",
    "  return min(min(b,t),e);}",
    "float o5(vec3 p){p=uRot[5]*p;return sdOcta(p,.40)-.012;}",

    "float map(vec3 p){",
    "  float s=uScale;float d=1e5;",
    "  d=min(d,o0((p-uPos[0])/s)*s);",
    "  d=min(d,o1((p-uPos[1])/s)*s);",
    "  d=min(d,o2((p-uPos[2])/s)*s);",
    "  d=min(d,o3((p-uPos[3])/s)*s);",
    "  d=min(d,o4((p-uPos[4])/s)*s);",
    "  d=min(d,o5((p-uPos[5])/s)*s);",
    "  return d;}",

    "float near2(vec2 p){",
    "  float d=1e5;",
    "  for(int i=0;i<6;i++){d=min(d,length(p-uPos[i].xy));}",
    "  return d-.60*uScale;}",

    "vec3 tone(float v,float th){",
    "  float x=clamp(v,0.,.999)*3.;float i=floor(x);float f=x-i;",
    "  i+=step(th,f);",
    "  if(i<.5)return uT0;if(i<1.5)return uT1;if(i<2.5)return uT2;return uT3;}",

    "void main(){",
    "  vec2 px=gl_FragCoord.xy;",
    "  vec2 uv=(px-.5*uRes)/(.5*uRes.y);",
    "  float th=bayer4(px);",

    // dithered light wells — the pixel-art version of a soft gradient wash
    "  float asp=uRes.x/uRes.y;",
    "  vec2 c1=vec2(asp*.62+.08*sin(uTime*.21),.48+.06*cos(uTime*.17)+uScroll*.25);",
    "  vec2 c2=vec2(-asp*.78+.07*cos(uTime*.15),-.72+.08*sin(uTime*.19)+uScroll*.12);",
    "  float g=exp(-dot(uv-c1,uv-c1)/.55)+.8*exp(-dot(uv-c2,uv-c2)/.42);",
    "  float gl=clamp(g,0.,1.)*4.;float gi=floor(gl);gi+=step(th,gl-gi);",
    "  vec3 col=mix(uBg,uAccent,gi/4.*uGlow);",

    "  vec2 wp=vec2(uv.x,mod(uv.y-uScroll+6.05,7.2)-6.05);",
    "  if(near2(wp)<0.){",
    "    vec3 ro=vec3(wp,-1.6);float t=0.;float hit=0.;",
    "    for(int i=0;i<44;i++){",
    "      float d=map(ro+vec3(0.,0.,t));",
    "      if(d<.003){hit=1.;break;}",
    "      t+=d;if(t>3.2)break;}",
    "    if(hit>.5){",
    "      vec3 p=ro+vec3(0.,0.,t);vec2 e=vec2(.004,0.);",
    "      vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));",
    "      vec3 l=normalize(vec3(-.55+uMouse.x*.5,.72+uMouse.y*.4,-.62));",
    "      float diff=clamp(dot(n,l),0.,1.);",
    "      float rim=pow(1.-clamp(-n.z,0.,1.),3.)*.22;",
    "      float v=.08+.92*diff+rim;",
    "      col=mix(col,tone(v,th),uStrength);",
    "    }",
    "  }",
    "  gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console) console.warn("scene shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  var prog = gl.createProgram();
  if (vs && fs) {
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  }
  if (!vs || !fs || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    root.classList.add("no-scene");
    return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["uRes", "uTime", "uScroll", "uScale", "uStrength", "uGlow", "uMouse",
    "uBg", "uAccent", "uT0", "uT1", "uT2", "uT3"].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });
  U.uPos = gl.getUniformLocation(prog, "uPos[0]");
  U.uRot = gl.getUniformLocation(prog, "uRot[0]");

  // ---- palette, read from the theme tokens ------------------------------
  var probe = document.createElement("i");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";

  function token(name) {
    probe.style.color = "var(" + name + ")";
    var m = getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  var dark = false;
  function readPalette() {
    var bg = token("--bg"), accent = token("--accent");
    dark = (bg[0] + bg[1] + bg[2]) / 3 < 0.4;
    var t0, t1, t2, t3;
    if (dark) {
      t0 = mix(bg, [0, 0, 0], 0.4);
      t1 = mix(bg, accent, 0.22);
      t2 = mix(bg, accent, 0.55);
      t3 = mix(accent, [1, 1, 1], 0.25);
    } else {
      t0 = mix(bg, accent, 0.95);
      t1 = mix(bg, accent, 0.5);
      t2 = mix(bg, accent, 0.16);
      t3 = [1, 1, 1];
    }
    gl.uniform3fv(U.uBg, bg);
    gl.uniform3fv(U.uAccent, accent);
    gl.uniform3fv(U.uT0, t0);
    gl.uniform3fv(U.uT1, t1);
    gl.uniform3fv(U.uT2, t2);
    gl.uniform3fv(U.uT3, t3);
    gl.uniform1f(U.uGlow, dark ? 0.2 : 0.26);
  }

  // ---- layout -----------------------------------------------------------
  var W = 0, H = 0, aspect = 1, narrow = false, viewH = 1;
  var pos = new Float32Array(COUNT * 3);
  var rot = new Float32Array(COUNT * 9);

  // side (-1 left, +1 right), how far in from the edge, y, spin speeds, base tilt
  var SOLIDS = [
    { side: 1, inset: 0.20, y: 0.50, wy: 0.22, wx: 0.00, tilt: 0.45 },
    { side: -1, inset: 0.12, y: -0.78, wy: 0.31, wx: 0.17, tilt: 0.60 },
    { side: 1, inset: 0.16, y: -1.95, wy: 0.26, wx: 0.11, tilt: -0.35 },
    { side: -1, inset: 0.18, y: -3.10, wy: 0.19, wx: 0.24, tilt: 0.90 },
    { side: 1, inset: 0.14, y: -4.25, wy: 0.28, wx: 0.00, tilt: 0.75 },
    { side: -1, inset: 0.16, y: -5.40, wy: 0.24, wx: 0.15, tilt: 0.30 }
  ];

  function resize() {
    // The canvas is 100lvh tall in CSS; measure it rather than innerHeight so
    // a phone's collapsing address bar doesn't reallocate and rescale the scene.
    var ch = canvas.clientHeight || window.innerHeight;
    var w = Math.max(1, Math.ceil(window.innerWidth / PIXEL));
    var h = Math.max(1, Math.ceil(ch / PIXEL));
    if (w === W && h === H) return;
    W = w; H = h; aspect = w / h; viewH = ch;
    narrow = window.innerWidth <= 880;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uScale, Math.max(0.55, Math.min(1, aspect / 1.35)));
    for (var i = 0; i < COUNT; i++) {
      var s = SOLIDS[i];
      pos[i * 3] = s.side * (aspect - s.inset);
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = 0;
    }
    gl.uniform3fv(U.uPos, pos);
  }

  var mouse = [0, 0], mouseT = [0, 0];
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    mouseT[0] = (e.clientX / window.innerWidth) * 2 - 1;
    mouseT[1] = 1 - (e.clientY / window.innerHeight) * 2;
  }, { passive: true });

  function setRot(i, ay, ax) {
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    var o = i * 9;
    rot[o] = cy; rot[o + 1] = sx * sy; rot[o + 2] = -cx * sy;
    rot[o + 3] = 0; rot[o + 4] = cx; rot[o + 5] = sx;
    rot[o + 6] = sy; rot[o + 7] = -sx * cy; rot[o + 8] = cx * cy;
  }

  function draw(t) {
    resize();
    mouse[0] += (mouseT[0] - mouse[0]) * 0.08;
    mouse[1] += (mouseT[1] - mouse[1]) * 0.08;
    for (var i = 0; i < COUNT; i++) {
      var s = SOLIDS[i];
      setRot(i, t * s.wy + mouse[0] * 0.7 + i, s.tilt + t * s.wx - mouse[1] * 0.45);
    }
    gl.uniformMatrix3fv(U.uRot, false, rot);
    gl.uniform1f(U.uTime, t);
    gl.uniform2f(U.uMouse, mouse[0], mouse[1]);
    gl.uniform1f(U.uScroll, -(window.scrollY / Math.max(1, viewH)) * 2 * PARALLAX);
    gl.uniform1f(U.uStrength, narrow ? (dark ? 0.5 : 0.42) : (dark ? 0.8 : 0.7));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- run --------------------------------------------------------------
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var start = performance.now(), last = 0, raf = 0;
  var STILL = 7.3; // a flattering pose for the single reduced-motion frame

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS - 2) return;
    last = now;
    draw((now - start) / 1000);
  }
  function still() { draw(STILL); }

  function boot() {
    document.body.insertBefore(canvas, document.body.firstChild);
    document.body.appendChild(probe);
    readPalette();
    // paint before the first rAF so the opaque canvas never shows up blank
    still();

    if (reduce) {
      window.addEventListener("scroll", still, { passive: true });
      window.addEventListener("resize", still);
    } else {
      raf = requestAnimationFrame(frame);
      document.addEventListener("visibilitychange", function () {
        cancelAnimationFrame(raf);
        if (!document.hidden) raf = requestAnimationFrame(frame);
      });
    }

    // follow the theme toggle and the system scheme
    var repaint = function () { readPalette(); if (reduce) still(); };
    new MutationObserver(repaint).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", repaint);
    else if (mq.addListener) mq.addListener(repaint);

    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      cancelAnimationFrame(raf);
      canvas.remove();
      root.classList.add("no-scene");
    });
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
