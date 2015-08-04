/**
 * DataViewer class
 *
 * @author Aaron Ponti
 *
 */

/**
 * A viewer to display DataModel entities to the html page.
 */
function DataViewer() {

    "use strict";

}
/**
 * Displays experiment info
 *
 * @param exp openBIS Experiment object
 */
DataViewer.prototype.displayExperimentInfo = function(exp) {

    // Display the experiment name
    $("#experimentNameView").html("<h2>" + exp.properties[DATAMODEL.EXPERIMENT_PREFIX + "_EXPERIMENT_NAME"] + "</h2>");

    // Display the experiment info
    var detailView = $("#detailView");
    detailView.empty();

    var experimentTagView = $("#experimentTagView");
    experimentTagView.empty();

    var experimentDescriptionView = $("#experimentDescriptionView");
    experimentDescriptionView.empty();

    var experimentAcquisitionDetailsView = $("#experimentAcquisitionDetailsView");
    experimentAcquisitionDetailsView.empty();

    // Get metaprojects (tags)
    var metaprojects = "";
    if (exp.metaprojects) {
        if (exp.metaprojects.length == 0) {
            metaprojects = "<i>None</i>";
        } else if (exp.metaprojects.length == 1) {
            metaprojects = exp.metaprojects[0].name;
        } else {
            for (var i = 0; i < exp.metaprojects.length; i++) {
                if (i < (exp.metaprojects.length - 1)) {
                    metaprojects = metaprojects.concat(exp.metaprojects[i].name + ", ");
                } else {
                    metaprojects = metaprojects.concat(exp.metaprojects[i].name);
                }
            }
        }
    }
    experimentTagView.append(this.prepareTitle("Tags", "info"));
    experimentTagView.append($("<p>").html(metaprojects));

    // Display the experiment description
    var description = exp.properties[DATAMODEL.EXPERIMENT_PREFIX + "_EXPERIMENT_DESCRIPTION"];
    if (undefined === description || description == "") {
        description = "<i>No description provided.</i>";
    }
    experimentDescriptionView.append(this.prepareTitle("Description"));
    experimentDescriptionView.append($("<p>").html(description));

    // Display the acquisition details
    var acqDate = exp.properties[DATAMODEL.EXPERIMENT_PREFIX + "_EXPERIMENT_DATE"];

    var acqDetails = "<p>" +
        exp.properties[DATAMODEL.EXPERIMENT_PREFIX + "_EXPERIMENT_ACQ_SOFTWARE"] + " on " +
        exp.properties[DATAMODEL.EXPERIMENT_PREFIX + "_EXPERIMENT_ACQ_HARDWARE"] + " (acquisition by " +
        exp.properties[DATAMODEL.EXPERIMENT_PREFIX + "_EXPERIMENT_OWNER"] + " on " +
        acqDate.substring(0, 10) + ").</p>";

    experimentAcquisitionDetailsView.append(this.prepareTitle("Acquisition details"));
    experimentAcquisitionDetailsView.append($("<p>").html(acqDetails));

};

/**
 * Draw the initial root structure. The tree will then be extended
 * dynamically (via lazy loading) using DynaTree methods.
 *
 * @param tree DynaTree object
 */
DataViewer.prototype.drawTree = function(tree) {

    // Display the tree
    $("#treeView").dynatree(tree);

};

/**
 * Display the node details and the actions associated with it
 * @param {Object} node from the DynaTree model
 */
