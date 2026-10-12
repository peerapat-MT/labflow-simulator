"""Create LabFlow's original, editable Blender laboratory and human assets.

Run with Blender 4.5 LTS:
  blender --background --python scripts/create_lab_assets.py
All scene helper coordinates are Three.js metres (X right, Y up, Z forward).
No third-party meshes or textures are used.
"""
import bpy
import math
import json
import sys
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets-source"
OUT = ROOT / "dist" / "assets" / "models"
SOURCE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)


def xyz(v):
    return Vector((v[0], -v[2], v[1]))


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.materials):
        bpy.data.materials.remove(data)


def mat(name, color, metal=0, rough=.5, emission=None):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emission:
        p.inputs["Emission Color"].default_value = (*color, 1)
        p.inputs["Emission Strength"].default_value = emission
    return m


def finish(obj, name, material, parent=None, smooth=False):
    obj.name = name
    obj.data.materials.append(material)
    if parent:
        world = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = world
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def box(name, pos, size, material, bevel=.025, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(pos))
    o = bpy.context.object
    o.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(o, name, material, parent)
    if bevel:
        mod = o.modifiers.new("Manufactured edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        normal = o.modifiers.new("Weighted product normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
    return o


def sphere(name, pos, scale, material, parent=None, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=10, location=xyz(pos))
    o = bpy.context.object
    o.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, material, parent, True)


def cylinder(name, pos, radius, height, material, parent=None, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height, location=xyz(pos))
    o = finish(bpy.context.object, name, material, parent)
    bevel = o.modifiers.new("Edge glints", "BEVEL")
    bevel.width = min(.012, height / 8, radius / 8)
    bevel.segments = 2
    normal = o.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    return o


def rod(name, start, end, radius, material, parent=None, vertices=12):
    a, b = xyz(start), xyz(end)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(b - a).length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    return finish(o, name, material, parent, True)


def empty(name, pos):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = xyz(pos)
    # Data-API transforms are deferred. Make world matrices reliable for parenting.
    bpy.context.view_layer.update()
    return obj


def palette():
    return {
        "Floor": mat("Floor | mineral porcelain", (.69, .77, .82), 0, .68),
        "Grout": mat("Tile joints", (.40, .51, .59), 0, .85),
        "White": mat("Cabinet | warm ceramic enamel", (.83, .88, .90), .08, .34),
        "Top": mat("Worktop | solid surface", (.66, .76, .79), .12, .26),
        "Blue": mat("Clinical blue", (.025, .26, .58), .22, .32),
        "Cyan": mat("Cyan equipment trim", (.03, .58, .80), .3, .27),
        "Dark": mat("Instrument dark polymer", (.022, .060, .095), .08, .40),
        "Metal": mat("Brushed stainless steel", (.52, .61, .66), .82, .31),
        "Glass": mat("Frosted blue privacy panel", (.35, .66, .77), .12, .24),
        "Screen": mat("Instrument display glass", (.006, .035, .065), .23, .18),
        "Light": mat("Display cyan illumination", (.08, .68, .95), .05, .3, .65),
        "Status": mat("Status green illumination", (.11, .8, .43), 0, .4, .5),
        "Red": mat("Biohazard and blood tube red", (.72, .075, .11), .05, .48),
        "Purple": mat("EDTA lavender caps", (.42, .23, .67), .04, .38),
        "Yellow": mat("Serum gold caps", (.93, .64, .11), .04, .40),
        "Plant": mat("Plant leaves", (.07, .27, .19), 0, .75),
        "Paper": mat("Paper and labels", (.92, .95, .96), 0, .95),
    }


def monitor(x, y, z, p, width=.55, name="Monitor"):
    box(name + " weighted base", (x, y + .035, z), (.31, .07, .22), p["Metal"], .02)
    box(name + " support", (x, y + .20, z - .015), (.065, .36, .07), p["Metal"], .012)
    box(name + " display case", (x, y + .46, z), (width, .37, .065), p["Dark"], .023)
    box(name + " LCD", (x, y + .47, z + .037), (width - .05, .30, .006), p["Screen"], .005)
    box(name + " header", (x, y + .58, z + .042), (width - .08, .025, .005), p["Light"], .001)
    for k in range(4):
        w = width * (.48 + (k % 2) * .2)
        box(name + " result line", (x - .04, y + .52 - k * .042, z + .043), (w, .012, .006), p["Glass"], 0)
    box(name + " result flag", (x + width * .34, y + .43, z + .044), (.036, .105, .006), p["Status"], .004)


