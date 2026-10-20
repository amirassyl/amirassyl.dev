# Restyle Quaternius' CC0 Universal Animation Library mannequin as Amir and export a GLB.
import bpy, bmesh, math, sys, mathutils
from collections import Counter
sys.path.insert(0, '/Users/amir/.claude/jobs/0753da4a/tmp/bl'); from common import *
OUT = sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '/Users/amir/.claude/jobs/0753da4a/tmp/bl/amir.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/Users/amir/.claude/jobs/0753da4a/tmp/dl-ual/ual/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb')
for o in list(bpy.data.objects):
    if o.name == 'Icosphere': bpy.data.objects.remove(o)
rig = bpy.data.objects['Rig']; rig.data.pose_position = 'REST'
body = bpy.data.objects['Mannequin']

def mat(name, rgb, rough=0.7, sheen=0.0, spec=0.4):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*rgb, 1); p.inputs['Roughness'].default_value = rough
    for k in ('Specular IOR Level', 'Specular'):
        if k in p.inputs: p.inputs[k].default_value = spec
    return m
M = {
 'skin':   mat('Skin',   (0.80, 0.58, 0.44), 0.5),
 'hair':   mat('Hair',   (0.018, 0.014, 0.012), 0.42, spec=0.55),
 'jacket': mat('Denim',  (0.03, 0.04, 0.065), 0.9, spec=0.2),
 'shirt':  mat('Shirt',  (0.62, 0.71, 0.82), 0.8, spec=0.25),
 'jeans':  mat('Jeans',  (0.045, 0.07, 0.12), 0.88, spec=0.2),
 'shoe':   mat('Sneaker',(0.86, 0.86, 0.84), 0.6),
 'black':  mat('Black',  (0.01, 0.01, 0.012), 0.3, spec=0.6),
 'eye':    mat('Eye',    (0.02, 0.015, 0.012), 0.2, spec=0.8),
}
body.data.materials.clear()
order = ['skin','hair','jacket','shirt','jeans','shoe','black','eye']
for k in order: body.data.materials.append(M[k])
IDX = {k:i for i,k in enumerate(order)}

names = {g.index: g.name for g in body.vertex_groups}
vdom = {}
for v in body.data.vertices:
    if v.groups: vdom[v.index] = names[max(v.groups, key=lambda g: g.weight).group]
mw = body.matrix_world

def region(grp, c):
    x, y, z = c
    if grp in ('DEF-head',): return 'skin'
    if grp == 'DEF-neck': return 'skin'
    if 'hand' in grp or 'f_' in grp or 'thumb' in grp: return 'skin'
    if grp.startswith('DEF-spine') or 'shoulder' in grp or 'upper_arm' in grp or 'forearm' in grp:
        return 'jacket'
    if grp == 'DEF-hips': return 'jacket' if z > 1.0 else 'jeans'
    if 'thigh' in grp: return 'jeans'
    if 'shin' in grp: return 'shoe' if z < 0.095 else 'jeans'
    if 'foot' in grp or 'toe' in grp: return 'shoe'
    return 'skin'

vreg = {}
for p in body.data.polygons:
    grp = Counter(vdom.get(i, 'x') for i in p.vertices).most_common(1)[0][0]
    r = region(grp, mw @ p.center)
    p.material_index = IDX[r]
    for i in p.vertices: vreg.setdefault(i, Counter())[r] += 1
# Slim the superhero base: pull each vertex toward its bone's axis (rest pose, armature space = world).
SLIM = {'upper_arm': 0.74, 'forearm': 0.84, 'shoulder': 0.72, 'spine.003': 0.84, 'spine.002': 0.86, 'spine.001': 0.9,
        'thigh': 0.88, 'shin': 0.92, 'neck': 0.92}
def closest_on(a, b, p):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared)); return a + ab * t
for v in body.data.vertices:
    g = vdom.get(v.index, '')
    k = next((f for key, f in SLIM.items() if key in g), None)
    if k is None: continue
    bone = rig.data.bones[g]
    c = closest_on(bone.head_local, bone.tail_local, v.co)
    if g.startswith('DEF-spine'):   # keep the torso's depth, slim mostly the width
        d = v.co - c; v.co = c + mathutils.Vector((d.x * k, d.y * (0.5 + k/2), d.z))
    else:
        v.co = c + (v.co - c) * k

