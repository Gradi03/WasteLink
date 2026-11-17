    (() => {
      "use strict";

      const STORAGE_KEY = "wastelink-reports-v1";
      const CAPE_TOWN = [-33.9249, 18.4241];
      const CATEGORY_NAMES = {
        "e-waste": "E-waste",
        batteries: "Batteries",
        metals: "Metals",
        plastics: "Plastics",
        "paper/cardboard": "Paper/cardboard",
        "illegal-dumping": "Illegal dumping",
        hazardous: "Hazardous",
        other: "Other"
      };
      const RECEIVER_BY_CATEGORY = {
        "e-waste": "E-waste recycler",
        "paper/cardboard": "Paper recycler",
        metals: "Metal recycler",
        plastics: "Plastic recycler",
        batteries: "Battery handler",
        "illegal-dumping": "Municipality",
        hazardous: "Hazardous waste facility",
        other: "Waste collector"
      };
      const STATUS_COLORS = { Available: "#16834b", Scheduled: "#d68a00", Completed: "#5263aa" };
      const elements = {
        notice: document.getElementById("notice"),
        reportForm: document.getElementById("report-form"),
        trackForm: document.getElementById("track-form"),
        trackResult: document.getElementById("track-result"),
        reportLocationText: document.getElementById("report-location-text"),
        reportGps: document.getElementById("report-gps"),
        recyclerGps: document.getElementById("recycler-gps"),
        recyclerLocationText: document.getElementById("recycler-location-text"),
        receiverFilter: document.getElementById("receiver-filter"),
        categoryFilter: document.getElementById("category-filter"),
        reportList: document.getElementById("report-list"),
        resultsCount: document.getElementById("results-count"),
        dialog: document.getElementById("action-dialog"),
        actionForm: document.getElementById("action-form"),
        dialogFields: document.getElementById("dialog-fields"),
        dialogTitle: document.getElementById("dialog-title"),
        dialogError: document.getElementById("dialog-error")
      };
      let reports = [];
      let selectedLocation = null;
      let recyclerLocation = { lat: CAPE_TOWN[0], lng: CAPE_TOWN[1], isDefault: true };
      let reportMap = null;
      let recyclerMap = null;
      let reportLayer = null;
      let recyclerLayer = null;
      let actionReportId = null;
      let actionType = null;

      function showNotice(message) {
        elements.notice.textContent = message;
        elements.notice.hidden = false;
      }

      function hideNotice() {
        elements.notice.hidden = true;
        elements.notice.textContent = "";
      }

      function makeDemoReports() {
        const now = new Date();
        const future = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);
        return [
          {
            id: "WL-0001", title: "DEMO - Clean plastic bottles", category: "plastics", quantity: 12, unit: "kg",
            estimatedKg: 12, description: "Rinsed bottles in tied bags, ready for collection.", phone: "",
            lat: -33.9249, lng: 18.4241, status: "Available", createdAt: now.toISOString()
          },
          {
            id: "WL-0002", title: "DEMO - Small household batteries", category: "batteries", quantity: 2, unit: "kg",
            estimatedKg: 2, description: "Used household batteries stored in a sealed container.", phone: "",
            lat: -33.9324, lng: 18.4127, status: "Scheduled", recyclerName: "Cape Circular", collectionDate: future,
            createdAt: now.toISOString()
          },
          {
            id: "WL-0003", title: "DEMO - Cardboard boxes", category: "paper/cardboard", quantity: 4, unit: "bags",
            estimatedKg: null, description: "Flattened dry boxes. Bag quantity only; weight not estimated.", phone: "",
            lat: -33.9168, lng: 18.4328, status: "Completed", recyclerName: "Green Route",
            collectionDate: now.toISOString().slice(0, 10), actualKg: 18, createdAt: now.toISOString()
          }
        ];
      }

      function loadReports() {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored === null) {
            reports = makeDemoReports();
            saveReports();
            return;
          }
          const parsed = JSON.parse(stored);
          if (!Array.isArray(parsed)) throw new Error("Saved reports are not a list.");
          reports = parsed;
        } catch (error) {
          reports = [];
          showNotice("Saved reports could not be loaded. Check this browser's storage settings. " + error.message);
        }
      }

      function saveReports() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
          hideNotice();
          return true;
        } catch (error) {
          showNotice("Your change could not be saved on this device. Check available storage and browser settings. " + error.message);
          return false;
        }
      }

      function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
      }

      function formatWeight(value) {
        return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
      }

      function suggestedReceiver(category) {
        return RECEIVER_BY_CATEGORY[category] || RECEIVER_BY_CATEGORY.other;
      }

      function updateDashboard() {
        const available = reports.filter((report) => report.status === "Available").length;
        const scheduled = reports.filter((report) => report.status === "Scheduled").length;
        const completed = reports.filter((report) => report.status === "Completed").length;
        const estimated = reports.reduce((sum, report) => sum + (Number(report.estimatedKg) || 0), 0);
        const actual = reports.reduce((sum, report) => sum + (Number(report.actualKg) || 0), 0);
        document.getElementById("open-count").textContent = available;
        document.getElementById("scheduled-count").textContent = scheduled;
        document.getElementById("completed-count").textContent = completed;
        document.getElementById("estimated-total").textContent = formatWeight(estimated) + " kg";
        document.getElementById("actual-total").textContent = formatWeight(actual) + " kg";
      }

      function nextReference() {
        const maxNumber = reports.reduce((max, report) => {
          const match = /^WL-(\d+)$/.exec(report.id);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        return "WL-" + String(maxNumber + 1).padStart(4, "0");
      }

      function distanceKm(pointA, pointB) {
        const radians = (degrees) => degrees * Math.PI / 180;
        const latDelta = radians(pointB.lat - pointA.lat);
        const lngDelta = radians(pointB.lng - pointA.lng);
        const value = Math.sin(latDelta / 2) ** 2 +
          Math.cos(radians(pointA.lat)) * Math.cos(radians(pointB.lat)) * Math.sin(lngDelta / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
      }

      function statusBadge(status) {
        return '<span class="badge badge-' + status.toLowerCase() + '">' + escapeHTML(status) + "</span>";
      }

      function renderList() {
        const category = elements.categoryFilter.value;
        const receiver = elements.receiverFilter.value;
        const visible = reports
          .filter((report) => (category === "all" || report.category === category) &&
            (receiver === "all" || suggestedReceiver(report.category) === receiver))
          .map((report) => ({ report, distance: distanceKm(recyclerLocation, report) }))
          .sort((a, b) => a.distance - b.distance);
        elements.resultsCount.textContent = visible.length + (visible.length === 1 ? " report" : " reports");

        if (visible.length === 0) {
          elements.reportList.innerHTML = '<li class="empty-state">No reports match these filters yet.</li>';
          return;
        }

        elements.reportList.innerHTML = visible.map(({ report, distance }) => {
          const quantity = formatWeight(report.quantity) + " " + escapeHTML(report.unit);
          const distanceLabel = distance < 1 ? Math.round(distance * 1000) + " m away" : distance.toFixed(1) + " km away";
          const scheduleDetails = report.status === "Scheduled"
            ? "<br><strong>Recycler:</strong> " + escapeHTML(report.recyclerName) +
              "<br><strong>Collection:</strong> " + escapeHTML(report.collectionDate)
            : "";
          const collectedDetails = report.status === "Completed"
            ? "<br><strong>Recycler:</strong> " + escapeHTML(report.recyclerName) +
              "<br><strong>Actually collected:</strong> " + formatWeight(report.actualKg) + " kg"
            : "";
          const action = report.status === "Available"
            ? '<button class="button" type="button" data-action="claim" data-id="' + escapeHTML(report.id) + '">Claim</button>'
            : report.status === "Scheduled"
              ? '<button class="button" type="button" data-action="complete" data-id="' + escapeHTML(report.id) + '">Mark collected</button>'
              : "";
          return '<li class="report-card"><div class="card-heading"><div><h3>' + escapeHTML(report.title) +
            '</h3><p class="ref">' + escapeHTML(report.id) + " · " + distanceLabel + "</p></div>" +
            statusBadge(report.status) + '</div><p class="card-details"><strong>Category:</strong> ' +
            escapeHTML(CATEGORY_NAMES[report.category] || report.category) + "<br><strong>Estimated:</strong> " +
            quantity + "<br><strong>Suggested receiver:</strong> " + escapeHTML(suggestedReceiver(report.category)) +
            "<br>" + escapeHTML(report.description) + scheduleDetails + collectedDetails +
            (report.phone ? "<br><strong>Reporter phone:</strong> " + escapeHTML(report.phone) : "") +
            '</p><div class="card-actions">' + action + "</div></li>";
        }).join("");
      }

      function markerIcon(status) {
        return L.divIcon({
          className: "",
          html: '<span class="status-marker" style="display:block;width:20px;height:20px;background:' +
            (STATUS_COLORS[status] || STATUS_COLORS.Available) + '"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
      }

      function refreshMarkers() {
        if (recyclerLayer) recyclerLayer.clearLayers();
        if (reportLayer) reportLayer.clearLayers();
        const category = elements.categoryFilter.value;
        const receiver = elements.receiverFilter.value;
        reports.forEach((report) => {
          const label = "<strong>" + escapeHTML(report.title) + "</strong><br>" +
            escapeHTML(report.id) + " · " + escapeHTML(report.status) + "<br>Suggested receiver: " +
            escapeHTML(suggestedReceiver(report.category));
          const matchesFilters = (category === "all" || report.category === category) &&
            (receiver === "all" || suggestedReceiver(report.category) === receiver);
          if (recyclerLayer && matchesFilters) {
            L.marker([report.lat, report.lng], { icon: markerIcon(report.status) }).bindPopup(label).addTo(recyclerLayer);
          }
          if (reportLayer && selectedLocation === null) {
            L.marker([report.lat, report.lng], { icon: markerIcon(report.status) }).bindPopup(label).addTo(reportLayer);
          }
        });
        if (selectedLocation && reportLayer) {
          L.marker([selectedLocation.lat, selectedLocation.lng], { icon: markerIcon("Available") })
            .bindPopup("Selected collection location").addTo(reportLayer);
        }
      }

      function setSelectedLocation(lat, lng) {
        selectedLocation = { lat, lng };
        elements.reportLocationText.textContent = lat.toFixed(5) + ", " + lng.toFixed(5) + " selected";
        refreshMarkers();
      }

      function initializeMaps() {
        if (!window.L) {
          showNotice("The map library did not load. Check your internet connection and reload to use map selection.");
          return;
        }
        const reportContainer = document.getElementById("report-map");
        const recyclerContainer = document.getElementById("recycler-map");
        reportContainer.innerHTML = "";
        recyclerContainer.innerHTML = "";
        reportMap = L.map(reportContainer, { zoomControl: true, preferCanvas: true }).setView(CAPE_TOWN, 12);
        recyclerMap = L.map(recyclerContainer, { zoomControl: true, preferCanvas: true }).setView(CAPE_TOWN, 12);
        const tileOptions = {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        };
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", tileOptions).addTo(reportMap);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", tileOptions).addTo(recyclerMap);
        reportLayer = L.layerGroup().addTo(reportMap);
        recyclerLayer = L.layerGroup().addTo(recyclerMap);
        reportMap.on("click", (event) => setSelectedLocation(event.latlng.lat, event.latlng.lng));
        refreshMarkers();
      }

      function renderAll() {
        updateDashboard();
        renderList();
        refreshMarkers();
      }

      function requestLocation(onSuccess, button) {
        if (!navigator.geolocation) {
          showNotice("GPS is not available in this browser. You can tap the report map to choose a location.");
          return;
        }
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = "Finding location…";
        navigator.geolocation.getCurrentPosition(
          (position) => {
            button.disabled = false;
            button.textContent = originalText;
            hideNotice();
            onSuccess(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            button.disabled = false;
            button.textContent = originalText;
            const reason = error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : error.code === error.POSITION_UNAVAILABLE
                ? "Your location could not be determined."
                : "Location request timed out.";
            showNotice(reason + " You can still tap the map to set a report location.");
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
        );
      }

      function openAction(report, type) {
        actionReportId = report.id;
        actionType = type;
        elements.dialogError.textContent = "";
        const today = new Date().toISOString().slice(0, 10);
        if (type === "claim") {
          elements.dialogTitle.textContent = "Claim " + report.id;
          elements.dialogFields.innerHTML =
            '<div class="field"><label for="recycler-name">Recycler name</label>' +
            '<input id="recycler-name" name="recyclerName" maxlength="80" autocomplete="organization" required></div>' +
            '<div class="field"><label for="collection-date">Collection date</label>' +
            '<input id="collection-date" name="collectionDate" type="date" min="' + today + '" required></div>';
          document.getElementById("collection-date").value = today;
          document.getElementById("dialog-submit").textContent = "Schedule collection";
        } else {
          elements.dialogTitle.textContent = "Record collection for " + report.id;
          elements.dialogFields.innerHTML =
            '<div class="field"><label for="actual-weight">Actual collected weight (kg)</label>' +
            '<input id="actual-weight" name="actualKg" type="number" min="0.1" max="100000" step="0.1" inputmode="decimal" required></div>';
          document.getElementById("dialog-submit").textContent = "Mark collected";
        }
        elements.dialog.showModal();
      }

      function setTab(activeTab) {
        const reportTab = activeTab === "report";
        document.getElementById("report-tab").setAttribute("aria-selected", String(reportTab));
        document.getElementById("report-tab").tabIndex = reportTab ? 0 : -1;
        document.getElementById("recycler-tab").setAttribute("aria-selected", String(!reportTab));
        document.getElementById("recycler-tab").tabIndex = reportTab ? -1 : 0;
        document.getElementById("report-panel").hidden = !reportTab;
        document.getElementById("recycler-panel").hidden = reportTab;
        if (!reportTab) {
          requestAnimationFrame(() => {
            if (recyclerMap) recyclerMap.invalidateSize();
          });
        } else {
          requestAnimationFrame(() => {
            if (reportMap) reportMap.invalidateSize();
          });
        }
      }

      elements.trackForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const reference = String(new FormData(elements.trackForm).get("reference")).trim().toUpperCase();
        const report = reports.find((entry) => String(entry.id).toUpperCase() === reference);
        elements.trackResult.hidden = false;
        if (!report) {
          elements.trackResult.textContent = "No report found for " + reference + ". Check the reference and try again.";
          return;
        }
        elements.trackResult.innerHTML = "<strong>" + escapeHTML(report.id) + "</strong> · " +
          statusBadge(report.status) + "<br><strong>" + escapeHTML(report.title) +
          "</strong><br><strong>Suggested receiver:</strong> " +
          escapeHTML(suggestedReceiver(report.category));
      });

      elements.reportForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!selectedLocation) {
          showNotice("Choose a collection location with GPS or by tapping the map before saving.");
          document.getElementById("report-map").scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        const formData = new FormData(elements.reportForm);
        const quantity = Number(formData.get("quantity"));
        const unit = String(formData.get("unit"));
        const report = {
          id: nextReference(),
          title: String(formData.get("title")).trim(),
          category: String(formData.get("category")),
          quantity,
          unit,
          estimatedKg: unit === "kg" ? quantity : null,
          description: String(formData.get("description")).trim(),
          phone: String(formData.get("phone")).trim(),
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
          status: "Available",
          createdAt: new Date().toISOString()
        };
        if (!report.title || !report.description || !Number.isFinite(quantity) || quantity <= 0) {
          showNotice("Add a valid title, description, and estimated quantity.");
          return;
        }
        reports.push(report);
        if (!saveReports()) {
          reports.pop();
          return;
        }
        elements.reportForm.reset();
        selectedLocation = null;
        elements.reportLocationText.textContent = "No location selected yet.";
        renderAll();
        showNotice("Report " + report.id + " saved as Available.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      elements.reportGps.addEventListener("click", () => requestLocation((lat, lng) => {
        setSelectedLocation(lat, lng);
        if (reportMap) reportMap.setView([lat, lng], 15);
      }, elements.reportGps));

      elements.recyclerGps.addEventListener("click", () => requestLocation((lat, lng) => {
        recyclerLocation = { lat, lng, isDefault: false };
        elements.recyclerLocationText.textContent = lat.toFixed(5) + ", " + lng.toFixed(5) + " · distance sorted from your GPS";
        renderList();
        if (recyclerMap) recyclerMap.setView([lat, lng], 13);
      }, elements.recyclerGps));

      elements.categoryFilter.addEventListener("change", () => {
        renderList();
        refreshMarkers();
      });
      elements.receiverFilter.addEventListener("change", () => {
        renderList();
        refreshMarkers();
      });
      elements.reportList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const report = reports.find((entry) => entry.id === button.dataset.id);
        if (!report) return;
        openAction(report, button.dataset.action);
      });

      elements.actionForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const report = reports.find((entry) => entry.id === actionReportId);
        if (!report) {
          elements.dialogError.textContent = "This report could not be found. Close this window and try again.";
          return;
        }
        const formData = new FormData(elements.actionForm);
        if (actionType === "claim") {
          const recyclerName = String(formData.get("recyclerName")).trim();
          const collectionDate = String(formData.get("collectionDate"));
          if (!recyclerName || !collectionDate || collectionDate < new Date().toISOString().slice(0, 10)) {
            elements.dialogError.textContent = "Enter a recycler name and a valid current or future collection date.";
            return;
          }
          report.recyclerName = recyclerName;
          report.collectionDate = collectionDate;
          report.status = "Scheduled";
        } else {
          const actualKg = Number(formData.get("actualKg"));
          if (!Number.isFinite(actualKg) || actualKg <= 0) {
            elements.dialogError.textContent = "Enter an actual collected weight greater than zero.";
            return;
          }
          report.actualKg = actualKg;
          report.status = "Completed";
        }
        if (!saveReports()) {
          if (actionType === "claim") {
            delete report.recyclerName;
            delete report.collectionDate;
            report.status = "Available";
          } else {
            delete report.actualKg;
            report.status = "Scheduled";
          }
          return;
        }
        elements.dialog.close();
        renderAll();
        showNotice(actionType === "claim" ? report.id + " scheduled for collection." : report.id + " marked collected.");
      });

      document.getElementById("dialog-cancel").addEventListener("click", () => elements.dialog.close());
      document.getElementById("report-tab").addEventListener("click", () => setTab("report"));
      document.getElementById("recycler-tab").addEventListener("click", () => setTab("recycler"));
      document.querySelector(".tabs").addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const nextTab = event.target.id === "report-tab" ? "recycler" : "report";
        setTab(nextTab);
        document.getElementById(nextTab + "-tab").focus();
      });

      loadReports();
      renderAll();
      initializeMaps();
    })();