DataViewer.prototype.displayDetailsAndActions = function(node) {

    // In theory, an unselectable node should not be selectable
    // - we build in an additional check here
    if (node.data.unselectable === true) {
        return;
    }

    // Store some references
    var statusID = $("#status");
    var detailViewActionID = $("#detailViewAction");
    var detailViewSampleID = $("#detailViewSample");

    // Clear previous views
    statusID.empty();
    detailViewActionID.empty();
    detailViewSampleID.empty();

    // Display the node name
    detailViewSampleID.append($("<h4>").html(node.data.title));

    // Adapt the display depending on the element type
    if (node.data.element) {

        // Samples
        switch (node.data.element["@type"]) {

            case "Sample":

                if (node.data.element.sampleTypeCode == (DATAMODEL.EXPERIMENT_PREFIX + "_PLATE")) {

                    // Update details
                    detailViewSampleID.append(this.prepareTitle("Plate geometry"));
                    detailViewSampleID.append($("<p>").html(node.data.element.properties[DATAMODEL.EXPERIMENT_PREFIX + "_PLATE_GEOMETRY"]));

                }

                // This code is specific for the BD FACS ARIA sorter
                if (node.data.element.sampleTypeCode == "FACS_ARIA_WELL" ||
                    node.data.element.sampleTypeCode == "FACS_ARIA_TUBE") {

                    var sortType = "Standard sort";
                    if (node.data.element.properties[node.data.element.sampleTypeCode + "_ISINDEXSORT"] == "true") {
                        sortType = "Index sort";
                    }
                    detailViewSampleID.append(this.prepareTitle(sortType));
                }

                break;

            case "DataSet":

                if (node.data.element.dataSetTypeCode == (DATAMODEL.EXPERIMENT_PREFIX + "_FCSFILE")) {

                    // Old experiments might not have anything stored in {exo_prefix}_FCSFILE_PARAMETERS.
                    if (!node.data.element.properties[DATAMODEL.EXPERIMENT_PREFIX + "_FCSFILE_PARAMETERS"]) {
                        break;
                    }

                    // Retrieve and store the parameter information
                    DATAMODEL.getAndAddParemeterInfoForDatasets(node, function() {

                        // Display the form to be used for parameter plotting
                        DATAVIEWER.renderParameterSelectionForm(node);

                    });

                }
                break;

        }
    }

    // Display the export action
    this.displayExportAction(node);

    // Display the download action
    this.displayDownloadAction(node);

};

/**
 * Build and display the code to trigger the server-side aggregation
 * plugin 'copy_datasets_to_userdir'
 * @param node: DataTree node
 */
