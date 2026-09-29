"""Unit tests for the WDMMA scraper.

These run entirely offline against a trimmed HTML fixture that reproduces the
real WDMMA markup, including the two failure modes the parser is built to
avoid: readiness numbers that look like inventory, and descriptions containing
commas.

Run with:
    ../.venv/bin/python -m unittest discover -s scripts/tests -t .
"""

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = PROJECT_ROOT / "data-pipeline" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from scrape_wdmma import (  # noqa: E402
    LEGACY_TEMPLATE,
    MODERN_TEMPLATE,
    NON_SERVICE_SLUGS,
    detect_template,
    parse_index,
    parse_service_page,
    to_int,
)


INDEX_FIXTURE = """
<!--RUSSIA-->
<div class="encompassingContainer">
  <div class="flagContainer" style="background-image:url(/imgs/flags/midblock/russia.jpg);"></div>
  <div class="titleContainer">
    <span class="textWhite">Russia</span> <span class="textYellow">(4,061)</span>
  </div>
  <div class="dropdownContent">
    <a class="picTrans" href="/russian-air-force.php" title="Current aircraft">
      <div class="wholeTabContainer tabContainerSubCats afBranch">
        <div class="titleContainer"><span class="textNormal">
          <span class="textDkGray">Russian Air Force</span> <span class="textGreen">(3,677)</span>
        </span></div>
      </div></a>
    <a class="picTrans" href="/russian-naval-aviation.php" title="Current aircraft">
      <div class="titleContainer"><span class="textNormal">
        <span class="textDkGray">Russian Naval Aviation</span> <span class="textGreen">(384)</span>
      </span></div></a>
  </div>
</div>
<!--ALBANIA-->
<div class="encompassingContainer">
  <div class="titleContainer">
    <span class="textWhite">Albania</span> <span class="textYellow">(19)</span>
  </div>
  <div class="dropdownContent">
    <a class="picTrans" href="/albanian-air-force.php" title="Current aircraft">
      <div class="titleContainer"><span class="textNormal">
        <span class="textDkGray">Albanian Air Force</span> <span class="textGreen">(19)</span>
      </span></div></a>
  </div>
</div>
<a class="picTrans" href="/ranking.php" title="Ranking">Current Global Rankings</a>
"""

SERVICE_FIXTURE = """
<html><body>
<h1 class="textBold textWhite textJumbo">Royal Air Force (2026) Aircraft Inventory</h1>
<h2 class="textWhite textLargest">Current Active Inventory: 2 Aircraft</h2>
<span class="textNormal textLtrGray">Updated: 12/10/2024</span>

<!-- The rankBoxes block reuses plate span classes. None of this is inventory. -->
<div class="rankBoxes"><div class="subjectHolder">
  <span class="textLarge textDkGray textItalics">Combat/Attack: <span class="textBold">1</span> units</span>
  <span class="textDkGray textJumbo textBold">55.3</span>
  <span class="textJumbo textBold"><span class="textDkGray">11</span><span class="textLtrGray">/129</span></span>
</div></div>

<h3 class="textLargest textDkGray">Fighters (Making up approximately 66.6% of Total Strength)</h3>
<div class="contentStripInner acStripContainers">
  <div class="acPlateContainer" style="min-height:245px; background-color:#069;">
    <div class="circle"><span class="textJumbo textBold textWhite">2</span><br />
    <span class="textNormal textBold textWhite">Units</span></div>
    <div class="acDetails"><span class="textBold textLarger textWhite">TOTAL</span></div>
  </div>

  <div class="acPlateContainer zoom picTrans" onClick="on('Eurofighter Typhoon','A joint European initiative, produced the excellent single-seat, twin-engine supersonic Eurofighter Typhoon multirole fighter to compete with emerging threats.','/aircraft/imgs/med/eurofighter-typhoon-multirole-combat-aircraft-misc.jpg')">
    <div class="acFlag">
      <img class="acFlag" src="/imgs/flags/midblock/united-kingdom.jpg" alt="" loading="lazy" />
    </div>
    <div class="circle"><span class="textJumbo textBold textDkGray">2</span><br />
      <span class="textNormal textBold textLtrGray">Units</span></div>
    <div class="acDetails">
      <span class="textBold textNormal textDkGray">Typhoon</span><br />
      <span class="textNormal textDkGray textItalics">Multirole</span>
    </div>
  </div>
</div>

<h3 class="textLargest textDkGray">On Order / Future Procurement</h3>
<div class="contentStripInner acStripContainers">
  <div class="acPlateContainer" style="min-height:245px; background-color:#66C;">
    <div class="circle"><span class="textJumbo textBold textWhite">1</span><br />
    <span class="textNormal textBold textWhite">Units</span></div>
    <div class="acDetails"><span class="textBold textLarger textWhite">TOTAL</span></div>
  </div>

  <div class="acPlateContainer zoom picTrans" onClick="on('Lockheed F-35 Lightning II','Lockheeds advanced, expensive strike fighter, the F-35 Lightning II is a company flagship product.','/aircraft/imgs/med/lockheed-f35a-lightning-ii-strike-fighter-united-states.jpg')">
    <div class="acFlag">
      <img class="acFlag" src="/imgs/flags/midblock/united-states.jpg" alt="" loading="lazy" />
    </div>
    <div class="circle"><span class="textJumbo textBold textDkGray">1</span><br />
      <span class="textNormal textBold textLtrGray">Units</span></div>
    <div class="acDetails">
      <span class="textBold textNormal textDkGray">F-35B</span><br />
      <span class="textNormal textDkGray textItalics">Strike</span>
    </div>
  </div>
</div>
</body></html>
"""