def keyboard(x, y, z, p):
    box("Keyboard body", (x, y, z), (.43, .027, .17), p["Dark"], .016)
    for row in range(3):
        box("Keyboard key row", (x, y + .017, z - .043 + row * .037), (.36, .007, .020), p["Metal"], .002)
    sphere("Mouse", (x + .32, y + .008, z), (.050, .023, .071), p["Dark"])


def cabinetry(x, z, width, p, name="Bench", depth=1.05, drawers=4):
    box(name + " toe kick", (x, .12, z), (width - .08, .20, depth - .12), p["Dark"], .018)
    box(name + " case", (x, .49, z), (width, .69, depth), p["White"], .035)
    box(name + " counter", (x, .87, z), (width + .09, .09, depth + .09), p["Top"], .03)
    for i in range(drawers):
        px = x - width / 2 + (i + .5) * width / drawers
        box(name + " drawer front", (px, .60, z + depth / 2 + .01), (width / drawers - .035, .35, .035), p["White"], .015)
        box(name + " lower drawer", (px, .29, z + depth / 2 + .01), (width / drawers - .035, .24, .035), p["White"], .012)
        rod(name + " pull", (px - .13, .65, z + depth / 2 + .055), (px + .13, .65, z + depth / 2 + .055), .014, p["Metal"])
        rod(name + " lower pull", (px - .13, .32, z + depth / 2 + .055), (px + .13, .32, z + depth / 2 + .055), .014, p["Metal"])


def desk(x, z, p, width=1.9):
    box("Desk surface", (x, .77, z), (width, .065, .80), p["White"], .038)
    for dx in [-width / 2 + .12, width / 2 - .12]:
        box("Desk metal leg", (x + dx, .385, z), (.055, .73, .59), p["Metal"], .012)
    box("Desk modesty panel", (x, .47, z - .29), (width - .23, .40, .035), p["Glass"], .013)
    monitor(x - .18, .82, z - .1, p)
    keyboard(x - .15, .82, z + .21, p)


def stool(x, z, p, blue=True):
    cylinder("Stool seat", (x, .52, z), .24, .10, p["Blue"] if blue else p["Dark"])
    cylinder("Stool gas lift", (x, .27, z), .033, .43, p["Metal"])
    for i in range(5):
        a = i * 2 * math.pi / 5
        xx, zz = x + math.cos(a) * .29, z + math.sin(a) * .29
        rod("Stool star base", (x, .10, z), (xx, .06, zz), .018, p["Metal"])
        sphere("Stool caster", (xx, .04, zz), (.040, .043, .032), p["Dark"], segments=12)


def rack(x, y, z, p, cols=5, cap="Purple"):
    box("Specimen rack base", (x, y + .025, z), (cols * .065 + .05, .045, .18), p["Cyan"], .012)
    box("Specimen rack top", (x, y + .11, z), (cols * .065 + .05, .025, .18), p["White"], .008)
    for row in [-.042, .042]:
        for i in range(cols):
            xx = x - (cols - 1) * .0325 + i * .065
            cylinder("Specimen tube", (xx, y + .13, z + row), .021, .16, p["Glass"], vertices=12)
            cylinder("Specimen cap", (xx, y + .22, z + row), .024, .036, p[cap], vertices=12)
            box("Tube barcode label", (xx, y + .14, z + row + .02), (.027, .068, .005), p["Paper"], .002)


def vent(x, y, z, p, rows=5, width=.3):
    for i in range(rows):
        box("Instrument ventilation slot", (x, y + i * .041, z), (width, .018, .009), p["Dark"], .004)


def display(x, y, z, p, w=.42, h=.26):
    box("Touch panel surround", (x, y, z), (w + .045, h + .045, .035), p["Dark"], .016)
    box("Touch panel glass", (x, y, z + .021), (w, h, .008), p["Screen"], .005)
    box("Touch panel title", (x, y + h * .32, z + .027), (w * .86, .026, .005), p["Light"], .001)
    for i in range(3):
        box("Touch panel line", (x - w * .08, y + h * .10 - .044 * i, z + .027), (w * .63, .013, .005), p["Glass"], .001)
    cylinder("Illuminated instrument button", (x + w * .75, y - h * .35, z + .01), .025, .024, p["Status"], vertices=12)


