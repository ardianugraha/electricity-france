// TODO
// define functions here
function extractRegion(str) {
    return str.split('-').pop();
  }

const createFilter = (key, param, container) => {
    const filterButton = document.createElement("button");
    filterButton.className = "filter-button";
    filterButton.innerText = param;
    filterButton.setAttribute("data-state", "inactive");
    filterButton.addEventListener("click", (e) =>
        handleButtonClick(e, key, param, container)
    );

    container.append(filterButton);
};

const handleButtonClick = (e, key, param, container) => {
    const button = e.target;
    const buttonState = button.getAttribute("data-state");

    if (buttonState == "inactive") {
        button.classList.add("is-active");
        button.setAttribute("data-state", "active");
        ctx.currentFilters[key].push(param);
    } else {
        button.classList.remove("is-active");
        button.setAttribute("data-state", "inactive");
        ctx.currentFilters[key] = ctx.currentFilters[key].filter((item) => item !== param);
    }

    updateFilter(ctx.currentFilters);
};

function populateRegionDropdown(data) {
    // Extract unique regions
    const regions = [...new Set(data.features.map(d => d.properties.region_name))].sort();

    // Populate the dropdown
    const dropdown = d3.select("#region-select");
    dropdown.append("option").attr("value", "").text("Select a Region"); // Default option

    regions.forEach(region => {
        dropdown.append("option")
            .attr("value", region)
            .text(region);
    });

    // Initialize Select2
    $('#region-select').select2({
        placeholder: "Search for a region",
        allowClear: true
    });

    // Handle change event
    $('#region-select').on("change", function () {
        const selectedRegion = $(this).val();
        console.log(selectedRegion);
        ctx.currentFilters.region = selectedRegion;
        updateFilter(ctx.currentFilters);
        // filterByRegion(selectedRegion);
    });
};

function updateFilter(currentFilters) {
    const allEnergyTypes = Object.keys(ctx.sitesMap.reduce((types, site) => {
        types[site.energy_type] = true;
        return types;
    }, {}));

    allEnergyTypes.forEach(type => {
        const normalizedType = type.replace(/\s+/g, '-'); // Normalize type to match the class
        const shouldShow =
            currentFilters.energyType.length === 0 || // No filter applied
            currentFilters.energyType.includes(type);

        // update map
        d3.selectAll(`circle.${normalizedType}`)
            .style("opacity", shouldShow ? 0.7 : 0)
            .style("pointer-events", shouldShow ? "auto" : "none");
        // update treemap
        drawTreeMap(ctx.sitesMap, currentFilters);
    });
};

function groupSitesByCommune(sites) {
    return sites.reduce((acc, site) => {
        if (!acc[site.commune]) {
            acc[site.commune] = [];
        }
        acc[site.commune].push(site);
        return acc;
    }, {});
};

function showCommuneTooltip(commune, siteDetails, x, y) {
    const tooltip = d3.select("#tooltip");
    tooltip.style("left", `${x + 10}px`)
        .style("top", `${y + 10}px`)
        .html(`
            <strong>${commune}</strong>
            <div style="margin-top: 3px;">${siteDetails}</div>
        `)
        .style("visibility", "visible");
};

function hideTooltip() {
    const tooltip = d3.selectAll("#tooltip");
    tooltip.style("visibility", "hidden");
};

