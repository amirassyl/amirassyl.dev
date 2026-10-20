# Rig a generated (image-to-3D) model of Amir on Quaternius' CC0 skeleton, keeping its 14 animations.
# Run inside Blender (e.g. through the Blender MCP) after importing:
#   - the generated model as object "Amir" (TRELLIS GLB, A-pose, facing -Y),
#   - Quaternius' Universal Animation Library GLB (armature "Rig" with its actions).
# Steps: scale the model to 1.80 m on the ground; fit a copy of the skeleton to Amir's joints
# (arms angled into his A-pose, fingers following each hand); bind with automatic weights;
# pose every bone back to the source skeleton's orientation and make that the rest pose, so the
# source animations (local rotations) play exactly as authored; export GLB.
import bpy, bmesh, os
from mathutils import Vector as V, Matrix

OUT = os.environ.get('AMIR_GLB', 'public/models/amir.glb')
HEIGHT = 1.80
KEEP = ['Idle_Relaxed', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
        'Spell_Simple_Enter', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Spell_Simple_Exit',
        'Dance_Loop', 'Sitting_Idle_Loop']
# Amir's joints in his A-pose (metres, left side; mirrored for the right), measured from the model.
JOINTS = dict(shoulder_in=(0.02, -0.04, 1.43), shoulder=(0.17, 0.0, 1.40), elbow=(0.255, 0.02, 1.13),
              wrist=(0.30, 0.0, 0.88), handtip=(0.32, 0.0, 0.76), hip=(0.09, 0.0, 0.92),
              knee=(0.10, -0.01, 0.50), ankle=(0.115, 0.02, 0.09), ball=(0.12, -0.09, 0.02), toe=(0.125, -0.17, 0.02))


def ui():
    win = bpy.context.window_manager.windows[0]
    area = next(a for a in win.screen.areas if a.type == 'VIEW_3D')
    return dict(window=win, area=area, region=next(r for r in area.regions if r.type == 'WINDOW'))


mesh, src = bpy.data.objects['Amir'], bpy.data.objects['Rig']
src.data.pose_position = 'REST'

# 1. Scale and place the model, weld split seams.
bpy.context.view_layer.update()
zs = [(mesh.matrix_world @ V(c)).z for c in mesh.bound_box]
s = HEIGHT / (max(zs) - min(zs))
mesh.scale = (s, s, s)
bpy.context.view_layer.update()
bb = [mesh.matrix_world @ V(c) for c in mesh.bound_box]
mesh.location -= V(((min(v.x for v in bb) + max(v.x for v in bb)) / 2, (min(v.y for v in bb) + max(v.y for v in bb)) / 2, min(v.z for v in bb)))
with bpy.context.temp_override(**ui(), active_object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh]):
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bm = bmesh.new(); bm.from_mesh(mesh.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0015)
bm.to_mesh(mesh.data); bm.free()

# 2. Fit a copy of the skeleton.
orig = {b.name: (b.head_local.copy(), b.tail_local.copy(), b.matrix_local.copy()) for b in src.data.bones}
rig = bpy.data.objects.new('AmirRig', src.data.copy()); bpy.context.scene.collection.objects.link(rig)
rig.data.pose_position = 'POSE'  # the copy inherits the source's REST display, which would make posing a no-op
spine_z = lambda z: 0.93 + (z - 0.917) * (1.47 - 0.93) / (1.488 - 0.917)
head, tail = {}, {}
for n in ['DEF-hips', 'DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003']:
    h, t, _ = orig[n]
    head[n], tail[n] = V((0, h.y * 0.6, spine_z(h.z))), V((0, t.y * 0.6, spine_z(t.z)))
head['DEF-neck'], tail['DEF-neck'] = V((0, 0, 1.47)), V((0, -0.005, 1.55))
head['DEF-head'], tail['DEF-head'] = V((0, -0.005, 1.55)), V((0, -0.008, 1.72))
for side, sfx in ((1, '.L'), (-1, '.R')):
    J = {k: V((x * side, y, z)) for k, (x, y, z) in JOINTS.items()}
    for bone, a, b in [('shoulder', 'shoulder_in', 'shoulder'), ('upper_arm', 'shoulder', 'elbow'), ('forearm', 'elbow', 'wrist'),
                       ('thigh', 'hip', 'knee'), ('shin', 'knee', 'ankle'), ('foot', 'ankle', 'ball'), ('toe', 'ball', 'toe')]:
        head['DEF-' + bone + sfx], tail['DEF-' + bone + sfx] = J[a], J[b]
    head['DEF-hand' + sfx], tail['DEF-hand' + sfx] = J['wrist'], J['wrist'] + (J['handtip'] - J['wrist']) * 0.35
rot = {}
bpy.context.view_layer.objects.active = rig
with bpy.context.temp_override(**ui(), active_object=rig, object=rig):
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for n in head:
        h, t, M = orig[n]
        R = (t - h).normalized().rotation_difference((tail[n] - head[n]).normalized()).to_matrix()
        rot[n] = R
        eb[n].use_connect = False
        eb[n].matrix = Matrix.Translation(head[n]) @ R.to_4x4() @ M.to_3x3().to_4x4()
        eb[n].length = (tail[n] - head[n]).length
    for sfx in ('.L', '.R'):
        hn = 'DEF-hand' + sfx; hh, _, _ = orig[hn]
        for n, (h, t, M) in orig.items():
            if n.endswith(sfx) and (n.startswith('DEF-f_') or n.startswith('DEF-thumb')):
                eb[n].use_connect = False
                eb[n].matrix = Matrix.Translation(head[hn] + rot[hn] @ ((h - hh) * 0.85)) @ rot[hn].to_4x4() @ M.to_3x3().to_4x4()
                eb[n].length = (t - h).length * 0.85
    bpy.ops.object.mode_set(mode='OBJECT')

# 3. Bind with automatic weights.
with bpy.context.temp_override(**ui(), active_object=rig, selected_objects=[mesh, rig], selected_editable_objects=[mesh, rig]):
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# 4. Pose back to the source orientations, bake into the mesh, make it the rest pose.
def walk(b):
    yield b
    for c in b.children:
        yield from walk(c)
for root in [pb for pb in rig.pose.bones if pb.parent is None]:
    for pb in walk(root):
        bpy.context.view_layer.update()
        pb.matrix = Matrix.Translation(pb.head.copy()) @ orig[pb.name][2].to_3x3().to_4x4()
bpy.context.view_layer.update()
mod = next(m for m in mesh.modifiers if m.type == 'ARMATURE')
with bpy.context.temp_override(**ui(), active_object=mesh, object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh]):
    bpy.ops.object.modifier_apply(modifier=mod.name)
with bpy.context.temp_override(**ui(), active_object=rig, object=rig, selected_objects=[rig], selected_editable_objects=[rig]):
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
mesh.modifiers.new('Armature', 'ARMATURE').object = rig

# 5. Export with the kept animations (JPEG textures: three.js's WebP check trips the site CSP).
for a in list(bpy.data.actions):
    if a.name not in KEEP:
        bpy.data.actions.remove(a)
rig.animation_data_create()
idle = bpy.data.actions['Idle_Relaxed']; rig.animation_data.action = idle; rig.animation_data.action_slot = idle.slots[0]
with bpy.context.temp_override(**ui(), active_object=rig, selected_objects=[rig, mesh]):
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animation_mode='ACTIONS',
                              export_force_sampling=True, export_frame_step=2, export_skins=True, export_morph=False,
                              export_image_format='JPEG', export_image_quality=88, export_cameras=False, export_lights=False)
print('exported', OUT)