def centrifuge(x, y, z, p):
    box("Centrifuge motor base", (x, y + .26, z), (1.04, .52, .91), p["White"], .11)
    box("Centrifuge blue lower band", (x, y + .07, z), (1.04, .11, .91), p["Blue"], .045)
    cylinder("Centrifuge safety lid", (x, y + .55, z - .02), .43, .075, p["Metal"], vertices=48)
    cylinder("Centrifuge observation window", (x, y + .594, z - .02), .26, .014, p["Glass"], vertices=40)
    cylinder("Centrifuge rotor boss", (x, y + .605, z - .02), .065, .012, p["Dark"])
    box("Centrifuge lid latch", (x, y + .53, z + .40), (.16, .08, .075), p["Dark"], .017)
    display(x, y + .30, z + .465, p, .32, .20)
    vent(x - .32, y + .10, z + .469, p, rows=3, width=.15)


def microscope(x, y, z, p):
    box("Microscope weighted base", (x, y + .045, z), (.42, .09, .50), p["White"], .055)
    box("Microscope arm lower", (x, y + .23, z - .16), (.09, .34, .10), p["White"], .035)
    rod("Microscope inclined arm", (x, y + .23, z - .16), (x, y + .57, z - .10), .065, p["White"])
    box("Microscope stage", (x, y + .31, z + .015), (.34, .045, .27), p["Dark"], .018)
    box("Glass slide", (x, y + .339, z + .035), (.18, .008, .065), p["Glass"], .001)
    cylinder("Microscope condenser", (x, y + .24, z + .025), .063, .085, p["Metal"])
    cylinder("Microscope objective turret", (x, y + .49, z + .045), .095, .045, p["Dark"])
    for dx in [-.05, .05]:
        rod("Microscope objective", (x + dx, y + .48, z + .075), (x + dx, y + .385, z + .075), .021, p["Metal"])
        rod("Microscope binocular tube", (x + dx, y + .57, z - .02), (x + dx, y + .71, z + .10), .033, p["Dark"])
    sphere("Microscope focusing dial", (x + .13, y + .28, z - .13), (.045, .063, .063), p["Dark"])


def phlebotomy_chair(x, z, p):
    box("Phlebotomy chair plinth", (x, .10, z), (.68, .14, .75), p["Metal"], .05)
    cylinder("Chair hydraulic lift", (x, .33, z), .09, .44, p["Metal"])
    box("Phlebotomy chair seat", (x, .58, z), (.62, .15, .59), p["Blue"], .08)
    back = box("Phlebotomy chair contoured back", (x, .97, z - .26), (.62, .72, .16), p["Blue"], .065)
    back.rotation_euler.x = -.10
    box("Phlebotomy headrest", (x, 1.40, z - .31), (.37, .22, .15), p["Blue"], .07)
    for dx in [-.44, .44]:
        rod("Chair arm support", (x + dx, .52, z), (x + dx, .85, z), .026, p["Metal"])
        box("Patient arm cushion", (x + dx, .86, z + .07), (.22, .08, .62), p["Blue"], .037)
    rod("Chair footrest support", (x, .43, z + .2), (x, .27, z + .58), .035, p["Metal"])
    box("Chair footrest", (x, .27, z + .63), (.54, .06, .25), p["Dark"], .025)


def plant(x, z, p):
    cylinder("Plant ceramic pot", (x, .21, z), .18, .4, p["White"])
    for i in range(7):
        a = i * 2.399
        end = (x + math.cos(a) * .18, .66 + (i % 3) * .10, z + math.sin(a) * .18)
        rod("Plant stem", (x, .35, z), end, .009, p["Plant"], vertices=8)
        leaf = sphere("Plant leaf", end, (.10, .18, .035), p["Plant"], segments=12)
        leaf.rotation_euler.z = a