LEGACY_FIXTURE = """
<html><body>
<h1 class="textBold textWhite textJumbo">French Navy Aviation (2026) Aircraft Inventory</h1>
<h2 class="textWhite textLargest">Current Active Inventory: 5 Aircraft</h2>

<h3 class="textLargest textDkGray">Fighters (3)</h3>
<div class="acPanelFormatting" onclick="on('Dassault Rafale','The flagship product of French-based Dassault, the Rafale is a top frontline fighter today.','/aircraft/imgs/med/dassault-rafale-multirole-fighter-aircraft-france.jpg')">
  <div class="panelContainerWhole picTrans boxShadow zoom">
    <div class="numContainer"><span class="textWhite textNormal textShadow textBold textYellowOrange">3</span></div>
    <div class="flagMinContainer"><img class="flagMinStyling" src="/imgs/flags/midblock/france.jpg" alt="" /></div>
    <img class="acThumbs" src="/aircraft/imgs/thumbnails/rafale.jpg" />
    <div class="nameContainer">
      <span class="textWhite textNormal">Rafale M</span>
    </div>
    <div class="nameContainer" style="background-color:#333;">
      <span class="textSmall2 textWhite">Multirole</span>
    </div>
  </div>
</div>

<div class="acPanelFormatting" onclick="on('Saab 105','Legacy trainer, retired.','/aircraft/imgs/med/saab-105.jpg')">
  <div class="panelContainerWhole">
    <div class="numContainer"><span class="textWhite textNormal textBold textYellowOrange">2</span></div>
    <div class="flagMinContainer"><img class="flagMinStyling" src="/imgs/flags/midblock/sweden.jpg" alt="" /></div>
    <div class="nameContainer">
      <span class="textWhite textNormal">Sk 60</span>
    </div>
    <div class="nameContainer" style="background-color:#333;">
      <span class="textSmall2 textWhite">Trainer</span>
    </div>
  </div>
</div>

<h3 class="textLargest textWhite">On Order (65)</h3>
<div class="acPanelFormatting" onclick="on('Dassault Rafale','Future order.','/aircraft/imgs/med/dassault-rafale-multirole-fighter-aircraft-france.jpg')">
  <div class="panelContainerWhole">
    <div class="numContainer"><span class="textWhite textNormal textBold textYellowOrange">1</span></div>
    <div class="flagMinContainer"><img class="flagMinStyling" src="/imgs/flags/midblock/france.jpg" alt="" /></div>
    <div class="nameContainer"><span class="textWhite textNormal">Rafale M</span></div>
    <div class="nameContainer"><span class="textSmall2 textWhite">Multirole</span></div>
  </div>
</div>
</body></html>
"""


