import * as THREE from "/vendor/three.module.js";
export function createStudioEnvironment(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color("#8b9d9f");
  const panels = [
    [[0, 5, 0], [10, 1, 8], "#c9e7ed"],
    [[-4, 1, 1], [1, 6, 8], "#b1c9d4"],
    [[4, 1, -2], [1, 6, 8], "#e3ccb0"],
    [[0, -3, 0], [10, 1, 10], "#363f41"],
  ];
  for (const [p, scale, color] of panels) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...scale),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(...p);
    s.add(mesh);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(s, 0.04, 0.1, 50);
  pmrem.dispose();
  s.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return rt.texture;
}
