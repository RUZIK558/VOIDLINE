import * as THREE from "/vendor/three.module.js";
export function createPostFX(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const uniforms = {
    map: { value: target.texture },
    texel: { value: new THREE.Vector2(1, 1) },
    brightness: { value: 1 },
    contrast: { value: 1 },
    saturation: { value: 1 },
    sharpness: { value: 0 },
    vignette: { value: 0 },
    fxaa: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    toneMapped: true,
    depthTest: false,
    depthWrite: false,
    uniforms,
    vertexShader: `varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `precision highp float;varying vec2 uv0;uniform sampler2D map;uniform vec2 texel;uniform float brightness,contrast,saturation,sharpness,vignette,fxaa;float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}void main(){vec3 c=texture2D(map,uv0).rgb;vec3 a=texture2D(map,uv0+vec2(texel.x,0.)).rgb,b=texture2D(map,uv0-vec2(texel.x,0.)).rgb,d=texture2D(map,uv0+vec2(0.,texel.y)).rgb,e=texture2D(map,uv0-vec2(0.,texel.y)).rgb;vec3 avg=(a+b+d+e)*.25;float edge=max(max(lum(a),lum(b)),max(lum(d),lum(e)))-min(min(lum(a),lum(b)),min(lum(d),lum(e)));c=mix(c,mix(c,avg,.45),fxaa*smoothstep(.08,.3,edge));c+=sharpness*.6*(c-avg);c=mix(vec3(lum(c)),c,saturation);c=(c-.5)*contrast+.5;c*=brightness;c*=1.-vignette*smoothstep(.22,.72,length(uv0-.5));gl_FragColor=vec4(max(c,vec3(0.)),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.Camera();
  return {
    target,
    resize(w, h, aa) {
      target.setSize(w, h);
      const samples = aa === "msaa" ? 4 : 0;
      if (target.samples !== samples) {
        target.samples = samples;
        target.dispose();
      }
      uniforms.texel.value.set(1 / w, 1 / h);
    },
    begin() {
      renderer.setRenderTarget(target);
      renderer.clear();
    },
    end(settings) {
      renderer.setRenderTarget(null);
      for (const k of [
        "brightness",
        "contrast",
        "saturation",
        "sharpness",
        "vignette",
      ])
        uniforms[k].value = settings[k];
      uniforms.fxaa.value = settings.aa === "fxaa" ? 1 : 0;
      renderer.autoClear = true;
      renderer.render(scene, camera);
    },
  };
}
