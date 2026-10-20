# Run inside Blender after rig_generated.py steps 1-4 (object "Amir" skinned to "AmirRig", rest = T-pose).
# 1. Classify faces as body / shirt / trousers, mostly by texture colour, with bones as a tiebreak,
#    smooth with a neighbour vote, and split into Amir_Body, Amir_Shirt, Amir_Trousers.
# 2. Paint out the illustration's dark outline lines inside the shirt's texture area.
# 3. Add spring-bone "cloth" chains (6 around the shirt hem from the spine, front/back per trouser leg
#    from the thighs) and blend the lower shirt / trouser-leg vertices onto them, more towards the hems.
# 4. Halve the polygons and export with the kept animations.
import bpy, bmesh, math, os
import numpy as np
from collections import Counter
from mathutils import Vector as V

OUT = os.environ.get('AMIR_GLB', 'public/models/amir.glb')
KEEP = ['Idle_Relaxed', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
        'Spell_Simple_Enter', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Spell_Simple_Exit',
        'Dance_Loop', 'Sitting_Idle_Loop']


def ui():
    win = bpy.context.window_manager.windows[0]
    area = next(a for a in win.screen.areas if a.type == 'VIEW_3D')
    return dict(window=win, area=area, region=next(r for r in area.regions if r.type == 'WINDOW'))


def texture(obj):
    mat = obj.data.materials[0]
    img = next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
    W, H = img.size
    return img, W, H, np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)


mesh, rig = bpy.data.objects['Amir'], bpy.data.objects['AmirRig']
me = mesh.data
img, W, H, px = texture(mesh)
uv = me.uv_layers.active.data
names = {g.index: g.name for g in mesh.vertex_groups}


def dom(v):
    gs = me.vertices[v].groups
    return names[max(gs, key=lambda g: g.weight).group] if gs else ''


def colour(p):
    pts = [uv[l].uv for l in p.loop_indices]
    pts.append(sum(pts, pts[0] * 0) / len(pts))
    return np.median(np.array([px[min(H - 1, max(0, int(u.y * H))), min(W - 1, max(0, int(u.x * W))), :3] for u in pts]), axis=0)


# 1. classify and split
cls = []
for p in me.polygons:
    r, g, b = colour(p)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    z = p.center.z
    bone = Counter(dom(v) for v in p.vertices).most_common(1)[0][0]
    skin = (r - b > 0.1) and lum > 0.22
    if any(k in bone for k in ('head', 'neck')) and z > 1.47: k = 'body'
    elif any(k in bone for k in ('hand', 'f_', 'thumb', 'foot', 'toe')) and skin: k = 'body'
    elif skin and (z < 0.2 or any(k in bone for k in ('hand', 'forearm'))): k = 'body'
    elif lum > 0.36 and not skin: k = 'shirt'
    elif lum <= 0.36 and z < 1.0: k = 'trousers'
    elif lum <= 0.36: k = 'shirt' if 0.98 < z < 1.48 else 'body'
    else: k = 'body'
    cls.append(k)
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
for _ in range(2):
    new = cls[:]
    for f in bm.faces:
        nb = Counter(cls[lf.index] for e in f.edges for lf in e.link_faces if lf.index != f.index)
        if nb and nb.most_common(1)[0][1] >= 3: new[f.index] = nb.most_common(1)[0][0]
    cls = new
bm.free()
base = me.materials[0]
for k in ('Shirt', 'Trousers'):
    m = base.copy(); m.name = 'Amir_' + k; me.materials.append(m)
for p in me.polygons:
    p.material_index = {'body': 0, 'shirt': 1, 'trousers': 2}[cls[p.index]]
with bpy.context.temp_override(**ui(), active_object=mesh, object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh]):
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Amir')]:
    m = o.data.materials[o.data.polygons[0].material_index].name
    o.name = m if m in ('Amir_Shirt', 'Amir_Trousers') else 'Amir_Body'
shirt, trousers, body = (bpy.data.objects[n] for n in ('Amir_Shirt', 'Amir_Trousers', 'Amir_Body'))

# 2. paint out dark outline lines inside the shirt's UV area (above the belt)
uvs = shirt.data.uv_layers.active.data
mask = np.zeros((H, W), bool)
for p in shirt.data.polygons:
    if p.center.z < 0.95: continue
    P = np.array([[uvs[l].uv.x * W, uvs[l].uv.y * H] for l in p.loop_indices])
    x0, y0 = np.maximum(np.floor(P.min(0)).astype(int) - 1, 0)
    x1, y1 = np.minimum(np.ceil(P.max(0)).astype(int) + 1, [W - 1, H - 1])
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    for i in range(1, len(P) - 1):
        a, b, c = P[0], P[i], P[i + 1]
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9: continue
        l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
        l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
        mask[y0:y1 + 1, x0:x1 + 1] |= (l1 >= -0.1) & (l2 >= -0.1) & (1 - l1 - l2 >= -0.1)
rgb = px[..., :3]; lum = rgb @ np.array([0.3, 0.59, 0.11])
shirt_col = np.median(rgb[mask & (lum > 0.45)], axis=0)
dark = mask & (lum < 0.4)
grown = dark.copy(); grown[1:] |= dark[:-1]; grown[:-1] |= dark[1:]; grown[:, 1:] |= dark[:, :-1]; grown[:, :-1] |= dark[:, 1:]
grown &= mask & (lum < 0.5)
rgb[grown] = rgb[grown] * 0.25 + shirt_col * 0.75
px[..., :3] = rgb; img.pixels[:] = px.ravel(); img.update(); img.pack()

