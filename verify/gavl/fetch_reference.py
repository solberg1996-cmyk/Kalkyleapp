"""
Hent referansedata fra Blocklayer gable-studs kalkulator via Playwright.
Sammenligner mot vår gavlCalc.js og lagrer verifiserte snapshots.

Kjør: cd /Users/thomassolberg/Desktop/Kalk && uv run python verify/gavl/fetch_reference.py
"""
import json
import math
import subprocess
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOTS_FILE = Path(__file__).resolve().parent / "snapshots.json"
BL_URL = "https://www.blocklayer.com/gable-studs"

# Mapping: våre feltnavn → BL DOM-IDer
BL_FIELDS = {
    "angleDeg":    "_txtAngle",
    "spacing":     "txtCentersLevel",
    "studWidth":   "txtStudWidth",
    "lengthLevel": "txtLevelLength",
    "startHeight": "txtStartHeight",
    "plateThick":  "txtPlateThick",
    "startIn":     "txtStartIn",
}

BL_SELECTS = {
    "topPlateCount": ("ddTopPlates", {1: "1", 2: "2"}),
    "measurePoint":  ("ddToSide", {"near": "Near Side", "centre": "Centre", "far": "Far Side"}),
    "startMode":     ("ddStart", {"single": "0", "double": "1", "doubleGap": "2"}),
}

