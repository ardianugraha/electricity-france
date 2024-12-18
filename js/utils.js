// TODO
// define functions here
function extractRegion(str) {
    if (str.includes("-")) {
        return str.substring(str.indexOf("-") + 1);
    }
    return str;
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
    dropdown.append("option").attr("value", "").text("Select region"); // Default option

    regions.forEach(region => {
        dropdown.append("option")
            .attr("value", region)
            .text(region);
    });

    // Initialize Select2
    $('#region-select').select2({
        placeholder: "Select region",
        allowClear: true
    });

    // Handle change event
    $('#region-select').on("change", function () {
        const selectedRegion = $(this).val();
        ctx.currentFilters.region = selectedRegion;
        updateFilter(ctx.currentFilters);
    });
};

function updateFilter(currentFilters) {
    const allEnergyTypes = Object.keys(ctx.sitesMap.reduce((types, site) => {
        types[site.energy_type] = true;
        return types;
    }, {}));

    const filteredSites = ctx.sitesMap.filter(d => 
        d.sum_max_power_installed >= ctx.currentFilters.minPower &&
        d.sum_max_power_installed <= ctx.currentFilters.maxPower &&
        (ctx.currentFilters.energyType.length === 0 || ctx.currentFilters.energyType.includes(d.energy_type))
    );

    // allEnergyTypes.forEach(type => {
    //     const normalizedType = type.replace(/\s+/g, '-'); // Normalize type to match the class
    //     const shouldShow =
    //         currentFilters.energyType.length === 0 || // No filter applied
    //         currentFilters.energyType.includes(type);

    //     // update map
    //     d3.selectAll(`circle.${normalizedType}`)
    //         .style("opacity", shouldShow ? 0.7 : 0)
    //         .style("pointer-events", shouldShow ? "auto" : "none");
    // });
    plotSites();
    // update treemap
    drawTreeMapSite(ctx.sitesMap, currentFilters);
    drawTreeMapProd(ctx.prodRegion, currentFilters);
    // drawLineChart(currentFilters);
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
            <div style="margin-top: 2px;">${siteDetails}</div>
        `)
        .style("visibility", "visible");
};

function showRegionTooltip(region, x, y) {
    const tooltip = d3.select("#tooltip");
    tooltip.style("left", `${x + 10}px`)
        .style("top", `${y + 10}px`)
        .html(`
            <strong>${ctx.regionLookup.codeToName[region]}</strong>
        `)
        .style("visibility", "visible");
};
function hideTooltip() {
    const tooltip = d3.selectAll("#tooltip");
    tooltip.style("visibility", "hidden");
};

const findStr = (arr, str) => arr.some(e => e.toLowerCase().search(str.toLowerCase()) !== -1)

function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

function handleRegionClick(regionCode) {
    const regionName = ctx.regionLookup.codeToName[regionCode];
    ctx.currentFilters.region = regionName;

    // Update dropdown to match the clicked region
    $('#region-select').val(regionName).trigger('change');

    // Update treemap and other visuals
    updateFilter(ctx.currentFilters);
}

function drawTreeMap(hierarchyData, elementId) {
    d3.select(elementId).selectAll("*").remove();

    // Specify dimensions
    const width = 300;
    const height = 280;
  
    // Compute treemap layout
    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
  
    d3.treemap()
        .tile(d3.treemapSquarify)
        .size([width, height])
        .padding(1)
        .round(true)(root);
  
    // Create SVG container
    const svg = d3.select(elementId)
        .html("")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .attr("style", "font: 10px sans-serif;");
  
    // Create a group for each leaf node
    const leaf = svg.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);
  
    // Add rectangles
    leaf.append("rect")
        .attr("fill", d => ctx.colorMapping[d.data.name])
        .attr("fill-opacity", 0.6)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .style("opacity", 0)
        .transition()
        .duration(500)
        .style("opacity", 1);
    
    if (elementId == "#treeMapSite") {
        unit = "GW" // unit of generator
    } else {
        unit = "GWh" // unit of production
    }
    // Add tooltips
    leaf.append("title")
        .text(d => `${d.data.name}\n${d.data.value.toFixed(2)} ${unit}`);
  
    // Add text labels
    leaf.append("text")
        .selectAll("tspan")
        .data(d => [d.data.name, `${d.data.percentage.toFixed(2)}%`])
        .join("tspan")
        .attr("x", 3)
        .attr("y", (d, i) => `${1.1 + i * 0.9}em`)
        .attr("fill-opacity", (d, i) => i === 1 ? 0.7 : null)
        .text(d => d);
};

function controlFromInput(fromSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#1a1d21', controlSlider);
    if (from > to) {
        fromSlider.value = to;
        fromInput.value = to;
    } else {
        fromSlider.value = from;
    }
    ctx.currentFilters.minPower = from;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}
    
function controlToInput(toSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#1a1d21', controlSlider);
    setToggleAccessible(toInput);
    if (from <= to) {
        toSlider.value = to;
        toInput.value = to;
    } else {
        toInput.value = from;
    }
    ctx.currentFilters.maxPower = to;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}

function controlFromSlider(fromSlider, toSlider, fromInput) {
    const [from, to] = getParsed(fromSlider, toSlider);
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#1a1d21', toSlider);
    if (from > to) {
        fromSlider.value = to;
        fromInput.value = to;
    } else {
        fromInput.value = from;
    }
    ctx.currentFilters.minPower = from;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}

function controlToSlider(fromSlider, toSlider, toInput) {
    const [from, to] = getParsed(fromSlider, toSlider);
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#1a1d21', toSlider);
    setToggleAccessible(toSlider);
    if (from <= to) {
        toSlider.value = to;
        toInput.value = to;
    } else {
        toInput.value = from;
        toSlider.value = from;
    }
    ctx.currentFilters.maxPower = to;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}

function getParsed(currentFrom, currentTo) {
    const from = parseInt(currentFrom.value, 10);
    const to = parseInt(currentTo.value, 10);
    return [from, to];
}

function fillSlider(from, to, sliderColor, rangeColor, controlSlider) {
    const rangeDistance = to.max-to.min;
    const fromPosition = from.value - to.min;
    const toPosition = to.value - to.min;
    controlSlider.style.background = `linear-gradient(
        to right,
        ${sliderColor} 0%,
        ${sliderColor} ${(fromPosition)/(rangeDistance)*100}%,
        ${rangeColor} ${((fromPosition)/(rangeDistance))*100}%,
        ${rangeColor} ${(toPosition)/(rangeDistance)*100}%, 
        ${sliderColor} ${(toPosition)/(rangeDistance)*100}%, 
        ${sliderColor} 100%)`;
}

function setToggleAccessible(currentTarget) {
    const toSlider = document.querySelector('#toSlider');
    if (Number(currentTarget.value) <= 0 ) {
        toSlider.style.zIndex = 2;
    } else {
        toSlider.style.zIndex = 0;
    }
}

function initializeRangeControls() {
    const [minCapacity, maxCapacity ] = d3.extent(ctx.sitesMap, d => d.sum_max_power_installed);

    // Select the sliders and inputs
    const fromSlider = document.querySelector('#fromSlider');
    const toSlider = document.querySelector('#toSlider');
    const fromInput = document.querySelector('#fromInput');
    const toInput = document.querySelector('#toInput');

    // Update the min and max attributes
    fromSlider.min = fromInput.min = minCapacity;
    fromSlider.max = fromInput.max = maxCapacity;
    toSlider.min = toInput.min = minCapacity;
    toSlider.max = toInput.max = maxCapacity;

    // Set the initial values
    fromSlider.value = fromInput.value = minCapacity;
    toSlider.value = toInput.value = maxCapacity;

    // Sync ctx.currentFilters
    ctx.currentFilters.minPower = minCapacity;
    ctx.currentFilters.maxPower = maxCapacity;

    // Initialize the slider fill and toggle accessibility
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#25daa5', toSlider);
    setToggleAccessible(toSlider);

    // Add event listeners for interactivity
    fromSlider.oninput = () => controlFromSlider(fromSlider, toSlider, fromInput);
    toSlider.oninput = () => controlToSlider(fromSlider, toSlider, toInput);
    fromInput.oninput = () => controlFromInput(fromSlider, fromInput, toInput, toSlider);
    toInput.oninput = () => controlToInput(toSlider, fromInput, toInput, toSlider);
}