def link(o): bpy.context.scene.collection.objects.link(o); return o
# Garments: rebuild jacket and jeans as single smooth shells over the segmented mannequin.
def make_garment(name, regions, mkey, inflate, voxel=0.011, smooth_iter=10, ratio=0.25):
    src = bpy.data.objects.new(name, body.data.copy()); link(src)
    bm = bmesh.new(); bm.from_mesh(src.data)
    keep_mats = {IDX[r] for r in regions}
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in keep_mats], context='FACES')
    bm.to_mesh(src.data); bm.free()
    src.vertex_groups.clear()
    so = src.modifiers.new('so', 'SOLIDIFY'); so.thickness = 0.03; so.offset = -1
    rm = src.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = voxel
    sm = src.modifiers.new('sm', 'SMOOTH'); sm.factor = 0.8; sm.iterations = smooth_iter
    dp = src.modifiers.new('dp', 'DISPLACE'); dp.strength = inflate; dp.mid_level = 0.0
    dc = src.modifiers.new('dc', 'DECIMATE'); dc.ratio = ratio
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = src; src.select_set(True)
    bpy.ops.object.convert(target='MESH')
    src.data.materials.clear(); src.data.materials.append(M[mkey])
    for p_ in src.data.polygons: p_.use_smooth = True
    for g in body.vertex_groups: src.vertex_groups.new(name=g.name)
    dt = src.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = body; dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.modifier_apply(modifier='dt')
    src.select_set(False)
    print('GARMENT', name, len(src.data.polygons))
    return src
jacket = make_garment('Jacket', ['jacket'], 'jacket', 0.012)
jeans = make_garment('Jeans', ['jeans'], 'jeans', 0.006, voxel=0.01, smooth_iter=6)
# remove the body faces now covered by garments
bm = bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in (IDX['jacket'], IDX['jeans'])], context='FACES')
bm.to_mesh(body.data); bm.free()
garments = [jacket, jeans]
# ---------- head accessories (each weighted 100% to DEF-head, then joined into the body) ----------
headpts = [mw @ body.data.vertices[i].co for i, n in vdom.items() if n == 'DEF-head']
def _hit(origin, direction):
    ok, loc, n, i = body.ray_cast(mathutils.Vector(origin), mathutils.Vector(direction))
    return loc if ok else None
def front_y(z, x=0.0):
    h = _hit((x, -1.0, z), (0, 1, 0)); return h.y
def half_w(z):
    h = _hit((1.0, 0.0, z), (-1, 0, 0)); return h.x
EYE_Z = 1.705; FY = front_y(EYE_Z); HW = half_w(EYE_Z)
print('front y', FY, 'half width', HW)
parts = []
def finish(o, mkey):
    o.data.materials.clear(); o.data.materials.append(M[mkey])
    for p in o.data.polygons: p.use_smooth = True
    parts.append(o); return o
def link(o): bpy.context.scene.collection.objects.link(o); return o

def ellipsoid(name, loc, size, mkey, seg=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg//2, radius=1.0)
    for v in bm.verts: v.co = mathutils.Vector((v.co.x*size[0]+loc[0], v.co.y*size[1]+loc[1], v.co.z*size[2]+loc[2]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return finish(link(bpy.data.objects.new(name, me)), mkey)

# Hair: a smooth cap cut around the face, covered by ~100 wavy tapered locks.
import random; random.seed(7)
C = mathutils.Vector((0.0, 0.010, 1.736)); R = mathutils.Vector((0.100, 0.124, 0.112))
def zcut(x, y):
    f = max(0.0, min(1.0, -(y - C.y) / R.y * 1.4)); b = max(0.0, min(1.0, (y - C.y) / R.y * 1.2))
    return 1.70 + f * (0.062 - 0.20 * x) - b * 0.07
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1.0)
for v in bm.verts: v.co = mathutils.Vector((v.co.x*R.x, v.co.y*R.y, v.co.z*R.z)) + C
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < zcut(v.co.x, v.co.y) - 0.004], context='VERTS')
me = bpy.data.meshes.new('HairCap'); bm.to_mesh(me); bm.free()
cap = link(bpy.data.objects.new('HairCap', me)); cap.modifiers.new('sol', 'SOLIDIFY').thickness = 0.006
finish(cap, 'hair')
def onshell(p, k=1.0):
    d = p - C; e = mathutils.Vector((d.x/R.x, d.y/R.y, d.z/R.z))
    return C + mathutils.Vector((e.x*R.x, e.y*R.y, e.z*R.z)) / max(e.length, 1e-6) * k