# Test cases — varier vinkel, plater, målepunkt, dimensjoner
TEST_CASES = [
    {
        "navn": "30° centre 1plate 5000mm",
        "input": {
            "angleDeg": 30, "startHeight": 2400, "lengthLevel": 5000,
            "spacing": 600, "studWidth": 48, "plateThick": 48,
            "topPlateCount": 1, "measurePoint": "centre",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "45° centre 1plate 5000mm",
        "input": {
            "angleDeg": 45, "startHeight": 2400, "lengthLevel": 5000,
            "spacing": 600, "studWidth": 48, "plateThick": 48,
            "topPlateCount": 1, "measurePoint": "centre",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "30° near 2plates 5000mm",
        "input": {
            "angleDeg": 30, "startHeight": 2400, "lengthLevel": 5000,
            "spacing": 600, "studWidth": 48, "plateThick": 48,
            "topPlateCount": 2, "measurePoint": "near",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "10° near 2plates 4800mm",
        "input": {
            "angleDeg": 10, "startHeight": 2400, "lengthLevel": 4800,
            "spacing": 600, "studWidth": 48, "plateThick": 13,
            "topPlateCount": 2, "measurePoint": "near",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "22.5° centre 1plate 400cc 36w",
        "input": {
            "angleDeg": 22.5, "startHeight": 2700, "lengthLevel": 6000,
            "spacing": 400, "studWidth": 36, "plateThick": 36,
            "topPlateCount": 1, "measurePoint": "centre",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "15° far 2plates 300cc",
        "input": {
            "angleDeg": 15, "startHeight": 2400, "lengthLevel": 3600,
            "spacing": 300, "studWidth": 48, "plateThick": 48,
            "topPlateCount": 2, "measurePoint": "far",
            "startMode": "single", "startIn": 0,
        },
    },
]


def get_our_result(inp: dict) -> list[dict]:
    """Kjør vår gavlCalc.js via node og returner stendere."""
    js = f"""
    eval(require('fs').readFileSync('gavlCalc.js', 'utf8'));
    var res = beregnGavlStendere({json.dumps(inp)});
    if (!res.gyldig) {{ console.log('null'); process.exit(0); }}
    console.log(JSON.stringify(res.stendere.map(function(s) {{
        return {{nr: s.nr, lengdeLangside: s.lengdeLangside, runLevel: s.runLevel, runAngle: s.runAngle}};
    }})));
    """
    out = subprocess.check_output(
        ["node", "-e", js], cwd=str(PROJECT_ROOT), text=True
    ).strip()
    if out == "null":
        return []
    return json.loads(out)


def fill_and_read(page, inp: dict) -> list[dict]:
    """Fyll inn verdier i BL og les ut resultater via aStuds JS-variabel."""
    for key, bl_id in BL_FIELDS.items():
        val = inp.get(key)
        if val is None:
            continue
        el = page.locator(f"#{bl_id}")
        el.fill("")
        el.fill(str(val))

    for key, (bl_id, mapping) in BL_SELECTS.items():
        val = inp.get(key)
        if val is None:
            continue
        bl_val = mapping.get(val, str(val))
        page.select_option(f"#{bl_id}", bl_val)

    # Trigger beregning
    try:
        page.click("#btnCalculate", timeout=2000)
    except Exception:
        try:
            page.click("text=Calculate", timeout=2000)
        except Exception:
            page.evaluate("if (typeof Calculate === 'function') Calculate();")
    page.wait_for_timeout(1000)

    # Les resultater fra aStuds med measurePoint-offset
    results = page.evaluate("""() => {
        if (typeof aStuds === 'undefined' || !aStuds || !aStuds.length) return [];
        var sw = parseFloat(document.getElementById('txtStudWidth').value) || 48;
        var angle = parseFloat(document.getElementById('_txtAngle').value) || 0;
        var k = Math.cos(angle * Math.PI / 180);
        var side = document.getElementById('ddToSide').value;
        var x = 0, y = 0;
        if (side === 'Near Side') { x = sw; y = sw / k; }
        else if (side === 'Centre') { x = sw / 2; y = sw / 2 / k; }
        return aStuds.map(function(s, i) {
            return {
                nr: i + 1,
                lengdeLangside: Math.round(s.length),
                runLevel: Math.round(s.runLevel - x),
                runAngle: Math.round(s.runAngle - y)
            };
        });
    }""")
    return results


def compare(ours: list[dict], bl: list[dict]) -> tuple[int, int]:
    """Sammenlign stender for stender. Returner (ok, fail)."""
    ok = fail = 0
    if len(ours) != len(bl):
        print(f"  ANTALL MISMATCH: oss={len(ours)} BL={len(bl)}")
        return 0, 1

    for i in range(len(ours)):
        o, b = ours[i], bl[i]
        mismatches = []
        for field in ("lengdeLangside", "runLevel", "runAngle"):
            if o[field] != b[field]:
                mismatches.append(f"{field} {o[field]} != {b[field]}")
        if mismatches:
            print(f"  #{i+1} FAIL: {', '.join(mismatches)}")
            fail += 1
        else:
            ok += 1
    return ok, fail


def save_snapshots(verified: list[dict]):
    """Lagre verifiserte snapshots til JSON."""
    data = {
        "calculator": "gavlCalc.js",
        "function": "beregnGavlStendere",
        "source": BL_URL,
        "verified": "2026-04-05",
        "snapshots": verified,
    }
    SNAPSHOTS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"\nSnapshots lagret til {SNAPSHOTS_FILE}")


def main():
    total_ok = total_fail = 0
    verified_snapshots = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto(BL_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        for tc in TEST_CASES:
            navn = tc["navn"]
            inp = tc["input"]
            print(f"\n{'='*60}")
            print(f"  {navn}")
            print(f"{'='*60}")

            ours = get_our_result(inp)
            if not ours:
                print("  Vår kalkulator returnerte ugyldig!")
                total_fail += 1
                continue

            try:
                bl = fill_and_read(page, inp)
            except Exception as e:
                print(f"  BL feil: {e}")
                total_fail += 1
                continue

            if not bl:
                print("  Kunne ikke lese BL-resultater!")
                total_fail += 1
                continue

            print(f"  Oss: {len(ours)} stendere, BL: {len(bl)} stendere")
            print(f"  {'#':>3}  {'Vår':>8} {'BL':>8}  {'Vår rl':>7} {'BL rl':>7}  {'Vår ra':>7} {'BL ra':>7}  Status")
            print(f"  {'-'*65}")

            ok, fail = compare(ours, bl)

            for i in range(min(len(ours), len(bl))):
                o, b = ours[i], bl[i]
                match = all(o[f] == b[f] for f in ("lengdeLangside", "runLevel", "runAngle"))
                status = "MATCH" if match else "FAIL"
                print(f"  {o['nr']:>3}  {o['lengdeLangside']:>8} {b['lengdeLangside']:>8}"
                      f"  {o['runLevel']:>7} {b['runLevel']:>7}"
                      f"  {o['runAngle']:>7} {b['runAngle']:>7}  {status}")

            total_ok += ok
            total_fail += fail

            if fail == 0:
                verified_snapshots.append({
                    "navn": navn,
                    "input": {k: v for k, v in inp.items() if k != "startMode"},
                    "stendere": ours,
                })

        browser.close()

    print(f"\n{'='*60}")
    print(f"  TOTALT: {total_ok} OK, {total_fail} FEIL")
    print(f"{'='*60}")

    if verified_snapshots:
        save_snapshots(verified_snapshots)

    sys.exit(0 if total_fail == 0 else 1)


if __name__ == "__main__":
    main()