DataViewer.prototype.displayExportAction = function(node) {

    // Get the type and identifier of the element associated to the node. 
    // If the node is associated to a specimen, the type and identifier
    // will instead be those of the parent node.
    var type = "";
    var identifier = "";
    var specimenName = "";
    var experimentId = null;

    // Get element type and code
    if (node.data.element) {

        // Get type
        switch (node.data.element["@type"]) {
            case "Experiment":
                experimentId = node.data.element.identifier;
                type = node.data.element.experimentTypeCode;
                identifier = node.data.element.identifier;
                break;

            case "Sample":
                experimentId = node.data.element.experimentIdentifierOrNull;
                type = node.data.element.sampleTypeCode;
                identifier = node.data.element.identifier;
                break;

            case "DataSet":
                experimentId = node.data.element.experimentIdentifier;
                type = node.data.element.dataSetTypeCode;
                identifier = node.data.element.code;
                break;

            default:
                experimentId = "";
                type = "";
                identifier = "";
        }

    } else {

        if (node.data.type && node.data.type == "specimen") {

            // Get the specimen name.
            // TODO: Use a dedicate property
            specimenName = node.data.title;

            // In case of a specimen, we filter WELLS or TUBES for the 
            // associated property {exp_prefix}_SPECIMEN.
            // We must treat the two cases differently, though.
            //
            // In the case of wells, we can make use of the fact that 
            // wells are contained in a plate. So we can use the plate
            // identifier to get the wells, and then filter them by
            // specimen.
            //
            // In the case of tubes, they do not have a parent, so we 
            // simply need to get all tubes in the experiment and check
            // that their {exp_prefix}_SPECIMEN property matches the
            // given specimen.

            // Do we have a parent?
            if (node.parent && node.parent.data && node.parent.data.element) {

                // Reference
                var parent = node.parent;

                if (parent.data.element["@type"] == "Sample" &&
                    parent.data.element.sampleTypeCode == (DATAMODEL.EXPERIMENT_PREFIX + "_PLATE")) {

                    // Type
                    type = DATAMODEL.EXPERIMENT_PREFIX + "_PLATE";

                    // Get plate's identifier
                    identifier = parent.data.element.identifier;

                    // Experiment ID
                    experimentId = parent.data.element.experimentIdentifierOrNull;

                }

            } else {

                // We set the parent to point to the experiment
                type = DATAMODEL.EXPERIMENT_PREFIX + "_TUBESET";

                // Walk up the tree until we reach the experiment
                while (node.parent) {
                    node = node.parent;
                    if (node.data.element &&
                        node.data.element["@type"] == "Experiment") {
                        identifier = node.data.element.identifier;
                        break;
                    }
                }

                // Experiment ID (same as identifier)
                experimentId = identifier;

            }

        } else if (node.data.type && node.data.type == "tubesets") {

            // If there are no (loaded) children (yet), just return
            if (!node.childList || node.childList.length == 0) {
                if (node._isLoading) {
                    this.displayStatus("Please reselect this node to " +
                        "display export option.</br />", "info");
                }
                return;
            }

            // Do we have real samples?
            if (node.childList.length == 1 &&
                node.childList[0].data &&
                node.childList[0].data.icon == "empty.png" &&
                node.childList[0].data.title === "<i>None</i>" != -1) {
                return;
            }

            // This is the same as the tubeset case before, but without
            // filtering by the specimen

            // Empty specimen
            specimenName = "";

            // Tubeset
            type = DATAMODEL.EXPERIMENT_PREFIX + "_TUBESET";

            // Walk up the tree until we reach the experiment
            while (node.parent) {
                node = node.parent;
                if (node.data.element &&
                    node.data.element["@type"] == "Experiment") {
                    identifier = node.data.element.identifier;
                    break;
                }
            }

            // Experiment ID (same as identifier)
            experimentId = identifier;

        } else if (node.data.type && node.data.type == "plate_container") {

            // If there are no (loaded) children (yet), just return
            if (!node.childList || node.childList.length == 0) {
                if (node._isLoading) {
                    this.displayStatus("Please reselect this node to " +
                        "display export option.</br />", "info");
                }
                return;
            }

            // Do we have real samples?
            if (node.childList.length == 1 &&
                node.childList[0].data &&
                node.childList[0].data.icon == "empty.png" &&
                node.childList[0].data.title === "<i>None</i>" != -1) {
                return;
            }

            // Empty specimen
            specimenName = "";

            // All plates in the experiment
            type = DATAMODEL.EXPERIMENT_PREFIX + "_ALL_PLATES";

            // Walk up the tree until we reach the experiment
            while (node.parent) {
                node = node.parent;
                if (node.data.element &&
                    node.data.element["@type"] == "Experiment") {
                    identifier = node.data.element.identifier;
                    break;
                }
            }

            // Experiment ID (same as identifier)
            experimentId = identifier;

        }

    }

    // If no relevant type found, just return here
    if (type == "") {
        return;
    }

    // Display the "Export to your folder" button only if enabled in the configuration file
    if (CONFIG['enableExportToUserFolder'] == true) {

        var img = $("<img>")
            .attr("src", "img/export.png");

        var link = $("<a>")
            .addClass("btn btn-xs btn-primary")
            .attr("href", "#")
            .html("&nbsp;Export to your folder")
            .click(function() {
                DATAMODEL.copyDatasetsToUserDir(
                    experimentId, type, identifier,
                    specimenName, "normal");
                return false;
            });

        link.prepend(img);

        $("#detailViewAction").append(link);

    }

    var img = $("<img>")
        .attr("src", "img/zip.png");

    var link = $("<a>")
        .addClass("btn btn-xs btn-primary")
        .attr("href", "#")
        .html("&nbsp;Download archive")
        .click(function() {
            DATAMODEL.copyDatasetsToUserDir(
                experimentId, type, identifier,
                specimenName, "zip");
            return false;
        });

    link.prepend(img);

    $("#detailViewAction").append(link);

};


/**
 * Build and display the link to download the FCS file via browser
 * @param node: DataTree node
 */
DataViewer.prototype.displayDownloadAction = function(node) {

    // Build and display the call
    if (node.data.element && node.data.element.hasOwnProperty("url")) {

        var img = $("<img>")
            .attr("src", "img/download.png");

        var link = $("<a>")
            .addClass("btn btn-xs btn-primary")
            .attr("href", node.data.element.url)
            .html("&nbsp;Download " + node.data.element.filename)

        link.prepend(img);

        $("#detailViewAction").append(link);

    }
};

