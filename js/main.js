const ctx = {
    MAP_W: 1024,
    MAP_H: 1024,
    ATTRIB: '<a href="https://linkedin.com/in/ardianugraha">Nugraha</a> & <a href="https://linkedin.com/in/matin-zivdar">Zivdar</a> (<a href="https://www.enseignement.polytechnique.fr/informatique/CSC_51052/">CSC_51052_EP</a>) | Map &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, Data &copy; <a href="https://data.enedis.fr">Enedis</a> & <a href="https://odre.opendatasoft.com/">ODRE</a>',
    LFmap: null
};

function createViz() {
    console.log("Using D3 v" + d3.version);
    loadData();
    // TODO 
    // call draw functions here
};

function loadData() {
    const promise_files = [
        d3.json("datasets/prod-region-annuelle-filiere.geojson"),
        d3.json("datasets/production-electrique-par-filiere-a-la-maille-departement.geojson"),
        d3.csv("datasets/registre-national-installation-production-stockage-electricite grouped.csv"),
        d3.json("datasets/communes_france.json")
    ];

    Promise.all(promise_files).then(function (data) {
        const prod_region = data[0];
        const prod_dept = data[1];
        const sites = data[2];
        const communes = data[3];

        // console.log(sites);
        // console.log(prod_region);
        // console.log(prod_dept);
        // console.log(communes);

        /* Prepare map data of regions */
        ctx.mapRegions = {"type": "FeatureCollection", "features": []};
        prod_region.features.forEach(feature => {
            let region_code = feature.properties.code_insee_region
            let exists = ctx.mapRegions.features.some(i => i.properties.region_code == region_code);
            if(!exists) {
                ctx.mapRegions.features.push({
                    "type": "Feature",
                    "geometry": feature.geometry,
                    "properties": {
                        "region_code": region_code,
                        "region_name": feature.properties.region
                    }
                })
            };
        });
        // console.log(ctx.mapRegions);

        ctx.mapDepts = {features: []};
        prod_dept.features.filter(feature => feature.geometry != null).forEach(feature => {
            let dept_code = feature.properties.code_departement
            let exists = ctx.mapDepts.features.some(i => i.properties.dept_code == dept_code);
            if(!exists) {
                ctx.mapDepts.features.push({
                    "type": "Feature",
                    "geometry": feature.geometry,
                    "properties": {
                        "dept_code": dept_code,
                        "region_code": feature.properties.code_region,
                        "dept_name": feature.properties.nom_departement,
                        "region_name": feature.properties.nom_region
                    }
                })
            }
        });
        // console.log(ctx.mapDepts);

        /* Prepare generator sites data with long lat */
        const lookup = new Map(communes.map(row => [row.code, { long: row.centre.coordinates[0], lat: row.centre.coordinates[1] }]));
        ctx.sitesMap = sites.map(row => {
            const coordinates = lookup.get(row.codeINSEECommune);
            return coordinates 
                ? { code: row.codeINSEECommune,
                    commune: row.commune,
                    energy_type: row.filiere,
                    sum_max_power_installed: parseFloat(row.sum_puisMaxInstallee),
                    sum_nb_installation: row.sum_nbInstallations,
                    long: coordinates.long, 
                    lat: coordinates.lat }
                : null;
        })
        .filter(row => 
            row !== null && 
            !['Autre', 'Stockage non hydraulique', 'Thermique non renouvelable'].includes(row.energy_type) &&
            row.sum_max_power_installed >= 1000 // filter sum_max_power_installed < 1000 kW
        );

        console.log(ctx.sitesMap);

        drawMap();
        
    }).catch(function (error) { console.log(error) });
};

function drawMap() {
    //TODO
    // draw France map with its regions
    ctx.LFmap = L.map('mapContainer', {
        minZoom: 6, // Minimum zoom level to avoid zooming too far out
        maxZoom: 12, // Maximum zoom level
        maxBoundsViscosity: 1, // Ensures the map sticks within the bounds
    });

    L.DomUtil.addClass(ctx.LFmap._container, 'crosshair-cursor-enabled');

    L.esri.basemapLayer("Gray", {
        detectRetina: true,
        attribution: ctx.ATTRIB
    }).addTo(ctx.LFmap);

    ctx.LFmap.setView([46.603354, 1.888334], 6); // Center on France with a zoom level of 6

    const regionLayer = L.geoJson(ctx.mapRegions, {
        style: style,
        onEachFeature: function(feature, layer) {
            layer.on({
                mouseover: function(e) {
                    if (!isMouseOverSite) {
                        highlightFeature(e);
                    }
                },
                mouseout: function(e) {
                    resetHighlight(e);
                },
                click: function(e) {
                    zoomToFeature(e);
                }
            });
        }
    }).addTo(ctx.LFmap);

    L.svg().addTo(ctx.LFmap);
    let svgEl = d3.select("#mapContainer").select("svg");
    svgEl.select("g").attr("id", "sites");

    plotSites();
    ctx.LFmap.on('zoom', function () { plotSites(); });

};

function style(feature) {
    return {
        fillColor: "lightyellow",
        weight: 2,
        opacity: 1,
        color: "white",
        dashArray: '3',
        fillOpacity: 0.3
    };
};

function zoomToFeature(e) {
    const layer = e.target;
    ctx.LFmap.fitBounds(layer.getBounds());
};

function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
        fillColor: "lightyellow",
        weight: 2,
        opacity: 1,
        color: "#666",
        dashArray: '3',
        fillOpacity: 0.3
    });
    layer.bringToFront();

};

function resetHighlight(e) {
    const layer = e.target;
    layer.setStyle({
        fillColor: "lightyellow",
        weight: 2,
        opacity: 1,
        color: "white",
        dashArray: '3',
        fillOpacity: 0.3
    });
    layer.bringToBack();
};

let isMouseOverSite = false;

function onSiteMouseOver() {
    isMouseOverSite = true;
}

function onSiteMouseOut() {
    isMouseOverSite = false;
}

function plotSites() {
    const colorMapping = {
        "Bioénergies": "#6B3F2A",   // Dark brown
        "Energie Marines": "#003366", // Dark blue
        "Eolien": "#87CEEB",         // Sky blue
        "Géothermie": "#FFA500",     // Orange
        "Hydraulique": "#4682B4",    // Steel blue
        "Nucléaire": "#D32F2F",      // Red
        "Solaire": "#FFD700"         // Yellow
    };

    let maxPowerExt = d3.extent(ctx.sitesMap, d => d.sum_max_power_installed);

    ctx.rScale = d3.scaleLog()
        .domain(maxPowerExt)
        .range([1, 12]);

    let siteSelection = d3.select("g#sites")
        .selectAll("circle")
        .data(ctx.sitesMap);

    // Enter: Add new circles for sites
    siteSelection.enter()
        .append("circle")
        .attr("cx", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).x)
        .attr("cy", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).y)
        .attr("r", d => ctx.rScale(d.sum_max_power_installed))
        .style("fill", d => colorMapping[d.energy_type])
        .style("opacity", 0.7)
        .style("pointer-events", "auto") 
        .on("mouseover", onSiteMouseOver) // Detect when mouse is over a site
        .on("mouseout", onSiteMouseOut)
        .on("click", function(event, d) {
            event.stopPropagation();
            console.log("site clicked:", d);
        });

    // Update: Adjust positions and sizes
    siteSelection
        .attr("cx", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).x)
        .attr("cy", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).y)
        .attr("r", d => ctx.rScale(d.sum_max_power_installed));

    siteSelection.exit().remove();
};

function drawSankey() {

};

function drawRegression() {

};

function drawCapDistribution() {

};