SWEEP = mathutils.Vector((-1.0, -0.25, -0.35)).normalized()   # fringe sweeps to one side
cu = bpy.data.curves.new('Locks', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 1; cu.resolution_u = 4
n = 0
for i in range(420):
    u = random.uniform(-1, 1); t = random.uniform(0, 2*math.pi)
    d = mathutils.Vector((math.sqrt(1-u*u)*math.cos(t), math.sqrt(1-u*u)*math.sin(t), u))
    root = C + mathutils.Vector((d.x*R.x, d.y*R.y, d.z*R.z))
    if root.z < zcut(root.x, root.y) + 0.02 or n >= 150: continue
    n += 1
    front = max(0.0, -d.y)
    down = mathutils.Vector((0, 0, -1)); out = (root - C).normalized()
    flow = (down - out * down.dot(out)).normalized()
    flow = (flow * (1 - front) + SWEEP * front * 1.2).normalized()
    L = random.uniform(0.09, 0.12) * (1.2 if front > 0.4 else 1.0)
    pts = []; p = root.copy(); side = out.cross(flow).normalized(); ph = random.uniform(0, 6.28)
    for k in range(6):
        q = onshell(p, 1.07 + 0.02*math.sin(k*0.9)) + side * 0.007 * math.sin(ph + k*1.5)
        if q.z < zcut(q.x, q.y) - (0.01 if front < 0.4 else 0.0): break
        pts.append(q); p = p + flow * (L/5)
        out = (p - C).normalized(); flow = (flow - out * flow.dot(out)).normalized()
    if len(pts) < 3: continue
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts)-1); sp.use_endpoint_u = True; sp.order_u = 3
    r0 = random.uniform(0.016, 0.022)
    for k, q in enumerate(pts):
        sp.points[k].co = (q.x, q.y, q.z, 1); sp.points[k].radius = r0 * (0.75 + 0.35*math.sin(math.pi*min(1,k/(len(pts)-1)*1.3)) ) * (1 - 0.75*(k/(len(pts)-1))**2)
