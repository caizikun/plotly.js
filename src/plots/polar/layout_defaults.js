/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var colorMix = require('tinycolor2').mix;

var Lib = require('../../lib');
var Color = require('../../components/color');
var Plots = require('../plots');
var Registry = require('../../registry');
var handleSubplotDefaults = require('../subplot_defaults');

var handleTickValueDefaults = require('../cartesian/tick_value_defaults');
var handleTickMarkDefaults = require('../cartesian/tick_mark_defaults');
var handleTickLabelDefaults = require('../cartesian/tick_label_defaults');
var handleCategoryOrderDefaults = require('../cartesian/category_order_defaults');
var autoType = require('../cartesian/axis_autotype');
var orderedCategories = require('../cartesian/ordered_categories');
var setConvert = require('../cartesian/set_convert');

var layoutAttributes = require('./layout_attributes');
var constants = require('./constants');
var axisNames = constants.axisNames;

function handleDefaults(contIn, contOut, coerce, opts) {
    var bgColor = coerce('bgcolor');
    opts.bgColor = Color.combine(bgColor, opts.paper_bgcolor);

    // TODO default should depend on domain (and span eventually)
    var xDomain = contOut.domain.x;
    var yDomain = contOut.domain.y;
    coerce('x', (xDomain[0] + xDomain[1]) / 2);
    coerce('y', (yDomain[0] + yDomain[1]) / 2);

    coerce('zoom');
    coerce('bgcolor');

    // could optimize, subplotData is not always needed!
    var subplotData = Plots.getSubplotData(opts.fullData, constants.name, opts.id);
    var layoutOut = opts.layoutOut;
    var axName;

    function coerceAxis(attr, dflt) {
        return coerce(axName + '.' + attr, dflt);
    }

    for(var i = 0; i < axisNames.length; i++) {
        axName = axisNames[i];

        var axIn = contIn[axName] || {};
        var axOut = contOut[axName] = {};
        var dataAttr = constants.axisName2dataArray[axName];
        var axType = handleAxisTypeDefaults(axIn, axOut, coerceAxis, subplotData, dataAttr);

        handleCategoryOrderDefaults(axIn, axOut, coerceAxis);
        axOut._initialCategories = axType === 'category' ?
            orderedCategories(dataAttr, axOut.categoryorder, axOut.categoryarray, subplotData) :
            [];

        if(axType === 'date') {
            var handleCalendarDefaults = Registry.getComponentMethod('calendars', 'handleDefaults');
            handleCalendarDefaults(axIn, axOut, 'calendar', layoutOut.calendar);
        }

        coerceAxis('visible');

        if(axOut.visible) {
            handleAxisStyleDefaults(axIn, axOut, coerceAxis, opts);
            setConvert(axOut, layoutOut);
        }

        switch(axName) {
            case 'radialaxis':
                var autoRange = coerceAxis('autorange', !axOut.isValidRange(axIn.range));
                if(autoRange) coerceAxis('rangemode');

                coerceAxis('range');
                axOut.cleanRange();

                coerceAxis('side');
                break;
            case 'angularaxis':
                coerceAxis('start');
                coerceAxis('period');
                break;
        }

        axOut._input = axIn;
    }
}

function handleAxisTypeDefaults(axIn, axOut, coerce, subplotData, dataAttr) {
    var axType = coerce('type');

    if(axType === '-') {
        var trace;

        for(var i = 0; i < subplotData.length; i++) {
            trace = subplotData[i];
            if(trace.visible) break;
        }

        // TODO add trace input calendar support
        axOut.type = autoType(trace[dataAttr], 'gregorian');

        if(axOut.type === '-') {
            axOut.type = 'linear';
        } else {
            // copy autoType back to input axis
            // note that if this object didn't exist
            // in the input layout, we have to put it in
            // this happens in the main supplyDefaults function
            axIn.type = axOut.type;
        }
    }

    return axOut.type;
}

function handleAxisStyleDefaults(axIn, axOut, coerce, opts) {
    var dfltColor = coerce('color');
    var dfltFontColor = (dfltColor === axIn.color) ? dfltColor : opts.font.color;

    handleTickValueDefaults(axIn, axOut, coerce, 'linear');
    handleTickLabelDefaults(axIn, axOut, coerce, 'linear', {noHover: false});
    handleTickMarkDefaults(axIn, axOut, coerce, {outerTicks: true});

    var showTickLabels = coerce('showticklabels');
    if(showTickLabels) {
        Lib.coerceFont(coerce, 'tickfont', {
            family: opts.font.family,
            size: opts.font.size,
            color: dfltFontColor
        });
        coerce('tickangle');
        coerce('tickformat');
    }

    coerce('hoverformat');

    // TODO should use coerce2 pattern !!

    var showLine = coerce('showline');
    if(showLine) {
        coerce('linecolor', dfltColor);
        coerce('linewidth');
    }

    var showGridLines = coerce('showgrid');
    if(showGridLines) {
        // default grid color is darker here (60%, vs cartesian default ~91%)
        // because the grid is not square so the eye needs heavier cues to follow
        coerce('gridcolor', colorMix(dfltColor, opts.bgColor, 60).toRgbString());
        coerce('gridwidth');
    }
}

module.exports = function supplyLayoutDefaults(layoutIn, layoutOut, fullData) {
    handleSubplotDefaults(layoutIn, layoutOut, fullData, {
        type: constants.name,
        attributes: layoutAttributes,
        handleDefaults: handleDefaults,
        font: layoutOut.font,
        paper_bgcolor: layoutOut.paper_bgcolor,
        fullData: fullData,
        layoutOut: layoutOut
    });
};
