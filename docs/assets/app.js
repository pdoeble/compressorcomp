const DATA_PATHS = {
  products: "data/products.json",
  summary: "data/summary.json",
};

const state = {
  products: [],
  summary: null,
  filters: {
    segment: "All",
    refrigerant: "All",
    quality: "All",
    confidence: "All",
    manufacturer: "All",
  },
  axes: {
    timeline: { x: "launch_or_public_year", y: "voltage_max_vdc" },
    bubble: { x: "voltage_max_vdc", y: "displacement_cc_rev" },
    capacity: { x: "displacement_cc_rev", y: "cooling_capacity_kw" },
    matrix: { x: "launch_or_public_year", y: "manufacturer" },
  },
};

const SELECTORS = {
  segment: document.querySelector("#segment-filter"),
  refrigerant: document.querySelector("#refrigerant-filter"),
  quality: document.querySelector("#quality-filter"),
  confidence: document.querySelector("#confidence-filter"),
  manufacturer: document.querySelector("#manufacturer-filter"),
};

const numberFields = [
  "launch_or_public_year",
  "displacement_cc_rev",
  "voltage_min_vdc",
  "voltage_max_vdc",
  "speed_min_rpm",
  "speed_max_rpm",
  "cooling_capacity_kw",
  "heating_capacity_kw",
  "electric_power_peak_kw",
  "electric_power_continuous_kw",
  "mass_kg",
  "length_mm",
  "diameter_mm",
];

const NUMERIC_AXIS_FIELDS = [
  { field: "launch_or_public_year", label: "Public year", title: "Public year", integer: true },
  { field: "voltage_min_vdc", label: "Min voltage [Vdc]", title: "Min voltage [Vdc]" },
  { field: "voltage_max_vdc", label: "Max voltage [Vdc]", title: "Max voltage [Vdc]" },
  { field: "displacement_cc_rev", label: "Displacement [cc/rev]", title: "Displacement [cc/rev]" },
  { field: "speed_min_rpm", label: "Min speed [rpm]", title: "Min speed [rpm]" },
  { field: "speed_max_rpm", label: "Max speed [rpm]", title: "Max speed [rpm]" },
  { field: "cooling_capacity_kw", label: "Cooling capacity [kW]", title: "Cooling capacity [kW]" },
  { field: "heating_capacity_kw", label: "Heating capacity [kW]", title: "Heating capacity [kW]" },
  { field: "electric_power_peak_kw", label: "Peak electric power [kW]", title: "Peak electric power [kW]" },
  {
    field: "electric_power_continuous_kw",
    label: "Continuous electric power [kW]",
    title: "Continuous electric power [kW]",
  },
  { field: "mass_kg", label: "Mass [kg]", title: "Mass [kg]" },
  { field: "length_mm", label: "Length [mm]", title: "Length [mm]" },
  { field: "diameter_mm", label: "Diameter [mm]", title: "Diameter [mm]" },
];

const DISCRETE_AXIS_FIELDS = [
  { field: "launch_or_public_year", label: "Public year", title: "Public year", type: "ordinal" },
  { field: "manufacturer", label: "Manufacturer", title: "Manufacturer", type: "nominal" },
  { field: "product_family", label: "Product family", title: "Product family", type: "nominal" },
  { field: "refrigerant_label", label: "Refrigerant", title: "Refrigerant", type: "nominal" },
  { field: "segment_label", label: "Segment mix", title: "Segment mix", type: "nominal" },
  { field: "source_quality", label: "Source quality", title: "Source quality", type: "nominal" },
  { field: "confidence", label: "Confidence", title: "Confidence", type: "nominal" },
  { field: "communication", label: "Communication", title: "Communication", type: "nominal" },
  { field: "primary_source_id", label: "Primary source", title: "Primary source", type: "nominal" },
  { field: "has_test_condition", label: "Has test basis", title: "Has test basis", type: "nominal" },
];

const NUMERIC_AXIS_BY_FIELD = Object.fromEntries(NUMERIC_AXIS_FIELDS.map((field) => [field.field, field]));
const DISCRETE_AXIS_BY_FIELD = Object.fromEntries(DISCRETE_AXIS_FIELDS.map((field) => [field.field, field]));

let resizeTimer = null;

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function optionLabel(value) {
  return value === "All" ? "All" : String(value).replaceAll("_", " ");
}

function populateSelect(select, values) {
  select.innerHTML = "";
  ["All", ...values].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = optionLabel(value);
    select.appendChild(option);
  });
}

function populateAxisSelect(select, fields, selected) {
  select.innerHTML = "";
  fields.forEach(({ field, label }) => {
    const option = document.createElement("option");
    option.value = field;
    option.textContent = label;
    option.selected = field === selected;
    select.appendChild(option);
  });
}

