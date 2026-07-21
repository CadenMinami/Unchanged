# World Asset Technical Spike

- **Run date:** 2026-07-19
- **Scope:** Task 1 feasibility evidence only
- **Repository outputs:** none

This record makes the accepted-candidate license, host-hash, texture, and glTF
checks reproducible. It uses only macOS tools plus the repository's existing
`three` and `@playwright/test` dependencies. All downloaded files and the HTML
harness live under `/tmp`; nothing is copied to a runtime or tracked path.

Observed environment:

```text
node v22.20.0
three 0.185.1
@playwright/test 1.61.1
jq 1.7.1-apple
```

The per-file direct URLs, bytes, and host MD5 values are retained in the
[candidate-only CC0 record](licenses/world/task-1-poly-haven-candidates.md).

## 1. Download Official Evidence And Candidate Graphs

Run from the repository root in `zsh`:

```zsh
set -euo pipefail
SPIKE=/tmp/history-unbroken-asset-spike-review
if [[ -e "$SPIKE" ]]; then
  print -u2 "temporary spike path already exists: $SPIKE"
  exit 1
fi

typeset -A PBR=(
  PBR-PLASTER-PH painted_plaster_wall
  PBR-STONE-PH stone_wall
  PBR-TIMBER-PH wood_planks
  PBR-ROOF-PH clay_roof_tiles
  PBR-METAL-PH rust_coarse_01
)
assets=(painted_plaster_wall stone_wall wood_planks clay_roof_tiles \
  rust_coarse_01 wine_barrel_01 wooden_crate_02)

mkdir -p "$SPIKE/evidence"
curl -fsSL https://polyhaven.com/license \
  -o "$SPIKE/evidence/poly-haven-license.html"

for asset in "${assets[@]}"; do
  curl -fsSL "https://polyhaven.com/a/$asset" \
    -o "$SPIKE/evidence/$asset.html"
  curl -fsSL "https://api.polyhaven.com/info/$asset" \
    -o "$SPIKE/evidence/$asset.info.json"
  curl -fsSL "https://api.polyhaven.com/files/$asset" \
    -o "$SPIKE/evidence/$asset.files.json"
done

for candidate asset in ${(kv)PBR}; do
  mkdir -p "$SPIKE/files/$candidate"
  for map in diff nor_gl rough; do
    curl -fsSL \
      "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/$asset/${asset}_${map}_1k.jpg" \
      -o "$SPIKE/files/$candidate/${asset}_${map}_1k.jpg"
  done
done

fetch_prop() {
  local candidate=$1 asset=$2
  mkdir -p "$SPIKE/files/$candidate/textures"
  curl -fsSL \
    "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/$asset/${asset}_1k.gltf" \
    -o "$SPIKE/files/$candidate/${asset}_1k.gltf"
  curl -fsSL \
    "https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/$asset/$asset.bin" \
    -o "$SPIKE/files/$candidate/$asset.bin"
  for map in diff arm nor_gl; do
    curl -fsSL \
      "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/$asset/${asset}_${map}_1k.jpg" \
      -o "$SPIKE/files/$candidate/textures/${asset}_${map}_1k.jpg"
  done
}

fetch_prop PROP-BARREL-PH wine_barrel_01
fetch_prop PROP-CRATE-PH wooden_crate_02
find "$SPIKE/files" -type f | wc -l
```

Observed:

```text
25
```

## 2. Check License Pages, Bytes, And Host MD5

```zsh
rg -q 'Our assets are all licensed as' \
  "$SPIKE/evidence/poly-haven-license.html"
for asset in "${assets[@]}"; do
  rg -q '<strong>CC0</strong>' "$SPIKE/evidence/$asset.html"
done
printf 'license_sha256=%s\n' \
  "$(shasum -a 256 "$SPIKE/evidence/poly-haven-license.html" | awk '{print $1}')"
printf 'license_scope=CC0 source_pages=7/7\n'

check_candidate() {
  local candidate=$1 asset=$2
  local root="$SPIKE/files/$candidate"
  local api="$SPIKE/evidence/$asset.files.json"
  local -a files
  local file record expected_size expected_md5 actual_size actual_md5
  local count=0 bytes=0
  files=("$root"/**/*(.N))

  for file in "${files[@]}"; do
    record=$(jq -r --arg name "${file:t}" \
      '[.. | objects |
        select((.url? | type) == "string" and
               (.md5? | type) == "string" and
               (.size? | type) == "number") |
        select(.url | endswith("/" + $name)) |
        [.size, .md5]] | unique | .[0] | @tsv' "$api")
    IFS=$'\t' read -r expected_size expected_md5 <<< "$record"
    actual_size=$(stat -f %z "$file")
    actual_md5=$(md5 -q "$file")
    [[ "$actual_size" == "$expected_size" && \
       "$actual_md5" == "$expected_md5" ]]
    (( count += 1, bytes += actual_size ))
  done
  printf '%s files=%d bytes=%d api_md5=%d/%d\n' \
    "$candidate" "$count" "$bytes" "$count" "$count"
}

check_candidate PBR-PLASTER-PH painted_plaster_wall
check_candidate PBR-STONE-PH stone_wall
check_candidate PBR-TIMBER-PH wood_planks
check_candidate PBR-ROOF-PH clay_roof_tiles
check_candidate PBR-METAL-PH rust_coarse_01
check_candidate PROP-BARREL-PH wine_barrel_01
check_candidate PROP-CRATE-PH wooden_crate_02
```

Observed:

