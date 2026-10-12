# Original Blender assets

The laboratory and human models are authored specifically for LabFlow. They use original geometry and native Blender PBR materials, without third-party models, stock textures, or additional model licences.

- `lab-environment.blend`: editable laboratory master with individually named equipment components and non-destructive bevel modifiers.
- `lab-person.blend`: editable human master with shoulder, hip, and knee pivot empties.
- `lab-environment-preview.png`: Blender Cycles preview of the environment.
- `lab-person-preview.png`: Blender Cycles preview of the articulated human.
- `model-manifest.json`: actual export counts, material names, dimensions, and build provenance.
- Browser exports: `../dist/assets/models/lab-environment.glb` and `lab-person.glb`.

Rebuild from the project directory using Blender 4.5 LTS:

```powershell
& 'C:/path/to/blender.exe' --background --python scripts/create_lab_assets.py
```

To rebuild only the person after a rig edit, append `-- --person-only`. The exporter asserts the hip, knee, and shoulder world positions in the resulting GLB; these checks and their measured positions are recorded in the manifest. Knee local positions are (+/-0.003, -0.425, -0.002) under their hip parents. For a +Z-facing seated pose, rotate hips around local X approximately -90 degrees and knees +90 degrees, with small adjustments for the chair.

Blender 4.5.4 was downloaded from the [official Blender distribution service](https://download.blender.org/release/Blender4.5/blender-4.5.4-windows-x64.zip). Its ZIP SHA256 was checked against the [official checksum file](https://download.blender.org/release/Blender4.5/blender-4.5.4.sha256):

`0de55df1d99e4e7152605022cb648e795d5d49209c5c5c4889e1a19fb401a054`

The generator uses Three.js coordinates in metres and converts to Blender's Z-up system before export. Browser exports are glTF Y-up. People face positive Z and have their origin at foot level. Their named articulation pivots are `leftArm`, `rightArm`, `leftLeg`, `rightLeg`, `leftKnee`, and `rightKnee`; knees are children of hip pivots. Skin, clothing, hair, and shoe materials remain distinguishable for runtime tinting.

The environment keeps the central corridor near Z=0.55 unobstructed. Phlebotomy chair centres are X=-5.6, -3.6, and -1.6, Z=4.6; cushion tops are Y=0.655. Pneumatic terminal connector tops are approximately (0.3, 2.085, 5.8) and (5.9, 2.085, 5.85). The application supplies the animated conduit, carriers, specimens, people, labels, camera, and lighting.

For browser efficiency, static meshes are merged by material after saving the editable master. Human meshes are merged only within their articulation groups. Frosted screens use opaque material rather than expensive overlapping transparency. The asset depicts a plausible clinical laboratory; dimensions and instrument shapes are illustrative, not a measured model of the hospital or a manufacturer-specific device.
