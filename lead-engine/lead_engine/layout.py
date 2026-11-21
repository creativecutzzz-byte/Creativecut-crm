"""Sheet layout: tabs, headers, dropdowns, frozen headers, filters, dashboard.

`layout_requests()` returns a spreadsheets.batchUpdate request list, used by
`init-sheet` (and was used to build the live Sheet).
"""

from __future__ import annotations

from .config import DEFAULT_SETTINGS, LEAD_STATUSES, QUEUE_STATUSES, SUPPRESSION_TYPES, TABS, VERIFY_STATUSES

SHEET_IDS = {"Dashboard": 0, "Leads": 101, "Outreach Queue": 102, "Suppression": 103, "Run Log": 104, "Settings": 105}
MARKETS = ["Delhi NCR", "India", "International"]
INK = {"red": 0.10, "green": 0.10, "blue": 0.12}
LIME = {"red": 0.80, "green": 0.95, "blue": 0.25}

DASHBOARD = [
    ["Creative Cut | Lead Generation & Outreach", "", ""],
    ["Metric", "Value", "How it's counted"],
    ["New leads", "=COUNTIF(Leads!C2:C,\"NEW\")", "Leads with Status NEW"],
    ["Qualified", "=COUNTIF(Leads!C2:C,\"QUALIFIED\")+COUNTIF(Leads!C2:C,\"READY\")", "Leads that passed intent, recency and exclusion rules"],
    ["Ready to send", "=COUNTIF('Outreach Queue'!K2:K,\"READY\")", "Outreach rows eligible for sending"],
    ["Needs review", "=COUNTIF('Outreach Queue'!K2:K,\"NEEDS_REVIEW\")+COUNTIF(Leads!C2:C,\"NEEDS_REVIEW\")", "Missing sample, contact, date or sourced detail"],
    ["Sent", "=COUNTIF('Outreach Queue'!M2:M,\"?*\")", "Rows with a Sent At time"],
    ["Sent today (IST)", "=COUNTIF('Outreach Queue'!M2:M,TEXT(TODAY(),\"yyyy-mm-dd\")&\"*\")", "Counts against DAILY_SEND_CAP"],
    ["Replied", "=COUNTIF('Outreach Queue'!K2:K,\"REPLIED\")", ""],
    ["Bounced", "=COUNTIF('Outreach Queue'!K2:K,\"BOUNCED\")", ""],
    ["Opted out", "=COUNTIF('Outreach Queue'!K2:K,\"OPTED_OUT\")", ""],
    ["Skipped", "=COUNTIF(Leads!C2:C,\"SKIPPED\")+COUNTIF('Outreach Queue'!K2:K,\"SKIPPED\")", "Duplicates, suppression, closed or manual skips"],
    ["Failed", "=COUNTIF('Outreach Queue'!K2:K,\"FAILED\")+COUNTIF(Leads!C2:C,\"FAILED\")", "See Last Error"],
    ["", "", ""],
    ["Sending mode", "=IF(UPPER(IFERROR(VLOOKUP(\"SENDING_ENABLED\",Settings!A:B,2,FALSE),\"FALSE\"))=\"TRUE\",\"LIVE\",\"DRY_RUN\")", "Settings → SENDING_ENABLED"],
    ["Daily cap", "=IFERROR(VLOOKUP(\"DAILY_SEND_CAP\",Settings!A:B,2,FALSE),10)", "Settings → DAILY_SEND_CAP"],
    ["Schedule (IST)", "=IFERROR(VLOOKUP(\"RUN_TIME_1\",Settings!A:B,2,FALSE)&\" and \"&VLOOKUP(\"RUN_TIME_2\",Settings!A:B,2,FALSE),\"\")", "Settings → RUN_TIME_1 / RUN_TIME_2"],
    ["Latest run", "=IFERROR(INDEX('Run Log'!A2:A,COUNTA('Run Log'!A2:A)),\"no runs yet\")", ""],
    ["Latest run finished", "=IFERROR(INDEX('Run Log'!C2:C,COUNTA('Run Log'!A2:A)),\"\")", ""],
    ["Latest run status", "=IFERROR(INDEX('Run Log'!I2:I,COUNTA('Run Log'!A2:A)),\"\")", ""],
    ["Latest run notes", "=IFERROR(INDEX('Run Log'!Q2:Q,COUNTA('Run Log'!A2:A)),\"\")", ""],
]


def _rng(tab, r0, r1, c0, c1):
    return {"sheetId": SHEET_IDS[tab], "startRowIndex": r0, "endRowIndex": r1, "startColumnIndex": c0, "endColumnIndex": c1}


def _dropdown(tab, col_name, values, rows=5000):
    c = TABS[tab].index(col_name)
    return {"setDataValidation": {"range": _rng(tab, 1, rows, c, c + 1), "rule": {
        "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": v} for v in values]}, "strict": False, "showCustomUi": True}}}


