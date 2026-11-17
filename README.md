# WasteLink

## Problem

Reusable and recyclable materials are often difficult for nearby recyclers to find and collect. WasteLink connects people reporting recyclable waste with recyclers who can schedule and complete a collection. In South African cities like Cape Town, recyclable waste is often dumped illegally while informal waste pickers and small recyclers struggle to find enough material.

## Target user

Community members, households, small businesses, and local recyclers using a mobile phone, including people with limited data or lower-end Android devices.

## How to run

Open `index.html` in a modern browser. Keep `styles.css` and `app.js` in the same folder. An internet connection is needed for the Leaflet map tiles; report data is saved in the browser's local storage.

## How to use WasteLink

### Report and track waste

1. Open the **Report waste** tab and enter a short title, category, estimated amount, and description. Choose whether the amount is in kilograms or bags.
2. Choose a collection point with **Use my GPS** or tap the map. Add a phone number if you want to share one.
3. Select **Save report**. The report gets a unique reference and starts with **Available** status. Suggested receivers are: e-waste → E-waste recycler; paper/cardboard → Paper recycler; metals → Metal recycler; plastics → Plastic recycler; batteries → Battery handler; illegal dumping → Municipality; hazardous → Hazardous waste facility; other → Waste collector.
4. To check progress, enter the reference in **Track report** and select **Check status**.

### Receive and collect waste

1. Open the **Receive waste** tab and choose an organisation type. Only reports routed to that receiver type are shown; use the category filter to narrow the list further. Reports are sorted by distance from your GPS location; without GPS, the app uses central Cape Town.
2. Select **Claim** on an available report, then enter the recycler name and collection date. Its status changes to **Scheduled**.
3. After pickup, select **Mark collected** and enter the actual weight in kg. Its status changes to **Completed**.

The map uses marker colours to show Available, Scheduled, and Completed reports. The dashboard counts reports by status and shows estimated kg separately from actual collected kg. Only estimates entered in kg count toward estimated kg totals; bag counts are not converted. Three Cape Town reports marked **DEMO** are included for trying the workflow.

Reports are stored in the current browser's local storage, so they are not automatically shared with other devices or users.

## Roadmap

- Admin workspace
- Organisation registration
- Photos on waste reports
- Satellite hotspot detection

## Low-token build

One main prompt plus one update prompt described the app and its core workflow.
The HTML, styles, and app logic are kept in three small, easy-to-edit files.
No frameworks or build tools; only Leaflet and OpenStreetMap are loaded via CDN.