def environment():
    reset()
    p = palette()
    box("Foundation cutaway slab", (0, -.18, 0), (25.2, .34, 16.0), p["White"], .16)
    box("Clinical porcelain floor", (0, .005, 0), (25, .05, 15.8), p["Floor"], .06)
    for x in range(-12, 13, 2):
        box("Floor tile joint", (x, .032, 0), (.012, .004, 15.8), p["Grout"], 0)
    for z in range(-7, 8, 2):
        box("Floor tile joint", (0, .032, z), (25, .004, .012), p["Grout"], 0)
    # Circulation lane stays visibly open for root's moving entities.
    box("Central circulation lane", (0, .037, .55), (24.5, .006, 1.42), p["White"], 0)
    for z in [-.19, 1.29]:
        box("Circulation lane blue edge", (0, .043, z), (24.5, .008, .035), p["Cyan"], 0)
    # Rear partitions are open above counter height; no roof or front wall.
    box("Rear service wall", (0, .62, -7.7), (25.0, 1.24, .15), p["White"], .035)
    box("Rear service wall cyan reveal", (0, 1.16, -7.61), (24.8, .09, .02), p["Cyan"], .004)
    for x in [-12.45, 12.45]:
        box("Cutaway side wall", (x, .35, -.8), (.12, .70, 13.9), p["White"], .02)
    for x in [-6.0, -.65, 4.9]:
        box("Department low separation", (x, .44, -4.25), (.10, .87, 5.35), p["White"], .018)
        box("Department frosted screen", (x, 1.10, -5.7), (.048, .63, 2.25), p["Glass"], .014)
        box("Privacy screen top rail", (x, 1.43, -5.7), (.07, .035, 2.28), p["Metal"], .01)
    # Registration zone.
    desk(-9.6, 5.7, p, 2.25)
    desk(-7.2, 5.7, p, 1.8)
    for x in [-9.6, -7.2]:
        stool(x, 6.5, p)
    box("Registration reception fascia", (-9.4, .59, 5.28), (4.35, 1.18, .08), p["White"], .04)
    box("Reception desk blue accent", (-9.4, .80, 5.225), (4.16, .10, .03), p["Blue"], .008)
    box("Registration scanner", (-8.6, .87, 5.6), (.18, .17, .20), p["Dark"], .025)
    for x in [-10.5, -9.65, -8.8]:
        box("Waiting seat", (x, .47, 3.25), (.68, .11, .57), p["Blue"], .06)
        box("Waiting back", (x, .80, 3.04), (.68, .58, .09), p["Blue"], .05)
        for dx in [-.25, .25]:
            rod("Waiting chair leg", (x + dx, .04, 3.1), (x + dx, .43, 3.1), .027, p["Metal"])
            rod("Waiting chair front leg", (x + dx, .04, 3.48), (x + dx, .43, 3.48), .027, p["Metal"])
    plant(-11.8, 6.8, p)
    # Three blood collection chairs and a shared supply counter.
    for x in [-5.6, -3.6, -1.6]:
        phlebotomy_chair(x, 4.6, p)
        stool(x + .74, 4.6, p, False)
        box("Collection trolley", (x + .82, .68, 5.7), (.51, .055, .55), p["Metal"], .025)
        for dx in [-.19, .19]:
            rod("Collection trolley leg", (x + .82 + dx, .05, 5.7), (x + .82 + dx, .67, 5.7), .021, p["Metal"])
        box("Sharps container", (x + .82, .81, 5.66), (.18, .22, .17), p["Yellow"], .025)
        box("Sharps lid", (x + .82, .93, 5.66), (.20, .03, .19), p["Red"], .012)
        rack(x + .82, .72, 5.86, p, 3)
    cabinetry(-3.65, 7.0, 4.2, p, "Blood collection supply counter", depth=.60)
    box("Hand wash sink inset", (-5.0, .92, 6.99), (.61, .022, .40), p["Metal"], .07)
    box("Hand wash sink basin", (-5.0, .935, 6.99), (.43, .009, .26), p["Dark"], .06)
    rod("Sink faucet vertical", (-5.0, .93, 6.77), (-5.0, 1.19, 6.77), .025, p["Metal"])
    rod("Sink faucet neck", (-5.0, 1.19, 6.77), (-5.0, 1.19, 6.98), .025, p["Metal"])
    # Pneumatic tube terminals; moving elevated conduit belongs to runtime.
    for x, z, facing in [(.3, 5.8, 1), (5.9, 5.85, 1)]:
        box("Pneumatic tube terminal pedestal", (x, .43, z), (.70, .83, .67), p["White"], .06)
        box("Pneumatic tube terminal enclosure", (x, 1.13, z), (.66, .60, .58), p["Blue"], .065)
        cylinder("Pneumatic carrier socket", (x, 1.47, z), .16, .10, p["Metal"], vertices=32)
        cylinder("Pneumatic connector stub", (x, 1.79, z), .11, .59, p["Metal"], vertices=32)
        box("Tube terminal front panel", (x, 1.20, z + .305), (.44, .28, .022), p["Screen"], .025)
        box("Tube terminal indicator", (x, 1.29, z + .32), (.34, .025, .009), p["Light"], .005)
        for dx in [-.11, 0, .11]:
            box("Tube terminal key", (x + dx, 1.12, z + .32), (.064, .05, .012), p["White"], .007)
        box("Tube dispatch tray", (x, .97, z + .54), (.72, .065, .51), p["Metal"], .025)
    # Specimen accession/reception desk with racks and scanner.
    cabinetry(5.9, 3.8, 3.7, p, "Accession and specimen sorting")
    monitor(6.95, .94, 3.65, p, .56, "LIS accession workstation")
    keyboard(6.95, .95, 4.02, p)
    rack(4.9, .93, 3.81, p, 6)
    rack(5.5, .93, 3.81, p, 6, "Yellow")
    box("Accession barcode printer", (5.93, 1.08, 3.64), (.37, .27, .33), p["White"], .033)
    box("Barcode printer output slot", (5.93, 1.05, 3.813), (.26, .037, .01), p["Dark"], .003)
    box("Barcode printed label", (5.93, 1.01, 3.88), (.19, .012, .13), p["Paper"], .001)
    stool(7.17, 4.7, p)
    # Preanalytic room with paired centrifuges, tube racks, fridge and pipette stand.
    cabinetry(-8.9, -4.7, 4.1, p, "Preanalytics rear bench")
    centrifuge(-9.85, .94, -4.7, p)
    centrifuge(-8.3, .94, -4.7, p)
    cabinetry(-8.5, -2.5, 3.6, p, "Aliquot and sample preparation island", depth=.86)
    rack(-9.4, .93, -2.51, p, 5, "Yellow")
    rack(-8.9, .93, -2.51, p, 5)
    box("Aliquot pipette stand", (-7.7, 1.13, -2.60), (.39, .37, .16), p["Cyan"], .018)
    for dx in [-.12, 0, .12]:
        rod("Micropipette barrel", (-7.7 + dx, 1.41, -2.48), (-7.7 + dx, 1.01, -2.48), .021, p["White"])
        rod("Micropipette tip", (-7.7 + dx, 1.01, -2.48), (-7.7 + dx, .95, -2.48), .009, p["Cyan"], vertices=8)
    box("Specimen refrigerator", (-11.2, .94, -6.50), (.97, 1.85, .83), p["White"], .06)
    box("Specimen refrigerator door", (-11.2, 1.03, -6.066), (.85, 1.55, .055), p["Glass"], .028)
    rod("Refrigerator handle", (-10.86, .71, -6.01), (-10.86, 1.25, -6.01), .022, p["Metal"])
    display(-11.2, 1.79, -6.06, p, .28, .14)
    # Hematology analyzer, recognizable aspiration bay, rack loader and vents.
    cabinetry(-3.23, -4.5, 3.35, p, "Hematology bench")
    box("Hematology analyzer main case", (-3.85, 1.52, -4.51), (1.35, 1.18, 1.03), p["White"], .09)
    box("Hematology analyzer blue side", (-4.54, 1.52, -4.51), (.08, 1.09, .98), p["Blue"], .025)
    display(-3.93, 1.78, -3.972, p, .49, .31)
    box("Hematology aspiration bay", (-3.89, 1.18, -3.955), (.45, .31, .036), p["Dark"], .026)
    rod("CBC aspiration probe", (-3.89, 1.33, -3.90), (-3.89, 1.12, -3.90), .009, p["Metal"])
    vent(-3.42, 1.15, -3.965, p, 6, .21)
    box("CBC rack loader", (-2.54, 1.04, -4.34), (1.12, .18, .74), p["Dark"], .035)
    for i in range(4):
        box("CBC loader rack rail", (-2.85 + .21 * i, 1.15, -4.33), (.016, .06, .61), p["Metal"], .004)
    rack(-2.52, 1.14, -4.3, p, 4)
    desk(-3.0, -6.85, p, 1.9)
    stool(-3.0, -6.0, p)
    # Chemistry analyzer: large automated rotor enclosure and frontal loader.
    box("Chemistry analyzer floor base", (2.1, .18, -4.38), (3.7, .3, 1.56), p["Dark"], .065)
    box("Chemistry analyzer lower cabinet", (2.1, .69, -4.38), (3.73, .92, 1.54), p["White"], .055)
    for x in [.8, 1.65, 2.5, 3.35]:
        box("Chemistry service door", (x, .63, -3.585), (.78, .74, .045), p["White"], .018)
        rod("Chemistry service door pull", (x - .19, .91, -3.548), (x + .19, .91, -3.548), .013, p["Metal"])
    box("Chemistry blue hood frame", (1.66, 1.37, -4.47), (2.86, .47, 1.35), p["Blue"], .09)
    box("Chemistry reaction chamber cover", (1.66, 1.625, -4.46), (2.72, .095, 1.22), p["Glass"], .055)
    for x in [.97, 2.21]:
        cylinder("Chemistry reaction rotor window", (x, 1.68, -4.48), .47, .020, p["Dark"], vertices=40)
        cylinder("Chemistry rotor concentric ring", (x, 1.694, -4.48), .34, .012, p["Metal"], vertices=40)
        cylinder("Chemistry rotor hub", (x, 1.704, -4.48), .18, .016, p["Blue"], vertices=24)
    box("Chemistry sample loading deck", (1.67, 1.18, -3.47), (2.76, .17, .43), p["Metal"], .025)
    for x in [.8, 1.4, 2.0]:
        rack(x, 1.28, -3.49, p, 4, "Yellow")
    monitor(3.71, 1.19, -4.4, p, .69, "Chemistry analyzer console")
    vent(3.65, .34, -3.582, p, 6, .36)
    # Compact immunochemistry instrument beside main chemistry analyzer.
    cabinetry(2.0, -6.82, 3.2, p, "Immunochemistry bench", depth=.76)
    box("Immunochemistry analyzer", (1.24, 1.26, -6.81), (1.36, .68, .73), p["White"], .065)
    box("Immunochemistry optical cover", (.9, 1.63, -6.82), (.58, .065, .60), p["Blue"], .035)
    display(1.48, 1.40, -6.425, p, .40, .25)
    rack(2.40, .92, -6.8, p, 4, "Yellow")
    # Urine microscopy station and compact strip reader.
    cabinetry(8.05, -4.52, 4.6, p, "Urinalysis and microscopy bench")
    microscope(6.4, .93, -4.4, p)
    microscope(7.3, .93, -4.4, p)
    box("Urine strip analyzer", (8.65, 1.17, -4.48), (1.06, .49, .72), p["White"], .075)
    display(8.79, 1.30, -4.104, p, .41, .25)
    box("Urine strip sample tray", (8.36, 1.04, -3.975), (.34, .035, .28), p["Dark"], .012)
    box("Urine specimen tray", (9.75, .967, -4.45), (.44, .05, .37), p["Cyan"], .014)
    for dx in [-.10, .10]:
        for dz in [-.075, .075]:
            cylinder("Urine specimen container", (9.75 + dx, 1.065, -4.45 + dz), .056, .16, p["Glass"], vertices=16)
            cylinder("Urine specimen screw cap", (9.75 + dx, 1.155, -4.45 + dz), .06, .038, p["Yellow"], vertices=16)
    stool(7.3, -3.2, p)
    desk(8.1, -6.84, p, 2.1)
    stool(8.1, -5.96, p)
    # Approval/HIS workstation placed close to the right-hand reception zone.
    desk(10.4, 2.3, p, 2.55)
    monitor(11.12, .82, 2.20, p, .55, "HIS review display")
    stool(10.35, 3.14, p)
    box("Interface server cabinet", (11.83, .57, .15), (.7, 1.12, .73), p["Dark"], .05)
    for j in range(5):
        box("Interface server drawer", (11.83, .22 + j * .17, .532), (.55, .13, .022), p["Metal"], .008)
        box("Server activity diode", (11.64, .22 + j * .17, .548), (.04, .021, .006), p["Status"], .002)
    plant(11.8, 6.65, p)
    # Practical room details: wall clock, PPE dispensers, storage.
    for x in [-7.8, -2.6, 2.6, 8.1]:
        box("Wall storage cabinet", (x, 1.56, -7.47), (1.46, .68, .32), p["White"], .035)
        for dx in [-.37, .37]:
            box("Wall cabinet door", (x + dx, 1.56, -7.285), (.70, .61, .032), p["White"], .018)
            rod("Wall cabinet handle", (x + dx + (.20 if dx < 0 else -.20), 1.46, -7.255), (x + dx + (.20 if dx < 0 else -.20), 1.65, -7.255), .012, p["Metal"])
    for x, z in [(-6.4, 6.8), (4.1, 6.2)]:
        box("Clinical waste bin", (x, .31, z), (.41, .58, .37), p["White"], .052)
        box("Clinical waste lid", (x, .63, z), (.45, .065, .41), p["Red"], .026)
        box("Waste pedal", (x, .07, z + .235), (.18, .045, .14), p["Metal"], .014)
    return p