def rename_first_sheet() -> dict:
    return {"updateSheetProperties": {"properties": {"sheetId": 0, "title": "Dashboard"}, "fields": "title"}}


def layout_requests() -> list[dict]:
    req: list[dict] = []
    for tab, sid in SHEET_IDS.items():
        if sid != 0:
            req.append({"addSheet": {"properties": {"sheetId": sid, "title": tab, "gridProperties": {"rowCount": 1000, "columnCount": max(len(TABS[tab]), 8)}}}})
    for tab, hdr in TABS.items():
        if tab == "Dashboard":
            continue
        req.append({"updateCells": {"start": {"sheetId": SHEET_IDS[tab], "rowIndex": 0, "columnIndex": 0},
                    "rows": [{"values": [{"userEnteredValue": {"stringValue": h}} for h in hdr]}], "fields": "userEnteredValue"}})
        req.append({"repeatCell": {"range": _rng(tab, 0, 1, 0, len(hdr)), "cell": {"userEnteredFormat": {
            "textFormat": {"bold": True, "foregroundColorStyle": {"rgbColor": {"red": 1, "green": 1, "blue": 1}}},
            "backgroundColorStyle": {"rgbColor": INK}}}, "fields": "userEnteredFormat.textFormat,userEnteredFormat.backgroundColorStyle"}})
        req.append({"updateSheetProperties": {"properties": {"sheetId": SHEET_IDS[tab], "gridProperties": {"frozenRowCount": 1}}, "fields": "gridProperties.frozenRowCount"}})
        if tab in ("Leads", "Outreach Queue", "Suppression", "Run Log"):
            req.append({"setBasicFilter": {"filter": {"range": _rng(tab, 0, 1000, 0, len(hdr))}}})
        if "System Status" in hdr:
            c = hdr.index("System Status")
            req.append({"updateDimensionProperties": {"range": {"sheetId": SHEET_IDS[tab], "dimension": "COLUMNS", "startIndex": c, "endIndex": c + 1}, "properties": {"hiddenByUser": True}, "fields": "hiddenByUser"}})
    req += [
        _dropdown("Leads", "Status", LEAD_STATUSES),
        _dropdown("Leads", "Market", MARKETS),
        _dropdown("Leads", "Email Verification", VERIFY_STATUSES),
        _dropdown("Outreach Queue", "Status", QUEUE_STATUSES),
        _dropdown("Suppression", "Type", SUPPRESSION_TYPES),
    ]
    # Settings rows + TRUE/FALSE dropdowns
    rows = [[k, v, d] for k, v, d in DEFAULT_SETTINGS]
    req.append({"updateCells": {"start": {"sheetId": SHEET_IDS["Settings"], "rowIndex": 1, "columnIndex": 0},
                "rows": [{"values": [{"userEnteredValue": {"stringValue": x}} for x in r]} for r in rows], "fields": "userEnteredValue"}})
    for i, (k, _, _) in enumerate(DEFAULT_SETTINGS, start=1):
        if k in ("SENDING_ENABLED", "FOLLOWUPS_ENABLED"):
            req.append({"setDataValidation": {"range": _rng("Settings", i, i + 1, 1, 2), "rule": {
                "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "TRUE"}, {"userEnteredValue": "FALSE"}]}, "strict": True, "showCustomUi": True}}})
    # Dashboard
    def cell(v):
        return {"userEnteredValue": {"formulaValue": v}} if str(v).startswith("=") else {"userEnteredValue": {"stringValue": v}}
    req.append({"updateCells": {"start": {"sheetId": 0, "rowIndex": 0, "columnIndex": 0},
                "rows": [{"values": [cell(v) for v in r]} for r in DASHBOARD], "fields": "userEnteredValue"}})
    req.append({"repeatCell": {"range": _rng("Dashboard", 0, 1, 0, 3), "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 14}}}, "fields": "userEnteredFormat.textFormat"}})
    req.append({"repeatCell": {"range": _rng("Dashboard", 1, 2, 0, 3), "cell": {"userEnteredFormat": {"textFormat": {"bold": True}, "backgroundColorStyle": {"rgbColor": LIME}}}, "fields": "userEnteredFormat.textFormat,userEnteredFormat.backgroundColorStyle"}})
    req.append({"updateSheetProperties": {"properties": {"sheetId": 0, "gridProperties": {"frozenRowCount": 2}}, "fields": "gridProperties.frozenRowCount"}})
    for tab, widths in {"Dashboard": [220, 260, 360], "Settings": [260, 320, 520]}.items():
        for i, w in enumerate(widths):
            req.append({"updateDimensionProperties": {"range": {"sheetId": SHEET_IDS[tab], "dimension": "COLUMNS", "startIndex": i, "endIndex": i + 1}, "properties": {"pixelSize": w}, "fields": "pixelSize"}})
    return req