locks = link(bpy.data.objects.new('Locks', cu)); finish_locks = locks
print('LOCKS', n)
# Glasses: thick black round frames, a bridge and temples back to the ears.
LX = 0.034; LZ = EYE_Z; LY = FY - 0.016
def torus(name, loc, R1, r1):
    bm = bmesh.new()
    seg, ring = 40, 10
    verts = []
    for i in range(seg):
        a = 2*math.pi*i/seg; row = []
        for j in range(ring):
            b2 = 2*math.pi*j/ring
            rr = R1 + r1*math.cos(b2)
            row.append(bm.verts.new((loc[0] + rr*math.cos(a), loc[1] + r1*math.sin(b2)*0.9, loc[2] + rr*math.sin(a))))
        verts.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((verts[i][j], verts[(i+1)%seg][j], verts[(i+1)%seg][(j+1)%ring], verts[i][(j+1)%ring]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return finish(link(bpy.data.objects.new(name, me)), 'black')
torus('LensL', (LX, LY, LZ), 0.0235, 0.0042); torus('LensR', (-LX, LY, LZ), 0.0235, 0.0042)
def bar(name, a, b, r, mkey='black'):
    a = mathutils.Vector(a); b = mathutils.Vector(b); d = b - a
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=r, depth=d.length)
    q = d.to_track_quat('Z', 'Y')
    for v in bm.verts: v.co = q @ v.co + (a + b) / 2
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return finish(link(bpy.data.objects.new(name, me)), mkey)
bar('Bridge', (-0.012, LY - 0.002, LZ + 0.008), (0.012, LY - 0.002, LZ + 0.008), 0.0032)
for s in (1, -1):
    bar('Temple%d' % s, (s*(LX + 0.024), LY + 0.002, LZ + 0.006), (s*(HW + 0.004), 0.03, LZ + 0.004), 0.003)
# Face: eyes behind the lenses, brows, ears, a soft nose.
for s in (1, -1):
    ellipsoid('Eye%d' % s, (s*0.032, front_y(EYE_Z, s*0.032) + 0.002, EYE_Z - 0.002), (0.0085, 0.004, 0.0055), 'eye')
    bc = mathutils.Vector((s*0.033, front_y(EYE_Z + 0.031, s*0.033) - 0.001, EYE_Z + 0.031))
    br = ellipsoid('Brow%d' % s, tuple(bc), (0.016, 0.004, 0.0034), 'hair')
    rot = mathutils.Matrix.Rotation(s*math.radians(-8), 3, 'Y')
    for v in br.data.vertices: v.co = rot @ (v.co - bc) + bc
    ellipsoid('Ear%d' % s, (s*(HW + 0.004), 0.004, EYE_Z - 0.012), (0.009, 0.017, 0.027), 'skin')
NZ = EYE_Z - 0.038
ellipsoid('Nose', (0, front_y(NZ) - 0.003, NZ), (0.008, 0.009, 0.014), 'skin')
ellipsoid('Mouth', (0, front_y(EYE_Z - 0.075) + 0.001, EYE_Z - 0.075), (0.015, 0.003, 0.0025), 'eye')

locks.data.materials.append(M['hair']); parts.append(locks)
bmc = bmesh.new(); bmesh.ops.create_cone(bmc, cap_ends=False, segments=28, radius1=0.088, radius2=0.068, depth=0.055)
for v in bmc.verts: v.co = mathutils.Vector((v.co.x, v.co.y*1.1 + 0.012, v.co.z + 1.52))
mec = bpy.data.meshes.new('Collar'); bmc.to_mesh(mec); bmc.free()
collar = finish(link(bpy.data.objects.new('Collar', mec)), 'shirt'); collar.modifiers.new('sol','SOLIDIFY').thickness = 0.006
collar['bone'] = 'DEF-neck'
# Apply modifiers/transforms on parts, weight to the head bone, join into the body.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.select_set(False)
    if o.name.startswith('Locks') or o.name.startswith('HairCap'):
        dm = o.modifiers.new('dm', 'DECIMATE'); dm.ratio = 0.45
        bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.modifier_apply(modifier='dm'); o.select_set(False)
    vg = o.vertex_groups.new(name=o.get('bone', 'DEF-head')); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o in [body] + garments:
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    dm = o.modifiers.new('dm', 'DECIMATE'); dm.ratio = 0.45 if o is body else 0.6
    bpy.ops.object.modifier_move_to_index(modifier='dm', index=0); bpy.ops.object.modifier_apply(modifier='dm'); o.select_set(False)
for o in parts + garments: o.select_set(True)
body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'Amir'

KEEP = ['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land',
        'Spell_Simple_Enter','Spell_Simple_Idle_Loop','Spell_Simple_Shoot','Spell_Simple_Exit',
        'Idle_Talking_Loop','Dance_Loop','Sitting_Idle_Loop']
for a in list(bpy.data.actions):
    if a.name not in KEEP: bpy.data.actions.remove(a)
rig.data.pose_position = 'POSE'
for a in bpy.data.actions: a.use_fake_user = True
ad = rig.animation_data
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
ad.action = bpy.data.actions['Idle_Loop']
if bpy.data.actions['Idle_Loop'].slots: ad.action_slot = bpy.data.actions['Idle_Loop'].slots[0]
bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.glb', '.blend'))
print('POLYS', len(body.data.polygons), 'ACTIONS', len(bpy.data.actions))
