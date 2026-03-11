/**
 * AE Metadata Exporter for VideoCompositor Pro
 * 
 * Exports transform data (position, scale, opacity) of layers 
 * starting with "template_" to a JSON file.
 * 
 * Usage:
 * 1. Name your placeholder layers "template_character", "template_bg", etc.
 * 2. Run this script.
 * 3. Use the generated template.json in the VideoCompositor Pro web tool.
 */

(function exportTEMPLATEMetadata() {
    var project = app.project;
    if (!project) {
        alert("Please open a project first.");
        return;
    }

    var comp = project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Please select a composition.");
        return;
    }

    var templateData = {
        version: "1.0",
        comp: {
            name: comp.name,
            width: comp.width,
            height: comp.height,
            duration: comp.duration,
            frameRate: comp.frameRate
        },
        layers: []
    };

    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        // Only export layers named "template_..."
        if (layer.name.toLowerCase().indexOf("template_") === 0) {
            var transform = layer.transform;

            var layerInfo = {
                name: layer.name,
                index: layer.index,
                width: layer.width,
                height: layer.height,
                position: transform.position.value,
                scale: transform.scale.value,
                opacity: transform.opacity.value,
                anchorPoint: transform.anchorPoint.value
            };

            templateData.layers.push(layerInfo);
        }
    }

    if (templateData.layers.length === 0) {
        alert("No layers starting with 'template_' were found.");
        return;
    }

    // Save File Dialog
    var jsonFile = File.saveDialog("Save Template Metadata", "JSON:*.json");
    if (jsonFile) {
        jsonFile.open("w");
        jsonFile.write(JSON.stringify(templateData, null, 4));
        jsonFile.close();
        alert("Successfully exported template metadata for " + templateData.layers.length + " layers.");
    }
})();
