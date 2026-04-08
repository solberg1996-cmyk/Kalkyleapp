"""
Automatisert Blocklayer-verifisering via Playwright.
Fyller inn verdier i https://www.blocklayer.com/gable-studs og leser ut
både UI-tabell og rå aStuds-data, sammenligner mot vår gavlCalc.js.

Kjør: cd /Users/thomassolberg/Desktop/Kalk && .venv/bin/python3 blocklayer-browseruse/test_blocklayer.py
"""
import json
import math
import subprocess
import sys
from playwright.sync_api import sync_playwright

# Mapping fra våre feltnavn til BL sine DOM-IDer
BL_FIELDS = {
    "angleDeg":     "_txtAngle",
    "spacing":      "txtCentersLevel",
    "studWidth":    "txtStudWidth",
    "lengthLevel":  "txtLevelLength",
    "startHeight":  "txtStartHeight",
    "plateThick":   "txtPlateThick",
    "startIn":      "txtStartIn",
}

BL_SELECTS = {
    "topPlateCount": ("ddTopPlates", {1: "1", 2: "2"}),
    "measurePoint":  ("ddToSide", {"near": "Near Side", "centre": "Centre", "far": "Far Side"}),
    "startMode":     ("ddStart", {"single": "0", "double": "1", "doubleGap": "2"}),
}