function initAxisControls() {
  [
    ["timeline", NUMERIC_AXIS_FIELDS],
    ["bubble", NUMERIC_AXIS_FIELDS],
    ["capacity", NUMERIC_AXIS_FIELDS],
    ["matrix", DISCRETE_AXIS_FIELDS],
  ].forEach(([chartId, fields]) => {
    const xSelect = document.querySelector(`#${chartId}-x-axis`);
    const ySelect = document.querySelector(`#${chartId}-y-axis`);
    populateAxisSelect(xSelect, fields, state.axes[chartId].x);
    populateAxisSelect(ySelect, fields, state.axes[chartId].y);

    xSelect.addEventListener("change", () => {
      state.axes[chartId].x = xSelect.value;
      render();
    });
    ySelect.addEventListener("change", () => {
      state.axes[chartId].y = ySelect.value;
      render();
    });
  });
}

function metricValue(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  return Number.isFinite(value) ? value.toLocaleString("en-US") : value;
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined) return "n/a";
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

function matchesFilters(product) {
  const { filters } = state;
  return (
    (filters.segment === "All" || product.segments.includes(filters.segment)) &&
    (filters.refrigerant === "All" || product.refrigerant_label === filters.refrigerant) &&
    (filters.quality === "All" || product.source_quality === filters.quality) &&
    (filters.confidence === "All" || product.confidence === filters.confidence) &&
    (filters.manufacturer === "All" || product.manufacturer === filters.manufacturer)
  );
}

function filteredProducts() {
  return state.products.filter(matchesFilters);
}

function initFilters() {
  populateSelect(SELECTORS.segment, state.summary.segments);
  populateSelect(SELECTORS.refrigerant, state.summary.refrigerants);
  populateSelect(SELECTORS.quality, ["A", "B", "C"]);
  populateSelect(SELECTORS.confidence, ["high", "medium", "low"]);
  populateSelect(SELECTORS.manufacturer, state.summary.manufacturers);

  Object.entries(SELECTORS).forEach(([key, select]) => {
    select.addEventListener("change", () => {
      state.filters[key] = select.value;
      render();
    });
  });
}