def apply_modifiers():
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = o
        for modifier in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)


def merge_materials(preserve_parents=False):
    groups = {}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH":
            key = (o.parent.name if o.parent and preserve_parents else "", o.data.materials[0].name)
            groups.setdefault(key, []).append(o)
    for (parent_name, name), objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = (parent_name + "_" if parent_name else "Lab_") + name.split(" | ")[0].replace(" ", "_")


def stats():
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    triangles = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        triangles += len(o.data.loop_triangles)
    return {"mesh_nodes": len(meshes), "triangles": triangles,
            "materials": sorted({m.name for o in meshes for m in o.data.materials}),
            "nodes": [o.name for o in bpy.context.scene.objects]}


def export_glb(path):
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True,
                              export_apply=True, export_cameras=False, export_lights=False,
                              export_animations=False, export_materials="EXPORT")


def person():
    reset()
    skin = mat("Skin", (.62, .35, .22), 0, .65)
    scrubs = mat("Scrubs", (.035, .47, .71), 0, .72)
    trousers = mat("Trousers", (.06, .15, .23), 0, .79)
    hair = mat("Hair", (.036, .024, .021), 0, .83)
    shoe = mat("Shoe", (.03, .04, .047), 0, .65)
    white = mat("Badge and eyes", (.92, .95, .95), 0, .55)
    pupil = mat("Eye pupil", (.011, .018, .022), 0, .4)
    # Human in relaxed neutral pose, origin at ground; arms pivot at shoulders.
    box("Scrub torso", (0, 1.15, 0), (.43, .46, .245), scrubs, .075)
    sphere("Shoulder contour", (0, 1.33, -.004), (.24, .10, .135), scrubs)
    box("Scrub V neck", (0, 1.35, .135), (.105, .080, .010), skin, .025)
    box("Scrub chest pocket", (-.115, 1.205, .129), (.10, .12, .014), scrubs, .013)
    box("ID badge", (.125, 1.235, .137), (.065, .09, .012), white, .009)
    box("ID badge blue rule", (.125, 1.255, .145), (.044, .015, .006), scrubs, .001)
    cylinder("Neck", (0, 1.422, 0), .064, .14, skin, vertices=20)
    sphere("Head", (0, 1.558, .003), (.108, .144, .102), skin, segments=24)
    sphere("Hair cap", (0, 1.638, -.018), (.113, .079, .100), hair, segments=24)
    sphere("Back hair", (0, 1.568, -.080), (.097, .10, .04), hair)
    sphere("Nose", (0, 1.555, .107), (.026, .032, .026), skin)
    for side in [-1, 1]:
        sphere("Ear", (side * .108, 1.558, .002), (.024, .036, .016), skin)
        sphere("Eye white", (side * .039, 1.594, .091), (.020, .011, .009), white)
        sphere("Eye iris", (side * .039, 1.594, .100), (.008, .008, .004), pupil, segments=12)
        box("Eyebrow", (side * .039, 1.617, .094), (.036, .009, .008), hair, .004)
    box("Mouth", (0, 1.510, .091), (.044, .007, .006), hair, .002)
    box("Trouser waist", (0, .895, -.005), (.37, .13, .23), trousers, .048)
    for side, word in [(-1, "left"), (1, "right")]:
        arm = empty(word + "Arm", (side * .235, 1.32, 0))
        sphere(word + " scrub sleeve", (side * .253, 1.236, .005), (.090, .135, .095), scrubs, arm)
        rod(word + " forearm", (side * .271, 1.15, .014), (side * .289, .97, .06), .056, skin, arm, 16)
        sphere(word + " elbow", (side * .275, 1.105, .026), (.060, .071, .061), skin, arm)
        sphere(word + " hand", (side * .29, .925, .071), (.052, .080, .033), skin, arm)
        sphere(word + " thumb", (side * .252, .936, .082), (.018, .036, .018), skin, arm, 12)
        leg = empty(word + "Leg", (side * .100, .9, -.003))
        box(word + " trouser thigh", (side * .103, .702, -.005), (.162, .405, .205), trousers, .059, leg)
        sphere(word + " knee volume", (side * .103, .475, .012), (.083, .115, .094), trousers, leg)
        knee = empty(word + "Knee", (side * .103, .475, -.005))
        knee.parent = leg
        knee.matrix_parent_inverse.identity()
        knee.location = xyz((side * .003, -.425, -.002))
        bpy.context.view_layer.update()
        box(word + " trouser shin", (side * .103, .292, -.005), (.149, .365, .185), trousers, .052, knee)
        box(word + " shoe", (side * .105, .077, .047), (.172, .143, .291), shoe, .055, knee)
        box(word + " shoe sole", (side * .105, .023, .050), (.174, .035, .294), pupil, .016, knee)
    return