TEST_CASES = [
    {
        "navn": "22.5 centre 1plate 400cc 36w",
        "input": {
            "angleDeg": 22.5, "startHeight": 2700, "lengthLevel": 6000,
            "spacing": 400, "studWidth": 36, "plateThick": 36,
            "topPlateCount": 1, "measurePoint": "centre",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "15 far 2plates 300cc",
        "input": {
            "angleDeg": 15, "startHeight": 2400, "lengthLevel": 3600,
            "spacing": 300, "studWidth": 48, "plateThick": 48,
            "topPlateCount": 2, "measurePoint": "far",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "35 near 1plate 600cc",
        "input": {
            "angleDeg": 35, "startHeight": 3000, "lengthLevel": 7200,
            "spacing": 600, "studWidth": 48, "plateThick": 48,
            "topPlateCount": 1, "measurePoint": "near",
            "startMode": "single", "startIn": 0,
        },
    },
    {
        "navn": "45 centre 2plates 600cc 36plate",
        "input": {
            "angleDeg": 45, "startHeight": 2400, "lengthLevel": 4800,
            "spacing": 600, "studWidth": 48, "plateThick": 36,
            "topPlateCount": 2, "measurePoint": "centre",
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
        return {{nr: s.nr, length: s.lengdeLangside, runLevel: s.runLevel, runAngle: s.runAngle}};
    }})));
    """
    out = subprocess.check_output(["node", "-e", js], cwd="/Users/thomassolberg/Desktop/Kalk", text=True).strip()
    if out == "null":
        return []
    return json.loads(out)


def fill_and_read(page, inp: dict) -> tuple[list[dict], list[dict]]:
    """Fyll inn verdier i BL og les ut UI-tabell + rå aStuds."""

    # Sett tekstfelt
    for key, bl_id in BL_FIELDS.items():
        val = inp.get(key)
        if val is None:
            continue
        el = page.locator(f"#{bl_id}")
        el.fill("")
        el.fill(str(val))

    # Sett dropdowns
    for key, (bl_id, mapping) in BL_SELECTS.items():
        val = inp.get(key)
        if val is None:
            continue
        bl_val = mapping.get(val, str(val))
        page.select_option(f"#{bl_id}", bl_val)

    # Checkbox: alignSheets = cbAdjustFirst
    adjust = inp.get("alignSheets", False)
    cb = page.locator("#cbAdjustFirst")
    if cb.is_checked() != adjust:
        cb.click()

    # Trigger calculation — prøv flere selektorer
    try:
        page.click("#btnCalculate", timeout=2000)
    except Exception:
        try:
            page.click("text=Calculate", timeout=2000)
        except Exception:
            # Kall Calculate() direkte i JS
            page.evaluate("if (typeof Calculate === 'function') Calculate();")
    page.wait_for_timeout(1000)

    # Les rå aStuds fra JS
    raw = page.evaluate("""() => {
        if (typeof aStuds === 'undefined' || !aStuds) return [];
        return aStuds.map((s, i) => ({
            index: i + 1,
            length: s.length,
            runLevel: s.runLevel,
            runAngle: s.runAngle
        }));
    }""")

    # Les UI-verdier direkte fra aStuds (påliteligst) med offset-beregning
    ui_table = page.evaluate("""() => {
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
                index: i + 1,
                length: Math.round(s.length),
                run_level: Math.round(s.runLevel - x),
                run_angle: Math.round(s.runAngle - y)
            };
        });
    }""")

    return ui_table, raw


def compare(ours: list[dict], bl_ui: list[dict], navn: str) -> tuple[int, int]:
    """Sammenlign vår output mot BL UI-tabell. Returner (ok, fail)."""
    ok = 0
    fail = 0

    if len(ours) != len(bl_ui):
        print(f"  ANTALL MISMATCH: oss={len(ours)} BL={len(bl_ui)}")
        fail += 1
        return ok, fail

    for i in range(len(ours)):
        o = ours[i]
        b = bl_ui[i]
        mismatches = []
        if o["length"] != int(b["length"]):
            mismatches.append(f"length {o['length']} != {int(b['length'])}")
        if o["runLevel"] != int(b["run_level"]):
            mismatches.append(f"runLevel {o['runLevel']} != {int(b['run_level'])}")
        if o["runAngle"] != int(b["run_angle"]):
            mismatches.append(f"runAngle {o['runAngle']} != {int(b['run_angle'])}")

        if mismatches:
            print(f"  #{i+1} FAIL: {', '.join(mismatches)}")
            fail += 1
        else:
            ok += 1

    return ok, fail


def main():
    total_ok = 0
    total_fail = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto("https://www.blocklayer.com/gable-studs", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        for tc in TEST_CASES:
            navn = tc["navn"]
            inp = tc["input"]
            print(f"\n{'='*60}")
            print(f"  {navn}")
            print(f"{'='*60}")

            # Vår kalkulator
            ours = get_our_result(inp)
            if not ours:
                print("  Vår kalkulator returnerte ugyldig!")
                total_fail += 1
                continue

            # Blocklayer
            try:
                bl_ui, bl_raw = fill_and_read(page, inp)
            except Exception as e:
                print(f"  BL feil: {e}")
                total_fail += 1
                continue

            if not bl_ui:
                # Debug: vis hva som finnes på siden
                debug = page.evaluate("""() => {
                    var tables = document.querySelectorAll('table');
                    var info = {tables: tables.length, tableIds: []};
                    tables.forEach(t => info.tableIds.push(t.id || '(no id)'));
                    info.aStudsExists = typeof aStuds !== 'undefined';
                    info.aStudsLen = (typeof aStuds !== 'undefined' && aStuds) ? aStuds.length : 0;
                    info.calcExists = typeof Calculate === 'function';
                    return info;
                }""")
                print(f"  Kunne ikke lese BL-tabell! Debug: {debug}")
                print(f"  Raw aStuds: {len(bl_raw)} items")
                total_fail += 1
                continue

            # Vis BL rå-data
            print(f"  BL: {len(bl_raw)} raw studs, {len(bl_ui)} UI rows")
            print(f"  Oss: {len(ours)} stendere")
            print()

            # Sammenlign
            print(f"  {'#':>3}  {'Vår len':>8} {'BL len':>8}  {'Vår rl':>7} {'BL rl':>7}  {'Vår ra':>7} {'BL ra':>7}  Status")
            print(f"  {'-'*65}")
            ok, fail = compare(ours, bl_ui, navn)

            # Vis per-stender
            for i in range(min(len(ours), len(bl_ui))):
                o = ours[i]
                b = bl_ui[i]
                bl_len = int(b["length"])
                bl_rl = int(b["run_level"])
                bl_ra = int(b["run_angle"])
                match = o["length"] == bl_len and o["runLevel"] == bl_rl and o["runAngle"] == bl_ra
                status = "MATCH" if match else "FAIL"
                print(f"  {o['nr']:>3}  {o['length']:>8} {bl_len:>8}  {o['runLevel']:>7} {bl_rl:>7}  {o['runAngle']:>7} {bl_ra:>7}  {status}")

            total_ok += ok
            total_fail += fail

        browser.close()

    print(f"\n{'='*60}")
    print(f"  TOTALT: {total_ok} OK, {total_fail} FEIL")
    print(f"{'='*60}")

    sys.exit(0 if total_fail == 0 else 1)


if __name__ == "__main__":
    main()
