import bpy, sys
bpy.ops.wm.open_mainfile(filepath='/Users/amir/.claude/jobs/0753da4a/tmp/bl/amir.blend')
rig = bpy.data.objects['Rig']; ad = rig.animation_data; a = bpy.data.actions['Idle_Loop']; ad.action = a; ad.action_slot = a.slots[0]
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in ('MESH', 'ARMATURE'): o.select_set(True)
for draco, out in [(False, 'amir_raw.glb'), (True, 'amir.glb')]:
    bpy.ops.export_scene.gltf(filepath='/Users/amir/.claude/jobs/0753da4a/tmp/bl/' + out, export_format='GLB', use_selection=True,
        export_animation_mode='ACTIONS', export_anim_single_armature=True, export_force_sampling=True, export_frame_step=2,
        export_apply=False, export_skins=True, export_morph=False, export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=7, export_yup=True, export_texcoords=False, export_cameras=False, export_lights=False)
