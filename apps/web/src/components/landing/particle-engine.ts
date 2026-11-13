// Point-morph shader adapted from Assay (MIT), copyright 2026 Rudransh Singh Tomar.
// Source revision and full license: THIRD_PARTY_NOTICES.md. Geometry and lifecycle are ProofBill's.
const vertex = `
attribute vec4 a0; attribute vec4 a1; attribute vec4 a2; attribute float aSeed;
uniform float uFrom,uTo,uProg,uTime,uAspect,uSize,uMouseOn;
uniform vec2 uRot,uMouse;
varying vec4 vC;
vec4 P(float i){if(i<0.5)return a0;if(i<1.5)return a1;return a2;}
vec3 C(float i){if(i<0.5)return vec3(.32,.91,.61);if(i<1.5)return vec3(.50,.79,.83);return vec3(.91,.91,.84);}
void main(){
 vec4 A=P(uFrom),B=P(uTo);
 float t=clamp((uProg-aSeed*.42)/.58,0.,1.);
 t=t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)/2.;
 vec3 p=mix(A.xyz,B.xyz,t);
 float s=sin(t*3.14159265);
 vec3 dir=normalize(vec3(sin(aSeed*91.7),cos(aSeed*47.3),sin(aSeed*13.1+1.))+ .001);
 p+=dir*s*(.22+.6*aSeed);
 p.z+=.012*sin(uTime*1.1+aSeed*40.);
 float cy=cos(uRot.x),sy=sin(uRot.x),cx=cos(uRot.y),sx=sin(uRot.y);
 p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);
 p=vec3(p.x,cx*p.y-sx*p.z,sx*p.y+cx*p.z);
 float w=5./(5.-p.z);
 vec2 ndc=vec2(p.x*.68/uAspect,p.y*.68)*w;
 vec2 dd=ndc-uMouse;dd.x*=uAspect;
 float dist=length(dd),f=uMouseOn*(1.-smoothstep(0.,.25,dist));
 ndc+=(dd/(dist+.0001))*f*.055*vec2(1./uAspect,1.);
 gl_Position=vec4(ndc,0.,1.);
 float a=mix(A.w,B.w,t);
 gl_PointSize=max(1.4,uSize*w*(.72+.34*a));
 vC=vec4(mix(C(uFrom),C(uTo),t),a*(.88+.12*sin(uTime*1.3+aSeed*71.)));
}`;
const fragment = `precision mediump float;varying vec4 vC;
void main(){vec2 q=gl_PointCoord-.5;float a=(1.-smoothstep(.14,.5,length(q)))*vC.a;if(a<.004)discard;gl_FragColor=vec4(vC.rgb*a,a);}`;

type Point = [number, number, number, number];
export interface ParticleEngine {
  draw: (
    time: number,
    phase: number,
    pointer: [number, number],
    moving: boolean,
  ) => void;
  resize: () => void;
  dispose: () => void;
}

function sampleShape(kind: number, count: number): Point[] {
  let seed = 119 + kind;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (kind === 1)
    return Array.from({ length: count }, (_, i) => {
      const a = (random() - 0.5) * 1.5,
        b = (random() - 0.5) * 1.5;
      const edge = (i % 2 ? 1 : -1) * 0.75;
      return i % 3 === 0
        ? [a, b, edge, 0.68]
        : i % 3 === 1
          ? [a, edge, b, 0.68]
          : [edge, a, b, 0.68];
    });
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 640;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "#000";
  context.fillRect(0, 0, 420, 640);
  context.fillStyle = "#404040";
  context.strokeStyle = "#fff";
  context.lineWidth = 4;
  context.beginPath();
  if (kind === 0) context.roundRect(24, 50, 372, 540, 24);
  else {
    context.moveTo(42, 28);
    for (let x = 42; x <= 378; x += 12) context.lineTo(x, x % 24 ? 28 : 38);
    context.lineTo(378, 610);
    for (let x = 378; x >= 42; x -= 12) context.lineTo(x, x % 24 ? 610 : 600);
    context.closePath();
  }
  context.fill();
  context.stroke();
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.font = "bold 30px monospace";
  context.fillText("PROOFBILL", 210, 108);
  context.font = "16px monospace";
  context.fillText(kind === 0 ? "PURCHASE PASS" : "PAYMENT RECORD", 210, 144);
  context.strokeStyle = "#bbb";
  context.lineWidth = 2;
  for (const y of [175, 370, 485]) {
    context.beginPath();
    context.moveTo(58, y);
    context.lineTo(362, y);
    context.stroke();
  }
  if (kind === 0) {
    context.beginPath();
    context.lineWidth = 12;
    context.lineCap = "round";
    context.strokeStyle = "#fff";
    context.moveTo(150, 250);
    context.lineTo(192, 290);
    context.lineTo(278, 208);
    context.stroke();
  } else {
    context.font = "bold 48px monospace";
    context.fillText("0.010", 210, 265);
    context.font = "20px monospace";
    context.fillText("PAID", 210, 317);
  }
  context.font = "17px monospace";
  context.fillText("NEAR TESTNET", 210, 410);
  context.fillText(kind === 0 ? "YOU APPROVE" : "pass-2-order", 210, 449);
  for (let i = 0; i < 52; i++) {
    const width = 1 + ((i * 7) % 3);
    context.fillRect(65 + i * 5.6, 516, width, 38 + (i % 3) * 2);
  }
  const pixels = context.getImageData(0, 0, 420, 640).data;
  const ink: Point[] = [],
    paper: Point[] = [];
  for (let y = 0; y < 640; y += 3)
    for (let x = 0; x < 420; x += 3) {
      const value = pixels[(y * 420 + x) * 4] / 255;
      if (value < 0.1) continue;
      const point: Point = [
        (x - 210) / 256,
        (320 - y) / 256,
        -0.12 * ((320 - y) / 256) ** 2 + 0.09,
        value > 0.6 ? 1 : 0.16,
      ];
      (value > 0.6 ? ink : paper).push(point);
    }
  const chosen: Point[] = [];
  const targetInk = Math.min(count * 0.78, ink.length);
  for (let i = 0; i < count; i++) {
    const pool = i < targetInk ? ink : paper;
    chosen.push(pool[Math.floor(random() * pool.length)] ?? ink[0]);
  }
  return chosen;
}

