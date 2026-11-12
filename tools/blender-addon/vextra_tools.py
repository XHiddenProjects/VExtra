# Vextra Studio – Blender add-on
# Exports the scene (or the selection) as a game-ready .glb for Vextra Studio: skeletons, skinning, animations, morph targets and materials are kept,
# optional Draco compression, textures limited in size, +Y up. Also reports a quick "game budget" (triangles, bones, textures) before you export.
#
# Install:  Blender → Edit → Preferences → Add-ons → Install… (Blender 4.2+: "Install from Disk…") → pick this file → tick "Vextra Studio".
# Use:      3D View → N panel → "Vextra" tab, or File → Export → Vextra game model (.glb).
bl_info = {
    "name": "Vextra Studio – game model export",
    "author": "Vextra Studio",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "File > Export, and the 3D View sidebar (N) > Vextra",
    "description": "One-click .glb export with skeletons, animations and optional Draco compression, tuned for Vextra Studio games",
    "category": "Import-Export",
}

import os
import bpy
from bpy.props import BoolProperty, EnumProperty, IntProperty, StringProperty
from bpy_extras.io_utils import ExportHelper


def _gltf_export(filepath, opts):
    """Calls Blender's glTF exporter; options that the running Blender version does not know are dropped one by one."""
    kw = dict(
        filepath=filepath,
        export_format="GLB",
        use_selection=opts["selected"],
        export_apply=opts["apply_modifiers"],
        export_animations=opts["animations"],
        export_skins=True,
        export_morph=True,
        export_yup=True,
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
    if opts["draco"]:
        kw.update(export_draco_mesh_compression_enable=True,
                  export_draco_mesh_compression_level=opts["draco_level"],
                  export_draco_position_quantization=14,
                  export_draco_normal_quantization=10,
                  export_draco_texcoord_quantization=12)
    if opts["animations"]:
        kw.update(export_animation_mode="ACTIONS", export_force_sampling=True, export_frame_range=False)
    for _ in range(len(kw) + 1):
        try:
            return bpy.ops.export_scene.gltf(**kw)
        except TypeError as e:
            # "keyword "xyz" unrecognized" – older / newer Blender: remove it and try again
            msg = str(e)
            bad = [k for k in list(kw) if '"%s"' % k in msg]
            if not bad:
                raise
            for k in bad:
                kw.pop(k, None)
    raise RuntimeError("glTF exporter rejected the options")


def _budget(selected_only):
    objs = [o for o in bpy.context.scene.objects if (o.select_get() or not selected_only)]
    deps = bpy.context.evaluated_depsgraph_get()
    tris = verts = bones = 0
    mats, imgs = set(), set()
    for o in objs:
        if o.type == "MESH":
            ev = o.evaluated_get(deps)
            me = ev.to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            verts += len(me.vertices)
            ev.to_mesh_clear()
            for s in o.material_slots:
                if s.material:
                    mats.add(s.material.name)
                    if s.material.use_nodes:
                        for n in s.material.node_tree.nodes:
                            if n.type == "TEX_IMAGE" and n.image:
                                imgs.add(n.image)
        elif o.type == "ARMATURE":
            bones += len(o.data.bones)
    big = [i.name + " (%dx%d)" % tuple(i.size) for i in imgs if max(i.size) > 2048]
    clips = len(bpy.data.actions)
    return tris, verts, bones, len(mats), len(imgs), big, clips


class VEXTRA_OT_check(bpy.types.Operator):
    bl_idname = "vextra.check_budget"
    bl_label = "Check game budget"
    bl_description = "Counts triangles, bones, materials, textures and animation clips so you know what the model costs in a game"

    selected: BoolProperty(default=False)

    def execute(self, context):
        tris, verts, bones, mats, imgs, big, clips = _budget(self.selected)
        msg = "%s triangles · %s vertices · %d bones · %d materials · %d textures · %d animation clips" % (format(tris, ","), format(verts, ","), bones, mats, imgs, clips)
        self.report({"INFO"}, msg)
        if tris > 100000:
            self.report({"WARNING"}, "Over 100,000 triangles – consider decimating for mobile / web games")
        if bones > 80:
            self.report({"WARNING"}, "Over 80 bones – phones may struggle with skinned models this heavy")
        if big:
            self.report({"WARNING"}, "Textures larger than 2048 px: " + ", ".join(big[:4]))
        return {"FINISHED"}


def _opts(self):
    return dict(selected=self.selected, apply_modifiers=self.apply_modifiers, animations=self.animations, draco=self.draco, draco_level=self.draco_level)


class EXPORT_OT_vextra(bpy.types.Operator, ExportHelper):
    bl_idname = "export_scene.vextra"
    bl_label = "Export Vextra game model"
    bl_description = "Export a .glb for Vextra Studio"
    filename_ext = ".glb"
    filter_glob: StringProperty(default="*.glb", options={"HIDDEN"})
    selected: BoolProperty(name="Selected objects only", default=False)
    apply_modifiers: BoolProperty(name="Apply modifiers", default=True)
    animations: BoolProperty(name="Animations", default=True, description="Export every action (walk, run, idle…) as a clip the Model Animation block can play")
    draco: BoolProperty(name="Draco compression", default=True, description="Makes the file 5–10x smaller; Vextra decodes it automatically")
    draco_level: IntProperty(name="Compression level", default=6, min=0, max=10)

    def execute(self, context):
        _gltf_export(self.filepath, _opts(self))
        self.report({"INFO"}, "Saved %s – in Vextra: Assets → Models → Import" % os.path.basename(self.filepath))
        return {"FINISHED"}


class VEXTRA_OT_quick(bpy.types.Operator):
    bl_idname = "vextra.quick_export"
    bl_label = "Export to Vextra folder"
    bl_description = "Exports next to your Vextra project (folder set in the add-on preferences) using the .blend file name"
    selected: BoolProperty(name="Selected objects only", default=False)
    apply_modifiers: BoolProperty(name="Apply modifiers", default=True)
    animations: BoolProperty(name="Animations", default=True, description="Export every action (walk, run, idle…) as a clip the Model Animation block can play")
    draco: BoolProperty(name="Draco compression", default=True, description="Makes the file 5–10x smaller; Vextra decodes it automatically")
    draco_level: IntProperty(name="Compression level", default=6, min=0, max=10)

    def execute(self, context):
        prefs = context.preferences.addons[__name__].preferences
        folder = bpy.path.abspath(prefs.folder) if prefs.folder else (os.path.dirname(bpy.data.filepath) or os.path.expanduser("~"))
        name = os.path.splitext(os.path.basename(bpy.data.filepath))[0] or "model"
        path = os.path.join(folder, name + ".glb")
        os.makedirs(folder, exist_ok=True)
        _gltf_export(path, _opts(self))
        self.report({"INFO"}, "Saved " + path)
        return {"FINISHED"}


class VextraPrefs(bpy.types.AddonPreferences):
    bl_idname = __name__
    folder: StringProperty(name="Export folder", subtype="DIR_PATH", description="Where “Export to Vextra folder” puts the .glb (usually your Vextra project's folder)")

    def draw(self, context):
        self.layout.prop(self, "folder")


class VEXTRA_PT_panel(bpy.types.Panel):
    bl_label = "Vextra Studio"
    bl_idname = "VEXTRA_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Vextra"

    def draw(self, context):
        col = self.layout.column(align=True)
        col.operator("vextra.check_budget", icon="INFO").selected = False
        col.separator()
        col.operator("vextra.quick_export", icon="EXPORT")
        col.operator("export_scene.vextra", text="Export as…", icon="FILE_FOLDER")
        col.separator()
        col.label(text="Then in Vextra: Assets → Models → Import")


def _menu(self, context):
    self.layout.operator(EXPORT_OT_vextra.bl_idname, text="Vextra game model (.glb)")


_classes = (VEXTRA_OT_check, EXPORT_OT_vextra, VEXTRA_OT_quick, VextraPrefs, VEXTRA_PT_panel)


def register():
    for c in _classes:
        bpy.utils.register_class(c)
    bpy.types.TOPBAR_MT_file_export.append(_menu)


def unregister():
    bpy.types.TOPBAR_MT_file_export.remove(_menu)
    for c in reversed(_classes):
        bpy.utils.unregister_class(c)


if __name__ == "__main__":
    register()
