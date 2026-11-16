import bpy
from pathlib import Path
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="assets/models/c_nurse.glb")
scene = bpy.context.scene
points = [obj.matrix_world @ Vector(corner)
          for obj in scene.objects if obj.type == "MESH"
          for corner in obj.bound_box]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (lo + hi) / 2
height = hi.z - lo.z

def aim(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()

scene.world = bpy.data.worlds.new("Studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.2, 0.23, 0.29, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

for name, offset, energy, color in [
    ("Key", (1.0, -2.0, 1.3), 420, (0.83, 0.91, 1.0)),
    ("Fill", (-1.3, -1.2, 0.6), 170, (1.0, 0.84, 0.71)),
    ("Rim", (0.4, 1.8, 1.2), 500, (0.64, 0.77, 1.0)),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.size = energy, color, 1.4
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = center + Vector(offset)
    aim(obj, center)

camera = bpy.data.cameras.new("Reference")
scene.camera = bpy.data.objects.new("Reference", camera)
scene.collection.objects.link(scene.camera)
camera.type = "ORTHO"
camera.ortho_scale = height * 1.28
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 720, 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
out = Path("nun-reference").resolve()
out.mkdir(exist_ok=True)
for name, offset in [("front", (0, -3, 0)), ("three-quarter", (2, -3, 0)), ("back", (0, 3, 0))]:
    scene.camera.location = center + Vector(offset)
    aim(scene.camera, center)
    scene.render.filepath = str(out / (name + ".png"))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "original-reference.blend"))