export function createParticleEngine(
  canvas: HTMLCanvasElement,
): ParticleEngine | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    depth: false,
  });
  if (!gl || gl.isContextLost()) return null;
  const shaders: WebGLShader[] = [],
    buffers: WebGLBuffer[] = [];
  const program = gl.createProgram();
  if (!program) return null;
  const compile = (source: string, type: number) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Shader is unavailable");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error("Shader compilation failed");
    gl.attachShader(program, shader);
  };
  const dispose = () => {
    buffers.forEach((buffer) => gl.deleteBuffer(buffer));
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
  };
  try {
    compile(vertex, gl.VERTEX_SHADER);
    compile(fragment, gl.FRAGMENT_SHADER);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Shader link failed");
    gl.useProgram(program);
    const count = innerWidth < 760 ? 3400 : 6400;
    const attribute = (name: string, values: Float32Array, size: number) => {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Buffer is unavailable");
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };
    for (let i = 0; i < 3; i++)
      attribute(`a${i}`, new Float32Array(sampleShape(i, count).flat()), 4);
    attribute(
      "aSeed",
      new Float32Array(
        Array.from({ length: count }, (_, i) => ((i * 7919) % 10007) / 10007),
      ),
      1,
    );
    const uniform = Object.fromEntries(
      [
        "uFrom",
        "uTo",
        "uProg",
        "uTime",
        "uAspect",
        "uSize",
        "uRot",
        "uMouse",
        "uMouseOn",
      ].map((name) => [name, gl.getUniformLocation(program, name)]),
    );
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    let from = 0,
      target = 0,
      progress = 1,
      changed = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const density = Math.min(devicePixelRatio || 1, 1.6);
      canvas.width = Math.max(1, Math.round(rect.width * density));
      canvas.height = Math.max(1, Math.round(rect.height * density));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const draw: ParticleEngine["draw"] = (time, phase, pointer, moving) => {
      if (phase !== target) {
        from = target;
        target = phase;
        changed = time;
        progress = 0;
      }
      progress = moving ? Math.min(1, Math.max(0, (time - changed) / 1.1)) : 1;
      gl.useProgram(program);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniform.uFrom, from);
      gl.uniform1f(uniform.uTo, target);
      gl.uniform1f(uniform.uProg, progress);
      gl.uniform1f(uniform.uTime, moving ? time : 0);
      gl.uniform1f(uniform.uAspect, canvas.width / canvas.height);
      gl.uniform1f(uniform.uSize, Math.min(devicePixelRatio || 1, 1.6) * 2.2);
      gl.uniform2f(
        uniform.uRot,
        -0.18 + pointer[0] * 0.24 + (moving ? Math.sin(time * 0.25) * 0.1 : 0),
        0.05 + pointer[1] * 0.14,
      );
      gl.uniform2f(uniform.uMouse, pointer[0], -pointer[1]);
      gl.uniform1f(
        uniform.uMouseOn,
        Math.abs(pointer[0]) + Math.abs(pointer[1]) > 0.02 ? 1 : 0,
      );
      gl.drawArrays(gl.POINTS, 0, count);
    };
    resize();
    return { draw, resize, dispose };
  } catch {
    dispose();
    return null;
  }
}