# 3. cloth chains and weights
sv = [v.co.copy() for v in shirt.data.vertices]
tv = [v.co.copy() for v in trousers.data.vertices]
torso = sorted(p.z for p in sv if abs(p.x) < 0.24 and p.z > 0.8)
Z0, Z2 = 1.22, torso[int(len(torso) * 0.03)] + 0.02
Z1 = (Z0 + Z2) / 2


def ring(pts, z):
    sel = [p for p in pts if abs(p.z - z) < 0.03 and abs(p.x) < 0.24]
    c = sum(sel, V()) / len(sel)
    return c, sum((p - c).xy.length for p in sel) / len(sel)


rings = [ring(sv, z) for z in (Z0, Z1, Z2)]
bpy.context.view_layer.objects.active = rig
with bpy.context.temp_override(**ui(), active_object=rig, object=rig):
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for i in range(6):
        a = 2 * math.pi * (i + 0.5) / 6
        d = V((math.sin(a), -math.cos(a), 0))
        pts = [c + d * r * (0.8 if k == 0 else 0.92 + 0.1 * k) + V((0, 0, z - c.z)) for k, ((c, r), z) in enumerate(zip(rings, (Z0, Z1, Z2)))]
        prev = eb['DEF-spine.001']
        for j in range(2):
            b = eb.new(f'cloth_shirt_{i}_{j}'); b.head, b.tail = pts[j], pts[j + 1]; b.parent = prev; b.use_connect = j > 0
            prev = b
    for side, sfx in ((1, 'L'), (-1, 'R')):
        leg = [p for p in tv if p.x * side > 0.02]
        for fb, sy in (('front', -1), ('back', 1)):
            pts = []
            for z in (0.52, 0.31, 0.10):
                sel = [p for p in leg if abs(p.z - z) < 0.03]
                c = sum(sel, V()) / len(sel); ext = max(abs(p.y - c.y) for p in sel)
                pts.append(V((c.x, c.y + sy * ext * 0.7, z)))
            prev = eb['DEF-thigh.' + sfx]
            for j in range(2):
                b = eb.new(f'cloth_leg_{sfx}_{fb}_{j}'); b.head, b.tail = pts[j], pts[j + 1]; b.parent = prev; b.use_connect = j > 0
                prev = b
    bpy.ops.object.mode_set(mode='OBJECT')


def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)


def blend_in(obj, vidx, targets, amount):
    v = obj.data.vertices[vidx]
    for g in v.groups: g.weight *= (1 - amount)
    for name, share in targets.items():
        (obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)).add([vidx], amount * share, 'ADD')


sel = [v.co for v in shirt.data.vertices if abs(v.co.x) < 0.24 and Z2 < v.co.z < Z0]
c = sum(sel, V()) / len(sel)
for v in shirt.data.vertices:
    p = v.co
    if abs(p.x) > 0.26 or p.z > Z0 or p.z < Z2 - 0.08: continue
    t = smooth((Z0 - p.z) / (Z0 - Z2))
    f = (math.atan2(p.x - c.x, -(p.y - c.y)) % (2 * math.pi)) / (2 * math.pi) * 6 - 0.5
    i0 = math.floor(f) % 6; i1 = (i0 + 1) % 6; w1 = f - math.floor(f)
    lower = smooth((Z1 - p.z) / (Z1 - Z2) + 0.5)
    targets = {}
    for i, wi in ((i0, 1 - w1), (i1, w1)):
        targets[f'cloth_shirt_{i}_0'] = targets.get(f'cloth_shirt_{i}_0', 0) + wi * (1 - lower)
        targets[f'cloth_shirt_{i}_1'] = targets.get(f'cloth_shirt_{i}_1', 0) + wi * lower
    blend_in(shirt, v.index, targets, 0.9 * t)
for v in trousers.data.vertices:
    p = v.co
    if p.z > 0.56: continue
    sfx = 'L' if p.x > 0 else 'R'
    soft, lower = smooth(0.5 - p.y / 0.08), smooth((0.31 - p.z) / 0.21 + 0.5)
    targets = {}
    for fb, share in (('front', soft), ('back', 1 - soft)):
        targets[f'cloth_leg_{sfx}_{fb}_0'] = share * (1 - lower)
        targets[f'cloth_leg_{sfx}_{fb}_1'] = share * lower
    blend_in(trousers, v.index, targets, 0.6 * smooth((0.56 - p.z) / 0.42))
for obj in (shirt, trousers):
    for v in obj.data.vertices:
        s = sum(g.weight for g in v.groups)
        for g in v.groups: g.weight /= s or 1

# 4. halve polygons, export
parts = [body, shirt, trousers]
for o in parts:
    dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = 0.5
    with bpy.context.temp_override(**ui(), active_object=o, object=o, selected_objects=[o], selected_editable_objects=[o]):
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
    for m in o.data.materials: m.use_backface_culling = False
for a in list(bpy.data.actions):
    if a.name not in KEEP: bpy.data.actions.remove(a)
idle = bpy.data.actions['Idle_Relaxed']; rig.animation_data.action = idle; rig.animation_data.action_slot = idle.slots[0]
with bpy.context.temp_override(**ui(), active_object=rig, selected_objects=[rig] + parts):
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animation_mode='ACTIONS',
                              export_force_sampling=True, export_frame_step=2, export_skins=True, export_morph=False,
                              export_image_format='JPEG', export_image_quality=88, export_cameras=False, export_lights=False)
print('exported', OUT)