/**
 * Display status text color-coded by level.
 * @param status: text to be displayed
 * @param level: one of "default", "info", "success", "warning", "danger". Default is "default".
 */
DataViewer.prototype.displayStatus = function(status, level) {

    // Get the the status div
    var status_div = $("#status");

    // Make sure the status div is visible
    status_div.show();

    // Clear the status
    status_div.empty();

    // Make sure the level is valid
    if (["default", "success", "info", "warning", "danger"].indexOf(level) == -1) {
        level = "default";
    }

    var d = $("<div>")
        .addClass("alert fade in")
        .addClass("alert-" + level)
        .html(status);
    status_div.append(d);

};

/**
 * Hide the status div.
 */
DataViewer.prototype.hideStatus = function() {
    $("#status").hide();
};

/**
 * Display attachment info and link to the Attachments tab.
 * @param attachments: list of attachments
 */
DataViewer.prototype.displayAttachments = function(dataMoverObj, attachments) {

    // Get the div
    var experimentAttachmentsViewId = $("#experimentAttachmentsView");

    // Clear the attachment div
    experimentAttachmentsViewId.empty();

    // Text
    var text = "";
    if (dataMoverObj.attachments.length == 0) {
        text = "There are no attachments.";
    } else if (dataMoverObj.attachments.length == 1) {
        text = "There is one attachment."
    } else {
        text = "There are " + dataMoverObj.attachments.length + " attachments";
    }
    // Link to the attachment tab
    var link = $("<a>").text(text).attr("href", "#").attr("title", text).click(
        function() {
            var url = "#entity=EXPERIMENT&permId=" + dataMoverObj.exp.permId +
                "&ui-subtab=attachment-section&ui-timestamp=" + (new Date().getTime());
            window.top.location.hash = url;
            return false;
        });

    experimentAttachmentsViewId.append(this.prepareTitle("Attachments"));

    // Display the link
    experimentAttachmentsViewId.append(link);

};

/**
 * Display the form with the parameter selections for the plotting.
 * @param target_div: div to which the form will be appended.
 * @param parameters: list of parameter names
 * @patam dataset_permid: permid of the dataset
 */
DataViewer.prototype.renderParameterSelectionForm = function(node) {

    // Check that the parameter info is present
    if (!node.data.parameterInfo) {
        return;
    }

    // Update details
    var detailViewSampleID = $("#detailViewSample");

    detailViewSampleID.append($("<p>").html("This file contains " +
        node.data.parameterInfo.numParameters + " parameters and " +
        node.data.parameterInfo.numEvents + " events.")
    );

    // Create the form
    var form = $("<form>").addClass("form-group").attr("id", "parameter_form");
    detailViewSampleID.append(form);
    var formId = $("#parameter_form");

    formId.append($("<label>").attr("for", "parameter_form_select_X_axis").html("X axis"));
    var selectXAxis = $("<select>").addClass("form_control").attr("id", "parameter_form_select_X_axis");
    formId.append(selectXAxis);
    var selectXAxisId = $("#parameter_form_select_X_axis");

    formId.append($("<label>").attr("for", "parameter_form_select_Y_axis").html("Y axis"));
    var selectYAxis = $("<select>").addClass("form_control").attr("id", "parameter_form_select_Y_axis");
    formId.append(selectYAxis);
    var selectYAxisId = $("#parameter_form_select_Y_axis");

    // Add all options
    for (var i = 0; i < node.data.parameterInfo.numParameters; i++) {
        var name = node.data.parameterInfo["names"][i];
        var compositeName = node.data.parameterInfo["compositeNames"][i];
        selectXAxisId.append($("<option>")
            .attr("value", name)
            .text(compositeName));
        selectYAxisId.append($("<option>")
            .attr("value", name)
            .text(compositeName));
    }

    // Pre-select some parameters
    selectXAxisId.val(node.data.parameterInfo["names"][0]);
    selectYAxisId.val(node.data.parameterInfo["names"][1]);

    // Add "Plot" button
    var plotButton = $("<input>")
        .attr("type", "button")
        .attr("value", "Plot")
        .click(function() {

            // Get the selected parameters
            var paramX = selectXAxisId.val();
            var paramY = selectYAxisId.val();

            // TODO Make this a parameter the user can pick
            var numEvents = 20000;

            DATAMODEL.generateFCSPlot(
                node,
                node.data.element.code,
                paramX,
                paramY,
                numEvents);
        });
    formId.append(plotButton);
};