def render_preview(path, person_view=False):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 700 if person_view else 1400
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.world.color = (.18, .22, .28)
    world = scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (.39, .48, .61, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = .6
    bpy.ops.object.light_add(type="AREA", location=xyz((-6, 16, 6)))
    light = bpy.context.object
    light.data.energy = 2600
    light.data.shape = "DISK"
    light.data.size = 14
    direction = xyz((0, 0, 0)) - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=xyz((10, 9, -6)))
    fill = bpy.context.object
    fill.data.energy = 1900
    fill.data.size = 10
    fill.rotation_euler = (xyz((0, 0, 0)) - fill.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=xyz((2.5, 1.8, 4.5) if person_view else (25, 25, 28)))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.2 if person_view else 34
    target = (0, .86, 0) if person_view else (0, 0, 0)
    camera.rotation_euler = (xyz(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.view_settings.view_transform = "AgX"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def validate_person_export(path):
    blob = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<III", blob, 0)
    assert magic == 0x46546C67 and version == 2 and total_length == len(blob)
    json_length, chunk_type = struct.unpack_from("<II", blob, 12)
    assert chunk_type == 0x4E4F534A
    gltf = json.loads(blob[20:20 + json_length])
    nodes = gltf["nodes"]
    by_name = {node["name"]: i for i, node in enumerate(nodes)}
    parents = {child: i for i, node in enumerate(nodes) for child in node.get("children", [])}
    verified = {}
    for side, word in [(-1, "left"), (1, "right")]:
        for joint, expected in [("Leg", [side * .100, .900, -.003]),
                                ("Knee", [side * .103, .475, -.005]),
                                ("Arm", [side * .235, 1.320, 0])]:
            name = word + joint
            idx = by_name[name]
            absolute = list(nodes[idx].get("translation", [0, 0, 0]))
            ancestor = idx
            while ancestor in parents:
                ancestor = parents[ancestor]
                # This rig intentionally uses translation-only pivot ancestors.
                assert "rotation" not in nodes[ancestor] and "matrix" not in nodes[ancestor]
                absolute = [a + b for a, b in zip(absolute, nodes[ancestor].get("translation", [0, 0, 0]))]
            assert all(abs(a - b) < 1e-5 for a, b in zip(absolute, expected)), (name, absolute, expected)
            if joint == "Knee":
                assert nodes[parents[idx]]["name"] == word + "Leg"
            verified[name] = [round(v, 6) for v in absolute]
    assert "Scrubs" in [m["name"] for m in gltf["materials"]]
    return {"glb_header_valid": True, "articulation_world_positions_m": verified}


def main():
    bpy.context.preferences.filepaths.save_version = 0
    person_only = "--person-only" in sys.argv
    if person_only:
        previous = json.loads((SOURCE / "model-manifest.json").read_text(encoding="utf-8"))
        env_stats = {k: previous["environment"][k] for k in ["mesh_nodes", "triangles", "materials", "nodes"]}
    else:
        environment()
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "lab-environment.blend"))
        apply_modifiers()
        merge_materials()
        env_stats = stats()
        export_glb(OUT / "lab-environment.glb")
        render_preview(SOURCE / "lab-environment-preview.png")
    person()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "lab-person.blend"))
    apply_modifiers()
    merge_materials(preserve_parents=True)
    human_stats = stats()
    export_glb(OUT / "lab-person.glb")
    human_stats["validation"] = validate_person_export(OUT / "lab-person.glb")
    render_preview(SOURCE / "lab-person-preview.png", person_view=True)
    manifest = {
        "generator": "scripts/create_lab_assets.py",
        "blender_version": bpy.app.version_string,
        "blender_build_hash": bpy.app.build_hash.decode(),
        "license": "Original procedural assets created for this LabFlow project; no external models or textures.",
        "coordinates": "glTF/Three.js meters, Y up, floor spans X -12.6..12.6 / Z -8..8; person origin at feet, forward +Z",
        "environment": {"file": "lab-environment.glb", "source": "lab-environment.blend", "dimensions_m": [25.2, 2.1, 16.0], **env_stats},
        "person": {"file": "lab-person.glb", "source": "lab-person.blend", "height_m": 1.717, "walk_pivots": ["leftArm", "rightArm", "leftLeg", "rightLeg", "leftKnee", "rightKnee"], "tint_materials": ["Scrubs", "Skin", "Trousers", "Hair", "Shoe"], **human_stats},
        "rendering": "Opaque PBR materials with beveled edges and weighted normals. Frosted panels are opaque to avoid transparency sorting. Runtime supplies lighting, shadows, environment map, dynamic entities, signage and tube route.",
        "build": "Official Blender 4.5.4 LTS portable, run blender --background --python scripts/create_lab_assets.py from project root",
        "source_archive_sha256": "0de55df1d99e4e7152605022cb648e795d5d49209c5c5c4889e1a19fb401a054",
    }
    (SOURCE / "model-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (OUT / "model-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("LABFLOW_ASSET_REPORT " + json.dumps({"environment": env_stats, "person": human_stats}))


if __name__ == "__main__":
    main()
