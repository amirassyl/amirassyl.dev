// Cel-shaded materials for Amir: three flat steps of light (a gradient ramp)
// plus a soft rim light on the edges facing away from the camera.
import { CanvasTexture, Color, DataTexture, MeshToonMaterial, NearestFilter, RedFormat, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

let ramp: DataTexture | undefined;
function gradientRamp(): DataTexture {
  if (!ramp) {
    ramp = new DataTexture(new Uint8Array([90, 175, 255]), 3, 1, RedFormat);
    ramp.minFilter = ramp.magFilter = NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}

/** Shared by every toon material, updated by the scene each frame. */
export const rim = { color: { value: new Color('#ffffff') }, strength: { value: 0.35 } };

export function toon(colour: string, map?: Texture): MeshToonMaterial {
  const material = new MeshToonMaterial({ color: colour, gradientMap: gradientRamp(), ...(map ? { map } : {}) });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = rim.color;
    shader.uniforms.uRimStrength = rim.strength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
      .replace(
        '#include <opaque_fragment>',
        `float rimLight = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        outgoingLight += uRimColor * smoothstep(0.35, 0.6, rimLight) * uRimStrength;
        #include <opaque_fragment>`,
      );
  };
  return material;
}

/** The striped tee: white with black stripes, as a tiny repeating texture. */
export function stripes(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f6f3ec';
  ctx.fillRect(0, 0, 4, 16);
  ctx.fillStyle = '#1d1d22';
  ctx.fillRect(0, 0, 4, 6);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 6);
  return texture;
}