/**
 * Prepare a title div to be added to the page.
 * @param title Text for the title
 * @param level One of "default", "info", "success", "warning", "danger". Default is "default".
 */
DataViewer.prototype.prepareTitle = function(title, level) {


    // Make sure the level is valid
    if (["default", "success", "info", "warning", "danger"].indexOf(level) == -1) {
        level = "default";
    }

    return ($("<p>").append($("<span>").addClass("label").addClass("label-" + level).text(title)));

};

/**
 * Display a scatter plot using D3
 * @param xData list of X points
 * @param yData list of Y points
 * @param xLabel X label
 * @param yLabel Y label
 *
 * @see http://swizec.com/blog/quick-scatterplot-tutorial-for-d3-js/swizec/5337
 */
DataViewer.prototype.plotFCSDataD3 = function(xData, yData, xLabel, yLabel) {

    // TODO: Optimize this!
    var xData = JSON.parse(xData);
    var yData = JSON.parse(yData);

    // Size and margins for the chart
    var width = 400
    var height = 400;
    var pad = 50;
    var left_pad = 200;

    // Clear the plot div
    $('#detailViewPlot').empty();

    // Add an svg element
    var svg = d3.select("#detailViewPlot").append("svg")
        .attr("width", width)
        .attr("height", height);

    // Set up scalings
    var x = d3.scale.linear()
        .domain([0, d3.max(xData)])
        .range([left_pad, width - pad]);
    var y = d3.scale.linear()
        .domain([0, d3.max(yData)])
        .range([height - pad * 2, pad]);

    // Create the axes
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");
    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    // Append the axes
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0, " + (height - pad) + ")")
        .call(xAxis);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + (left_pad - pad) + ", 0)")
        .call(yAxis);

    // Append the axis labels
    svg.append("text")      // text label for the x axis
        .attr("x", width / 2 + pad)
        .attr("y",  height)
        .style("text-anchor", "middle")
        .text(xLabel);

    // Append the axis labels
    svg.append("text")      // text label for the x axis
        .attr("x", pad)
        .attr("y",  height / 2)
        .style("text-anchor", "middle")
        .text(yLabel);

    svg.selectAll("circle")
        .data(yData)
        .enter().append("svg:circle")
        .attr("cy", function (d) { return y(d); })
        .attr("cx", function (d, i) { return x(xData[i]); })
        .attr("r", 3)
        .style("opacity", 0.6);

};

/**
 * Display a scatter plot using HighCharts
 * @param xData list of X points
 * @param yData list of Y points
 * @param xLabel X label
 * @param yLabel Y label
 */
DataViewer.prototype.plotFCSData = function(data, xLabel, yLabel) {

    // Make sure to have a proper array
    data = JSON.parse(data);

    $('#detailViewPlot').highcharts({
        chart: {
            type: 'scatter',
            zoomType: 'xy'
        },
        title: {
            text: yLabel + " vs. " + xLabel
        },
        subtitle: {
            text: ''
        },
        xAxis: {
            title: {
                enabled: true,
                text: xLabel
            },
            type: 'linear',
            startOnTick: true,
            endOnTick: true,
            showLastLabel: true
        },
        yAxis: {
            title: {
                text: yLabel
            },
            type: 'linear'
        },
        plotOptions: {
            scatter: {
                marker: {
                    radius: 1,
                    states: {
                        hover: {
                            enabled: true,
                            lineColor: 'rgb(100,100,100)'
                        }
                    }
                },
                states: {
                    hover: {
                        marker: {
                            enabled: false
                        }
                    }
                },
                tooltip: {
                    headerFormat: '',
                    pointFormat: '{point.x:.2f}, {point.y:.2f}'
                }
            }
        },
        series: [{
            name: '',
            color: 'rgba(223, 83, 83, .5)',
            data: data
        }]
    });
};