def _service() -> dict:
    return {
        "air_service": "Royal Air Force",
        "air_service_slug": "royal-air-force-britain",
        "country": "United Kingdom",
        "index_count": 2,
        "country_total": 621,
        "url": "https://www.wdmma.org/royal-air-force-britain.php",
        "retrieved_at": "2026-09-28T00:00:00+00:00",
    }


def _legacy_service() -> dict:
    service = _service()
    service.update(
        air_service="French Navy Aviation",
        air_service_slug="french-navy-aviation",
        country="France",
        index_count=5,
        url="https://www.wdmma.org/french-navy-aviation.php",
    )
    return service


class TestParseIndex(unittest.TestCase):
    def test_extracts_country_service_and_counts(self):
        services = parse_index(INDEX_FIXTURE)
        self.assertEqual(len(services), 3)
        first = services[0]
        self.assertEqual(first["air_service"], "Russian Air Force")
        self.assertEqual(first["country"], "Russia")
        self.assertEqual(first["index_count"], 3677)
        self.assertEqual(first["country_total"], 4061)
        self.assertEqual(first["url"], "https://www.wdmma.org/russian-air-force.php")

    def test_excludes_site_chrome_pages(self):
        slugs = {s["air_service_slug"] for s in parse_index(INDEX_FIXTURE)}
        for chrome in ("ranking", "cookies", "disclaimer", "privacy-policy"):
            self.assertIn(chrome, NON_SERVICE_SLUGS)
            self.assertNotIn(chrome, slugs)

    def test_countries_do_not_bleed_across_blocks(self):
        """A block must not inherit the next country's name.

        Splitting the index on `encompassingContainer` (which never closes
        cleanly) collapses every country into one block, so every air service
        is attributed to the first country in the document.
        """
        by_slug = {s["air_service_slug"]: s for s in parse_index(INDEX_FIXTURE)}
        self.assertEqual(by_slug["russian-air-force"]["country"], "Russia")
        self.assertEqual(by_slug["albanian-air-force"]["country"], "Albania")

    def test_thousands_separators_are_stripped(self):
        self.assertEqual(to_int("13,052"), 13052)