```text
license_sha256=8280c4124cc6041014b1222db5c28356b533fd4342f394561f378ddd182606c4
license_scope=CC0 source_pages=7/7
PBR-PLASTER-PH files=3 bytes=1941949 api_md5=3/3
PBR-STONE-PH files=3 bytes=2310398 api_md5=3/3
PBR-TIMBER-PH files=3 bytes=1561723 api_md5=3/3
PBR-ROOF-PH files=3 bytes=2286209 api_md5=3/3
PBR-METAL-PH files=3 bytes=2320252 api_md5=3/3
PROP-BARREL-PH files=5 bytes=924683 api_md5=5/5
PROP-CRATE-PH files=5 bytes=2236220 api_md5=5/5
```

## 3. Check Texture Encoding And Dimensions

```zsh
jpgs=("$SPIKE"/files/**/*.jpg(N))
ok=0
for file in "${jpgs[@]}"; do
  width=$(sips -g pixelWidth "$file" 2>/dev/null | awk '/pixelWidth/{print $2}')
  height=$(sips -g pixelHeight "$file" 2>/dev/null | awk '/pixelHeight/{print $2}')
  [[ "$width" == 1024 && "$height" == 1024 ]]
  (( ok += 1 ))
done
printf 'textures=%d dimensions_1024x1024=%d\n' "${#jpgs[@]}" "$ok"
file "$SPIKE/files/PBR-PLASTER-PH/painted_plaster_wall_diff_1k.jpg"
```

Observed:

```text
textures=21 dimensions_1024x1024=21
JPEG image data, baseline, precision 8, 1024x1024, components 3
```

## 4. Parse Both glTF Graphs In Chromium

Create this temporary harness at `$SPIKE/gltf-harness.html`:

```html
<!doctype html>
<meta charset="utf-8">
<script type="importmap">
{"imports":{"three":"/Users/caden/Documents/Codex/History-Unbroken/node_modules/three/build/three.module.js"}}
</script>
<script type="module">
import { GLTFLoader } from "/Users/caden/Documents/Codex/History-Unbroken/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
const base = "/tmp/history-unbroken-asset-spike-review/files";
const candidates = [
  ["PROP-BARREL-PH", `${base}/PROP-BARREL-PH/wine_barrel_01_1k.gltf`],
  ["PROP-CRATE-PH", `${base}/PROP-CRATE-PH/wooden_crate_02_1k.gltf`],
];
const load = (url) => new Promise((resolve, reject) =>
  new GLTFLoader().load(url, resolve, undefined, reject));
try {
  window.spikeResults = [];
  for (const [id, url] of candidates) {
    const gltf = await load(url);
    let meshes = 0, triangles = 0;
    const materials = new Set(), textures = new Set();
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      meshes += 1;
      triangles += (node.geometry.index?.count ??
        node.geometry.attributes.position.count) / 3;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material.uuid);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value.uuid);
        }
      }
    });
    window.spikeResults.push({ id, meshes, triangles,
      materials: materials.size, textures: textures.size,
      animations: gltf.animations.length });
  }
} catch (error) {
  window.spikeError = String(error?.stack ?? error);
} finally {
  window.spikeDone = true;
}
</script>
```

Serve `/` only for the duration of the local test, then run the existing
Playwright Chromium binary:

```zsh
python3 -m http.server 4173 --bind 127.0.0.1 --directory / \
  >"$SPIKE/http.log" 2>&1 &
SERVER_PID=$!

node --input-type=module <<'NODE'
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const diagnostics = [];
page.on("console", (message) => {
  if (["warning", "error"].includes(message.type())) {
    diagnostics.push(message.type() + ": " + message.text());
  }
});
page.on("pageerror", (error) => diagnostics.push("pageerror: " + error.message));
await page.goto("http://127.0.0.1:4173/tmp/history-unbroken-asset-spike-review/gltf-harness.html");
await page.waitForFunction(() => window.spikeDone === true);
const result = await page.evaluate(() =>
  ({ results: window.spikeResults, error: window.spikeError }));
if (result.error) throw new Error(result.error);
for (const item of result.results) {
  console.log(`${item.id} meshes=${item.meshes} triangles=${item.triangles} ` +
    `materials=${item.materials} textures=${item.textures} animations=${item.animations}`);
}
console.log("browser_diagnostics=" + diagnostics.length);
if (diagnostics.length) throw new Error(diagnostics.join("\n"));
await browser.close();
NODE

kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true
```

Observed:

```text
PROP-BARREL-PH meshes=4 triangles=10820 materials=1 textures=3 animations=0
PROP-CRATE-PH meshes=2 triangles=5176 materials=1 textures=3 animations=0
browser_diagnostics=0
```

## Retained Limits

The character and rejected-pack rows in `WORLD_ASSET_SELECTION.md` retain their
observed archive hashes, license results, GLTF/GLB structure, clip/root-motion,
texture, browser-diagnostic, and compatibility findings. Quaternius direct archive
URLs are signed and expire, so repetition begins at each recorded official purchase
route; after download, use `shasum -a 256`, `unzip -t`, and the same local
GLTFLoader pattern. Rejected-at-source rows remain explicitly not downloaded or
unverified because additional metrics cannot change their controlling decision.

Not measured: production R3F integration, repacking, optimization, GPU memory,
shader compilation, physical Chromebook performance, CDP encoded transfer, visual
deformation, foot sliding, crossfades, or multi-character cloning.

After inspection, remove the temporary evidence:

```zsh
rm -rf "$SPIKE"
```
