/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var scatterPlot = require('../scatter/plot');

module.exports = function plot(subplot, moduleCalcData) {
    var plotinfo = {
        xaxis: subplot.xaxis,
        yaxis: subplot.yaxis,
        plot: subplot.framework,
        layerClipId: subplot.hasClipOnAxisFalse ? subplot.clipId : null
    };

    // add ref to subplot object in fullData traces
    // TODO maybe we'll need this for hover maybe not
    for(var i = 0; i < moduleCalcData.length; i++) {
        moduleCalcData[i][0].trace._subplot = subplot;
    }

    scatterPlot(subplot.graphDiv, plotinfo, moduleCalcData);
};
