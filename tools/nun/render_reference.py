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
scene.cycles.use_denoising = False
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

# Preserve the original proportions, mask and winged cornette.
from math import atan2, exp, sin
from mathutils.noise import noise_vector

def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

for obj in [o for o in scene.objects if o.type == "MESH"]:
    mesh = obj.data
    colors = mesh.color_attributes.active_color
    if colors is None:
        raise RuntimeError("Original vertex colors are missing")
    positions = [obj.matrix_world @ v.co for v in mesh.vertices]
    samples = [p for p in positions if 0.89 < (p.z-lo.z)/height < 0.95]
    face_x = sum(p.x for p in samples) / max(1, len(samples))
    for i, item in enumerate(colors.data):
        index = mesh.loops[i].vertex_index if colors.domain == "CORNER" else i
        p = positions[index]
        x, y, z = (p.x-face_x)/height, (p.y-center.y)/height, (p.z-lo.z)/height
        r, g, b, alpha = item.color
        pigment = max(0, r - b)
        variation = noise_vector(Vector((x*41, y*41, z*41)))[0]
        cloth = 0.76 + variation * 0.13
        skirt = smooth(0.15, 0.22, z) * (1-smooth(0.62, 0.68, z))
        fold = sin(atan2(x, y) * 18 + z*7)
        cloth *= 1 - skirt * 0.16 * (0.5 + 0.5*fold)
        stain = smooth(0.035, 0.19, pigment) if z < 0.8 else 0
        orbital = exp(-((z-0.924)/0.015)**2) * exp(-((abs(x)-0.025)/0.025)**2)
        orbital *= 1 - smooth(-0.14, -0.035, y)
        cloth *= 1 - 0.37*orbital
        item.color = (
            r*cloth*(1-stain) + 0.18*stain,
            g*cloth*(1-stain) + 0.042*stain,
            b*cloth*(1-stain) + 0.035*stain,
            alpha,
        )
    for poly in mesh.polygons:
        poly.use_smooth = True


# Refine exposed facial planes, hands and the starched cornette.
# Coordinates are measured in world space so the original export axes are preserved.
for obj in [o for o in scene.objects if o.type == "MESH"]:
    inverse = obj.matrix_world.inverted()
    for vertex in obj.data.vertices:
        p = obj.matrix_world @ vertex.co
        z = (p.z - lo.z) / height
        x = (p.x - center.x) / height
        if z > 0.94 and abs(x) > 0.065:
            edge = smooth(0.065, 0.18, abs(x))
            p.z -= height * 0.009 * edge
        if 0.875 < z < 0.94 and p.y < center.y:
            cheek = exp(-((abs(x)-0.035)/0.018)**2) * exp(-((z-0.904)/0.019)**2)
            p.y += height * 0.003 * cheek
        vertex.co = inverse @ p

# Bake fabric ageing into portable UV textures, including tangent-space normals.
for obj in [o for o in scene.objects if o.type == "MESH"]:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.025)
    bpy.ops.object.mode_set(mode="OBJECT")
    mat = bpy.data.materials.new("Agnese_aged_ivory")
    mat.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    vertex_color = nodes.new("ShaderNodeVertexColor")
    vertex_color.layer_name = obj.data.color_attributes.active_color.name
    coords = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 95
    noise.inputs["Detail"].default_value = 3
    links.new(coords.outputs["Generated"], noise.inputs["Vector"])
    tint = nodes.new("ShaderNodeMixRGB")
    tint.blend_type = "MULTIPLY"
    tint.inputs[0].default_value = 1
    tint.inputs[2].default_value = (0.86, 0.79, 0.61, 1)
    links.new(vertex_color.outputs["Color"], tint.inputs[1])
    dirt = nodes.new("ShaderNodeMixRGB")
    dirt.blend_type = "MULTIPLY"
    dirt.inputs[0].default_value = 0.18
    links.new(tint.outputs[0], dirt.inputs[1])
    links.new(noise.outputs["Fac"], dirt.inputs[2])
    links.new(dirt.outputs[0], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.84
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.22
    bump.inputs["Distance"].default_value = 0.0007
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    baked = {}
    scene.cycles.samples = 8
    scene.render.bake.margin = 12
    for label in ["basecolor", "normal", "roughness"]:
        image = bpy.data.images.new("Agnese_" + label, width=1024, height=1024)
        if label != "basecolor":
            image.colorspace_settings.name = "Non-Color"
        target = nodes.new("ShaderNodeTexImage")
        target.image = image
        nodes.active = target
        if label == "normal":
            links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
            bpy.ops.object.bake(type="NORMAL")
        else:
            emit = nodes.new("ShaderNodeEmission")
            if label == "basecolor":
                links.new(dirt.outputs[0], emit.inputs["Color"])
            else:
                emit.inputs["Color"].default_value = (0.84, 0.84, 0.84, 1)
            links.new(emit.outputs[0], output.inputs["Surface"])
            bpy.ops.object.bake(type="EMIT")
            nodes.remove(emit)
        image.filepath_raw = str(out / ("Agnese_" + label + ".png"))
        image.file_format = "PNG"
        image.save()
        baked[label] = image
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    for label, socket in [("basecolor","Base Color"), ("roughness","Roughness")]:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = baked[label]
        links.new(tex.outputs["Color"], bsdf.inputs[socket])
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = baked["normal"]
    normal = nodes.new("ShaderNodeNormalMap")
    links.new(tex.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    # Colors are already baked, remove the source to avoid double multiplication in GLB.
    for attribute in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attribute)

# Export only character meshes, excluding studio cameras and lights.
bpy.ops.object.select_all(action="DESELECT")
for obj in scene.objects:
    if obj.type == "MESH":
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out / "suor-agnese-proposta.glb"),
                          export_format="GLB", use_selection=True)
for label, offset in [("proposta-front", (0,-3,0)), ("proposta-three-quarter", (2,-3,0))]:
    scene.camera.location = center + Vector(offset)
    aim(scene.camera, center)
    scene.render.filepath = str(out / (label + ".png"))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "suor-agnese-proposta.blend"))

camera.ortho_scale = height * 0.29
target = Vector((center.x, center.y, lo.z + height * 0.89))
scene.camera.location = target + Vector((0,-3,0))
aim(scene.camera, target)
scene.render.filepath = str(out / "proposta-viso.png")
bpy.ops.render.render(write_still=True)
camera.ortho_scale = height * 0.57
target = Vector((center.x, center.y, lo.z + height * 0.43))
scene.camera.location = target + Vector((0,-3,0))
aim(scene.camera, target)
scene.render.filepath = str(out / "proposta-mani.png")
bpy.ops.render.render(write_still=True)