class TestParseServicePage(unittest.TestCase):
    def setUp(self):
        self.result = parse_service_page(SERVICE_FIXTURE, _service())
        self.records = self.result["records"]

    def test_reads_headline_and_rank_metadata(self):
        summary = self.result["summary"]
        self.assertEqual(summary["active_total"], 2)
        self.assertEqual(summary["global_rank"], 11)
        self.assertEqual(summary["ranked_against"], 129)
        self.assertEqual(summary["truv_val_rating"], 55.3)
        self.assertEqual(summary["updated"], "12/10/2024")

    def test_headline_total_wrapped_in_a_span_is_read(self):
        """Nagorno-Karabakh publishes the count inside a span, not as text.

        `Current Active Inventory: <span class='textYellowOrange'>12 Aircraft`
        is the only place the total appears, so a text-only regex leaves it None
        and the run aborts when the total is formatted.
        """
        wrapped = SERVICE_FIXTURE.replace(
            "Current Active Inventory: 2 Aircraft",
            "Current Active Inventory: <span class='textYellowOrange'>2 Aircraft</span>",
        )
        self.assertEqual(
            parse_service_page(wrapped, _service())["summary"]["active_total"], 2
        )

    def test_missing_headline_total_yields_none(self):
        stripped = SERVICE_FIXTURE.replace("Current Active Inventory: 2 Aircraft", "")
        self.assertIsNone(
            parse_service_page(stripped, _service())["summary"]["active_total"]
        )

    def test_readiness_numbers_are_not_counted_as_aircraft(self):
        """The 55.3 TruVal rating reuses the plate span classes.

        If parsing were page-wide it would surface as a fractional unit count.
        """
        self.assertEqual([r["units"] for r in self.records], [2, 1])
        self.assertNotIn(55.3, [r["units"] for r in self.records])
        self.assertEqual(self.result["warnings"], [])

    def test_description_commas_do_not_break_the_image_path(self):
        typhoon = self.records[0]
        self.assertEqual(
            typhoon["image_path"],
            "/aircraft/imgs/med/eurofighter-typhoon-multirole-combat-aircraft-misc.jpg",
        )
        self.assertEqual(typhoon["full_name"], "Eurofighter Typhoon")

    def test_parses_designation_role_and_operator_flag(self):
        typhoon = self.records[0]
        self.assertEqual(typhoon["designation"], "Typhoon")
        self.assertEqual(typhoon["role"], "Multirole")
        self.assertEqual(typhoon["operator_flag"], "united-kingdom")

    def test_category_share_and_name_are_split(self):
        typhoon = self.records[0]
        self.assertEqual(typhoon["category"], "Fighters")
        self.assertAlmostEqual(typhoon["category_share_pct"], 66.6)

    def test_on_order_section_is_flagged_separately(self):
        active = [r for r in self.records if not r["on_order"]]
        on_order = [r for r in self.records if r["on_order"]]
        self.assertEqual([r["designation"] for r in active], ["Typhoon"])
        self.assertEqual([r["designation"] for r in on_order], ["F-35B"])
        self.assertEqual(self.result["summary"]["on_order_total"], 1)

    def test_total_summary_plates_are_not_treated_as_holdings(self):
        self.assertNotIn("TOTAL", [r["designation"] for r in self.records])

    def test_descriptions_are_never_stored(self):
        """The published descriptive text is copyrighted, so only facts are kept."""
        blob = " ".join(str(value) for r in self.records for value in r.values())
        self.assertNotIn("joint European initiative", blob)
        self.assertNotIn("company flagship product", blob)
        self.assertNotIn("description", blob)

    def test_records_carry_provenance(self):
        for record in self.records:
            self.assertEqual(record["source_registry_id"], "wdmma")
            self.assertEqual(
                record["source_url"],
                "https://www.wdmma.org/royal-air-force-britain.php",
            )
            self.assertEqual(record["country"], "United Kingdom")
            self.assertTrue(record["external_id"].startswith("wdmma:"))

    def test_external_ids_are_unique_and_stable(self):
        ids = [r["external_id"] for r in self.records]
        self.assertEqual(len(ids), len(set(ids)))
        again = parse_service_page(SERVICE_FIXTURE, _service())["records"]
        self.assertEqual(ids, [r["external_id"] for r in again])

    def test_mismatched_page_total_raises_a_warning(self):
        broken = _service()
        broken["index_count"] = 999
        result = parse_service_page(SERVICE_FIXTURE, broken)
        self.assertTrue(result["warnings"])


