# Task 1 Poly Haven Candidate CC0 Record

- **Status:** `CANDIDATE_ONLY`
- **Retrieved:** 2026-07-19
- **Runtime authorization:** none

This project-authored record covers only the seven accepted candidates in
`docs/WORLD_ASSET_SELECTION.md`. It does not add downloaded files to the
repository, satisfy runtime ledger/hash closure, or authorize loading an asset.
Any later runtime intake must redownload the selected graph, compute SHA-256 and
exact bytes, and create or update the runtime-specific license record and ledger.

## Host License Proof

- Official host: [Poly Haven](https://polyhaven.com/)
- Official license: [Poly Haven Asset License](https://polyhaven.com/license)
- Declared license: [Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Verified host statement: the official license page states that all Poly Haven
  HDRIs, textures, and 3D models are CC0.
- License-page response SHA-256 on retrieval:
  `8280c4124cc6041014b1222db5c28356b533fd4342f394561f378ddd182606c4`
- Scope limit: this proof applies to the asset downloads enumerated below, not
  Poly Haven page text, branding, thumbnails, metadata, or other site content.

Each official asset page displayed its CC0 license control on the retrieval date.
The official `info` endpoint supplied creator roles; the official `files`
endpoint supplied direct URLs, byte counts, and MD5 values. MD5 is retained only
to reproduce the host-file equality check, not as the later runtime integrity hash.

## Candidate Register

| Candidate ID | Asset and creator | Official source and API records |
| --- | --- | --- |
| `PBR-PLASTER-PH` | Painted Plaster Wall; Amal Kumar (all) | [Source](https://polyhaven.com/a/painted_plaster_wall); [info](https://api.polyhaven.com/info/painted_plaster_wall); [files](https://api.polyhaven.com/files/painted_plaster_wall) |
| `PBR-STONE-PH` | Stone Wall; Dario Barresi (processing), Charlotte Baglioni (photography) | [Source](https://polyhaven.com/a/stone_wall); [info](https://api.polyhaven.com/info/stone_wall); [files](https://api.polyhaven.com/files/stone_wall) |
| `PBR-TIMBER-PH` | Wood Planks; Amal Kumar (all) | [Source](https://polyhaven.com/a/wood_planks); [info](https://api.polyhaven.com/info/wood_planks); [files](https://api.polyhaven.com/files/wood_planks) |
| `PBR-ROOF-PH` | Clay Roof Tiles; Amal Kumar (all) | [Source](https://polyhaven.com/a/clay_roof_tiles); [info](https://api.polyhaven.com/info/clay_roof_tiles); [files](https://api.polyhaven.com/files/clay_roof_tiles) |
| `PBR-METAL-PH` | Rust Coarse 01; Dimitrios Savva (photography), Rico Cilliers (processing) | [Source](https://polyhaven.com/a/rust_coarse_01); [info](https://api.polyhaven.com/info/rust_coarse_01); [files](https://api.polyhaven.com/files/rust_coarse_01) |
| `PROP-BARREL-PH` | Wine Barrel 01; James Ray Cock (all) | [Source](https://polyhaven.com/a/wine_barrel_01); [info](https://api.polyhaven.com/info/wine_barrel_01); [files](https://api.polyhaven.com/files/wine_barrel_01) |
| `PROP-CRATE-PH` | Wooden Crate 02; James Ray Cock (modeling), Jurita Burger (graphic design) | [Source](https://polyhaven.com/a/wooden_crate_02); [info](https://api.polyhaven.com/info/wooden_crate_02); [files](https://api.polyhaven.com/files/wooden_crate_02) |

## Complete Candidate File Graphs

### `PBR-PLASTER-PH`

| File | Official direct URL | Bytes | Host MD5 |
| --- | --- | ---: | --- |
| `painted_plaster_wall_diff_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_diff_1k.jpg) | 686,726 | `15ba8c1f63a5ab412b1eabe31728540a` |
| `painted_plaster_wall_nor_gl_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_nor_gl_1k.jpg) | 900,461 | `43fff290583dbdfc9bfa088a2750e840` |
| `painted_plaster_wall_rough_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_rough_1k.jpg) | 354,762 | `e076a6360329a2bc18c7397dc50c074a` |

### `PBR-STONE-PH`

| File | Official direct URL | Bytes | Host MD5 |
| --- | --- | ---: | --- |
| `stone_wall_diff_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/stone_wall/stone_wall_diff_1k.jpg) | 836,975 | `451e4c5e2309af341fcdc1f1d637b1d6` |
| `stone_wall_nor_gl_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/stone_wall/stone_wall_nor_gl_1k.jpg) | 1,172,420 | `5c686c6c907ae2a1bb5c438ad96da055` |
| `stone_wall_rough_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/stone_wall/stone_wall_rough_1k.jpg) | 301,003 | `ddc708ee3b0730ec9c5e79c52990aff1` |

### `PBR-TIMBER-PH`

| File | Official direct URL | Bytes | Host MD5 |
| --- | --- | ---: | --- |
| `wood_planks_diff_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_planks/wood_planks_diff_1k.jpg) | 609,525 | `922505c35c2d0dc6a44da7ac77757134` |
| `wood_planks_nor_gl_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_planks/wood_planks_nor_gl_1k.jpg) | 652,441 | `98d2313130880f8ed7b87e843f6ba149` |
| `wood_planks_rough_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_planks/wood_planks_rough_1k.jpg) | 299,757 | `69c9313315808cc9d858a648c2335fec` |

### `PBR-ROOF-PH`

| File | Official direct URL | Bytes | Host MD5 |
| --- | --- | ---: | --- |
| `clay_roof_tiles_diff_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/clay_roof_tiles/clay_roof_tiles_diff_1k.jpg) | 878,367 | `d862ac9932b09b0918b5971ddb77099c` |
| `clay_roof_tiles_nor_gl_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/clay_roof_tiles/clay_roof_tiles_nor_gl_1k.jpg) | 1,101,177 | `d861a708c94c824befc8aac668052776` |
| `clay_roof_tiles_rough_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/clay_roof_tiles/clay_roof_tiles_rough_1k.jpg) | 306,665 | `a5881067d2ba78e439f4782b1f6045bd` |

### `PBR-METAL-PH`

| File | Official direct URL | Bytes | Host MD5 |
| --- | --- | ---: | --- |
| `rust_coarse_01_diff_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rust_coarse_01/rust_coarse_01_diff_1k.jpg) | 845,196 | `c2d2facc7184f216d15a8f9957d3aa4c` |
| `rust_coarse_01_nor_gl_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rust_coarse_01/rust_coarse_01_nor_gl_1k.jpg) | 763,053 | `77f701cbbf5042f6531e7a5af3a4d171` |
| `rust_coarse_01_rough_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rust_coarse_01/rust_coarse_01_rough_1k.jpg) | 712,003 | `5c06aa68ed5f0d597ef92198050c0c6a` |

### `PROP-BARREL-PH`

The graph preserves the glTF's relative `textures/` directory. The shared bin is
served from Poly Haven's 8K path but is the official dependency for the 1K glTF.

| Relative file | Official direct URL | Bytes | Host MD5 |
| --- | --- | ---: | --- |
| `wine_barrel_01_1k.gltf` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wine_barrel_01/wine_barrel_01_1k.gltf) | 6,673 | `5397e6d959dd3ef20d1fc14436d0eb70` |
| `wine_barrel_01.bin` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/wine_barrel_01/wine_barrel_01.bin) | 385,912 | `84f578460020912056a1e3fbe3ec1b97` |
| `textures/wine_barrel_01_diff_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wine_barrel_01/wine_barrel_01_diff_1k.jpg) | 195,980 | `fdea9538acf01a04a61626919a84b3fb` |
| `textures/wine_barrel_01_arm_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wine_barrel_01/wine_barrel_01_arm_1k.jpg) | 172,531 | `2f0cc81ac07fdbe8c22927feac722927` |
| `textures/wine_barrel_01_nor_gl_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wine_barrel_01/wine_barrel_01_nor_gl_1k.jpg) | 163,587 | `6b3ce558fa74d3760fa0192dfc4564a3` |

### `PROP-CRATE-PH`

The graph preserves the glTF's relative `textures/` directory. The shared bin is
served from Poly Haven's 8K path but is the official dependency for the 1K glTF.

| Relative file | Official direct URL | Bytes | Host MD5 |
| --- | --- | ---: | --- |
| `wooden_crate_02_1k.gltf` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wooden_crate_02/wooden_crate_02_1k.gltf) | 4,150 | `a69eb62fd20e6badb6bb56f052930e06` |
| `wooden_crate_02.bin` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/wooden_crate_02/wooden_crate_02.bin) | 150,064 | `08d98507231cdeda1070d1a2d0646254` |
| `textures/wooden_crate_02_diff_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wooden_crate_02/wooden_crate_02_diff_1k.jpg) | 716,110 | `45bca8f49da9d541e06bc926ab001c81` |
| `textures/wooden_crate_02_arm_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wooden_crate_02/wooden_crate_02_arm_1k.jpg) | 819,577 | `a7537612dbfb7fd25e756074eec5624e` |
| `textures/wooden_crate_02_nor_gl_1k.jpg` | [direct](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wooden_crate_02/wooden_crate_02_nor_gl_1k.jpg) | 546,319 | `314226b31765168cd8070898f8a7e18e` |

## Candidate-Only Result

The enumerated pool is 25 files and 13,581,434 bytes. All observed local bytes and
MD5 values matched the official file API on 2026-07-19. The files were deleted
with the temporary spike workspace and were never copied to a tracked runtime path.
