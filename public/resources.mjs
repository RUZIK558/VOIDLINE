// Mesh geometries and skeletons are instance-owned; most character materials are shared.
// Never dispose shared fabrics or skin-cache textures while removing one player/drop.
export function disposeOwnedTree(root,{materials=false,textures=false}={}){
 const geometries=new Set(),skeletons=new Set(),mats=new Set(),maps=new Set();
 root.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);
  for(const m of o.userData.privateMaterials||[])mats.add(m);
  for(const m of Object.values(o.userData.factory||{}))mats.add(m);
  if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData?.instanceOwned)mats.add(m);
  if(materials&&o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);
 });
 root.removeFromParent();
 for(const g of geometries)g.dispose();for(const s of skeletons)s.dispose();
 for(const m of mats){for(const t of m.userData?.ownedTextures||[])maps.add(t);if(textures)for(const v of Object.values(m))if(v?.isTexture)maps.add(v);m.dispose();}
 for(const t of maps)t.dispose();root.clear();
}
