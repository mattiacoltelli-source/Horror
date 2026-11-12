import bpy
bpy.ops.wm.open_mainfile(filepath='./stage4.blend')
arm = bpy.data.objects['Armature']; arm.animation_data.action = bpy.data.actions['Idle']
# materiale pelle: roughness/metallic costanti, emissione moderata
for m in bpy.data.materials:
    if m.name == 'skin_game': m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 1.0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath='./sorella.glb', export_format='GLB', use_selection=True, export_apply=False, export_animations=True, export_animation_mode='ACTIONS', export_skins=True, export_image_format='JPEG', export_jpeg_quality=86, export_yup=True, export_lights=False, export_cameras=False, export_extras=False, export_force_sampling=True, export_optimize_animation_size=True)
print('exported')