class TestLegacyTemplate(unittest.TestCase):
    """41 of the 130 services are still served from WDMMA's older template.

    They render the same inventory with `acPanelFormatting` panels and a
    lowercase `onclick`. They are easy to miss because each still publishes a
    correct headline total, so a template-blind parser reports them as
    successfully parsed while silently emitting zero aircraft rows.
    """

    def setUp(self):
        self.result = parse_service_page(LEGACY_FIXTURE, _legacy_service())
        self.records = self.result["records"]

    def test_detects_legacy_template(self):
        self.assertIs(detect_template(LEGACY_FIXTURE), LEGACY_TEMPLATE)
        self.assertIs(detect_template(SERVICE_FIXTURE), MODERN_TEMPLATE)

    def test_legacy_panels_are_parsed(self):
        self.assertEqual(len(self.records), 3)
        self.assertEqual([r["units"] for r in self.records], [3, 2, 1])

    def test_legacy_fields_are_extracted(self):
        rafale = self.records[0]
        self.assertEqual(rafale["designation"], "Rafale M")
        self.assertEqual(rafale["full_name"], "Dassault Rafale")
        self.assertEqual(rafale["role"], "Multirole")
        self.assertEqual(rafale["operator_flag"], "france")

    def test_legacy_bracket_count_is_stripped_from_category(self):
        self.assertEqual(self.records[0]["category"], "Fighters")
        self.assertIsNone(self.records[0]["category_share_pct"])

    def test_legacy_on_order_is_flagged(self):
        on_order = [r for r in self.records if r["on_order"]]
        self.assertEqual(len(on_order), 1)
        self.assertEqual(self.result["summary"]["on_order_total"], 1)

    def test_legacy_capitalised_onclick_is_parsed(self):
        """Royal Bahraini Air Force writes `onClick`, others write `onclick`.

        A case-sensitive legacy pattern silently returns zero rows for those
        pages while their published totals still look correct.
        """
        capitalised = LEGACY_FIXTURE.replace(
            'acPanelFormatting" onclick="on(', 'acPanelFormatting" onClick="on('
        )
        records = parse_service_page(capitalised, _legacy_service())["records"]
        self.assertEqual(len(records), 3)
        self.assertEqual([r["units"] for r in records], [3, 2, 1])

    def test_legacy_extra_style_attribute_is_parsed(self):
        """Some legacy pages close the tag with a trailing `style` attribute.

        Spanish Army Aviation, Iranian Navy Aviation and Royal Navy Fleet Air
        Arm all add one. Anchoring the pattern on the exact tag end drops
        every aircraft on those pages while their published totals still look
        correct.
        """
        styled = LEGACY_FIXTURE.replace(
            ".jpg')\">", ".jpg')\" style=\"border:none;\">"
        )
        records = parse_service_page(styled, _legacy_service())["records"]
        self.assertEqual(len(records), 3)
        self.assertEqual([r["units"] for r in records], [3, 2, 1])

    def test_legacy_on_order_heading_is_white_not_gray(self):
        """The legacy On Order strip is white-on-dark, not dark-on-light.

        Matching only the dark heading colour leaves it unrecognised, so its
        aircraft are attributed to the last active section and counted as
        already fielded. French Navy Aviation published 196 active but 255
        would be summed.
        """
        result = parse_service_page(LEGACY_FIXTURE, _legacy_service())
        active = [r for r in result["records"] if not r["on_order"]]
        self.assertEqual(sum(r["units"] for r in active), 5)
        self.assertEqual(result["summary"]["active_total"], 5)
        self.assertEqual(result["warnings"], [])

    def test_non_inventory_sections_are_ignored(self):
        """`Suppliers` and `Related Services` are site furniture.

        They are rendered with the same heading classes as inventory sections
        and would otherwise appear as empty categories.
        """
        page = (
            '<h3 class="textLargest textWhite">Suppliers</h3>'
            '<img src="/imgs/flags/midblock/france.jpg">'
            '<h3 class="textLargest textDkGray">Fighters (3)</h3>'
            '<div class="acPanelFormatting" onclick="on(\'Rafale M\',\'desc, with comma\','
            "'/aircraft/imgs/med/rafale.jpg')\">"
            '<div class="numContainer"><span class="textWhite">3</span></div>'
            '<div class="nameContainer"><span class="textWhite textNormal">Rafale M</span></div>'
            '<div class="nameContainer"><span class="textSmall2 textWhite">Multirole</span></div>'
            "</div>"
            '<h3 class="textLargest textWhite">Related Services</h3>'
        )
        service = _legacy_service()
        result = parse_service_page(page, service)
        self.assertEqual(len(result["records"]), 1)
        self.assertEqual(result["records"][0]["category"], "Fighters")

    def test_legacy_totals_reconcile(self):
        """3 + 2 active must match the published 5, and each section its own."""
        self.assertEqual(self.result["warnings"], [])


if __name__ == "__main__":
    unittest.main()