function renderMetrics(products) {
  const manufacturers = unique(products.map((product) => product.manufacturer));
  const withVoltage = products.filter((product) => product.voltage_max_vdc !== null).length;
  const withCapacity = products.filter((product) => product.cooling_capacity_kw !== null).length;
  const withConditions = products.filter((product) => product.has_test_condition).length;
  const qualityAorB = products.filter((product) => ["A", "B"].includes(product.source_quality)).length;

  const metrics = [
    ["Products", products.length],
    ["Manufacturers", manufacturers.length],
    ["Rows with max voltage", withVoltage],
    ["Rows with cooling capacity", withCapacity],
    ["A/B quality rows", qualityAorB],
    ["Rows with test basis", withConditions],
  ];

  document.querySelector("#metric-strip").innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric">
          <span>${label}</span>
          <strong>${metricValue(value)}</strong>
        </div>
      `,
    )
    .join("");
  document.querySelector("#comparison-note").textContent = state.summary.comparison_note;
}

function chartWidth(target) {
  const slot = document.querySelector(target);
  const panel = slot.closest(".chart-panel");
  const panelBox = panel.getBoundingClientRect();
  const styles = getComputedStyle(panel);
  const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  return Math.max(280, Math.floor(panelBox.width - horizontalPadding));
}

function chartBase(target) {
  return {
    width: chartWidth(target),
    background: "transparent",
    config: {
      axis: {
        labelColor: "#4d5458",
        titleColor: "#252a2d",
        gridColor: "#e3e7e4",
        tickColor: "#c8d0cc",
      },
      legend: {
        labelColor: "#3b4246",
        titleColor: "#252a2d",
        orient: "bottom",
      },
      view: { stroke: null },
    },
  };
}

function yearDomain() {
  const range = state.summary?.metric_ranges?.launch_or_public_year;
  const minYear = Number(range?.min ?? 2017);
  const maxYear = Number(range?.max ?? 2026);
  return [minYear - 1, maxYear + 1];
}

function yearTicks() {
  const [start, end] = yearDomain();
  const ticks = [];
  for (let year = start; year <= end; year += 1) {
    ticks.push(year);
  }
  return ticks;
}

function numericValuePresent(product, field) {
  return typeof product[field] === "number" && Number.isFinite(product[field]);
}

function axisTitle(field, fieldMap) {
  return fieldMap[field]?.title ?? field.replaceAll("_", " ");
}

function numericEncoding(field) {
  const encoding = {
    field,
    type: "quantitative",
    title: axisTitle(field, NUMERIC_AXIS_BY_FIELD),
    scale: { nice: true, zero: false },
  };

  if (field === "launch_or_public_year") {
    encoding.scale = { domain: yearDomain(), nice: false, zero: false };
    encoding.axis = { format: "d", tickMinStep: 1, values: yearTicks() };
  }

  return encoding;
}

function discreteEncoding(field, axis) {
  const definition = DISCRETE_AXIS_BY_FIELD[field] ?? {
    field,
    title: field.replaceAll("_", " "),
    type: "nominal",
  };
  const encoding = {
    field,
    type: definition.type,
    title: definition.title,
    sort: "ascending",
  };

  if (axis === "x" && field === "launch_or_public_year") {
    encoding.axis = { labelAngle: 0 };
  }

  return encoding;
}

function renderTimeline(products) {
  const target = "#timeline-chart";
  const axes = state.axes.timeline;
  const values = products.filter(
    (product) => numericValuePresent(product, axes.x) && numericValuePresent(product, axes.y),
  );
  const spec = {
    ...chartBase(target),
    height: 310,
    data: { values },
    mark: { type: "circle", size: 90, opacity: 0.82, tooltip: true },
    encoding: {
      x: numericEncoding(axes.x),
      y: numericEncoding(axes.y),
      color: {
        field: "manufacturer",
        type: "nominal",
        title: "Manufacturer",
        scale: { scheme: "tableau20" },
      },
      shape: {
        field: "source_quality",
        type: "nominal",
        title: "Quality",
      },
      tooltip: tooltipFields(),
    },
  };
  return vegaEmbed(target, spec, { actions: false, renderer: "svg" });
}

function renderBubble(products) {
  const target = "#bubble-chart";
  const axes = state.axes.bubble;
  const values = products
    .filter((product) => numericValuePresent(product, axes.x) && numericValuePresent(product, axes.y))
    .map((product) => ({
      ...product,
      capacity_size: product.cooling_capacity_kw ?? 2,
    }));

  const spec = {
    ...chartBase(target),
    height: 330,
    data: { values },
    mark: { type: "circle", opacity: 0.78, tooltip: true },
    encoding: {
      x: numericEncoding(axes.x),
      y: numericEncoding(axes.y),
      size: {
        field: "capacity_size",
        type: "quantitative",
        title: "Reported cooling [kW]",
        scale: { range: [45, 900] },
      },
      color: {
        field: "refrigerant_label",
        type: "nominal",
        title: "Refrigerant",
        scale: { scheme: "set2" },
      },
      shape: {
        field: "source_quality",
        type: "nominal",
        title: "Quality",
      },
      tooltip: tooltipFields(),
    },
  };
  return vegaEmbed(target, spec, { actions: false, renderer: "svg" });
}

function renderCapacity(products) {
  const target = "#capacity-chart";
  const axes = state.axes.capacity;
  const values = products.filter(
    (product) => numericValuePresent(product, axes.x) && numericValuePresent(product, axes.y),
  );
  const spec = {
    ...chartBase(target),
    height: 320,
    data: { values },
    mark: { type: "circle", size: 120, opacity: 0.82, tooltip: true },
    encoding: {
      x: numericEncoding(axes.x),
      y: numericEncoding(axes.y),
      color: {
        field: "manufacturer",
        type: "nominal",
        title: "Manufacturer",
        scale: { scheme: "tableau20" },
      },
      shape: {
        field: "has_test_condition",
        type: "nominal",
        title: "Test basis row",
      },
      tooltip: tooltipFields(),
    },
  };
  return vegaEmbed(target, spec, { actions: false, renderer: "svg" });
}

function renderMatrix(products) {
  const target = "#matrix-chart";
  const axes = state.axes.matrix;
  const values = products.filter(
    (product) =>
      product[axes.x] !== null &&
      product[axes.x] !== undefined &&
      product[axes.y] !== null &&
      product[axes.y] !== undefined &&
      numericValuePresent(product, "voltage_max_vdc"),
  );
  const yValueCount = unique(values.map((product) => String(product[axes.y]))).length || 1;
  const spec = {
    ...chartBase(target),
    height: Math.max(260, yValueCount * 28),
    data: { values },
    mark: { type: "rect", tooltip: true },
    encoding: {
      x: discreteEncoding(axes.x, "x"),
      y: discreteEncoding(axes.y, "y"),
      color: {
        aggregate: "max",
        field: "voltage_max_vdc",
        type: "quantitative",
        title: "Max Vdc",
        scale: { scheme: "tealblues" },
      },
      tooltip: [
        {
          field: axes.x,
          type: DISCRETE_AXIS_BY_FIELD[axes.x]?.type ?? "nominal",
          title: axisTitle(axes.x, DISCRETE_AXIS_BY_FIELD),
        },
        {
          field: axes.y,
          type: DISCRETE_AXIS_BY_FIELD[axes.y]?.type ?? "nominal",
          title: axisTitle(axes.y, DISCRETE_AXIS_BY_FIELD),
        },
        { aggregate: "max", field: "voltage_max_vdc", type: "quantitative", title: "Max Vdc" },
        { aggregate: "count", type: "quantitative", title: "Rows" },
      ],
    },
  };
  return vegaEmbed(target, spec, { actions: false, renderer: "svg" });
}

function tooltipFields() {
  return [
    { field: "variant_name", type: "nominal", title: "Variant" },
    { field: "manufacturer", type: "nominal", title: "Manufacturer" },
    { field: "launch_or_public_year", type: "quantitative", title: "Year" },
    { field: "voltage_max_vdc", type: "quantitative", title: "Max Vdc" },
    { field: "displacement_cc_rev", type: "quantitative", title: "cc/rev" },
    { field: "cooling_capacity_kw", type: "quantitative", title: "Cooling kW" },
    { field: "refrigerant_label", type: "nominal", title: "Refrigerant" },
    { field: "source_quality", type: "nominal", title: "Quality" },
    { field: "confidence", type: "nominal", title: "Confidence" },
  ];
}

function renderPanels() {
  const missing = state.summary.missing_fields;
  document.querySelector("#quality-panel").innerHTML = Object.entries(missing)
    .map(
      ([field, count]) => `
        <div class="quality-item">
          <span>${field.replaceAll("_", " ")}</span>
          <strong>${count}</strong>
          <small>missing rows</small>
        </div>
      `,
    )
    .join("");

  const quality = state.summary.source_quality_counts;
  const confidence = state.summary.confidence_counts;
  document.querySelector("#source-panel").innerHTML = [
    ...Object.entries(quality).map(([label, count]) => [`Quality ${label}`, count]),
    ...Object.entries(confidence).map(([label, count]) => [`Confidence ${label}`, count]),
  ]
    .map(
      ([label, count]) => `
        <div class="quality-item">
          <span>${label}</span>
          <strong>${count}</strong>
          <small>product rows</small>
        </div>
      `,
    )
    .join("");
}

function sourceCell(product) {
  if (!product.source_url) return product.primary_source_id || "n/a";
  return `<a href="${product.source_url}" target="_blank" rel="noreferrer">${product.primary_source_id}</a>`;
}

function testBasisCell(product) {
  if (!product.has_test_condition) return "No public row";
  return product.test_condition_count === 1 ? "1 row" : `${product.test_condition_count} rows`;
}

function renderTable(products) {
  const rows = products
    .slice()
    .sort((a, b) => {
      const year = (a.launch_or_public_year ?? 9999) - (b.launch_or_public_year ?? 9999);
      if (year !== 0) return year;
      return a.manufacturer.localeCompare(b.manufacturer);
    })
    .map(
      (product) => `
        <tr>
          <td>
            <strong>${product.variant_name}</strong>
            <span>${product.application_summary ?? ""}</span>
          </td>
          <td>${product.manufacturer}</td>
          <td>${metricValue(product.launch_or_public_year)}</td>
          <td>${product.segment_label ?? "n/a"}</td>
          <td>${product.refrigerant_label}</td>
          <td>${formatNumber(product.voltage_max_vdc)}</td>
          <td>${formatNumber(product.displacement_cc_rev)}</td>
          <td>${formatNumber(product.cooling_capacity_kw)}</td>
          <td><span class="badge">${product.source_quality}/${product.confidence}</span></td>
          <td>${testBasisCell(product)}</td>
          <td>${sourceCell(product)}</td>
          <td>${product.notes ?? ""}</td>
        </tr>
      `,
    )
    .join("");

  document.querySelector("#product-table").innerHTML = rows;
  document.querySelector("#table-count").textContent = `${products.length} product rows match the current filter.`;
}

async function render() {
  const products = filteredProducts();
  renderMetrics(products);
  renderPanels();
  renderTable(products);

  await Promise.all([
    renderTimeline(products),
    renderBubble(products),
    renderCapacity(products),
    renderMatrix(products),
  ]);
}

async function loadData() {
  const [products, summary] = await Promise.all([
    fetch(DATA_PATHS.products).then((response) => response.json()),
    fetch(DATA_PATHS.summary).then((response) => response.json()),
  ]);

  state.products = products.map((product) => {
    const normalized = { ...product };
    numberFields.forEach((field) => {
      if (normalized[field] !== null && normalized[field] !== undefined) {
        normalized[field] = Number(normalized[field]);
      }
    });
    return normalized;
  });
  state.summary = summary;
  initFilters();
  initAxisControls();
  await render();
}

loadData().catch((error) => {
  document.body.classList.add("load-error");
  document.querySelector("main").innerHTML = `
    <section class="band">
      <div class="content">
        <h2>Data could not be loaded</h2>
        <p>${error.message}</p>
      </div>
    </section>
  `;
});

window.addEventListener("resize", () => {
  if (!state.summary) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    render();
  }, 180);
});
