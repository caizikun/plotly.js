/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var isNumeric = require('fast-isnumeric');

var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');

var subTypes = require('../scatter/subtypes');
var calcColorscale = require('../scatter/colorscale_calc');
var arraysToCalcdata = require('../scatter/arrays_to_calcdata');
var calcSelection = require('../scatter/calc_selection');

var toRadians = {
    radians: Lib.identity,
    degrees: function(v) { return v / 180 * Math.PI; },
    gradians: function(v) { return v / 200 * Math.PI;  }
};

module.exports = function calc(gd, trace) {
    var fullLayout = gd._fullLayout;
    var rAxis = fullLayout[trace.subplot].radialaxis;
    var rArray = rAxis.makeCalcdata(trace, 'r');
    var len = rArray.length;
    var cd = new Array(len);

    // TODO we'll need a makeCalcdata step here

    var theta2radians = toRadians['degrees'];

    for(var i = 0; i < len; i++) {
        var r = rArray[i];
        var theta = trace.theta[i];
        var cdi = cd[i] = {};

        if(isNumeric(r) && isNumeric(theta)) {
            r = cdi.r = +r;
            theta = cdi.theta = +theta2radians(theta);

            cdi.x = r * Math.cos(theta);
            cdi.y = r * Math.sin(theta);
        } else {
            cdi.x = false;
            cdi.y = false;
        }
    }

    // TODO ...
    // otherwise set by setScale which requires a domain
    rAxis._m = 1;
    rAxis._length = 100;
    Axes.expand(rAxis, rArray, {tozero: true});

    // TODO Dry up with other scatter* traces!
    // fill in some extras
    var marker, s;
    if(subTypes.hasMarkers(trace)) {
        // Treat size like x or y arrays --- Run d2c
        // this needs to go before ppad computation
        marker = trace.marker;
        s = marker.size;

        if(Array.isArray(s)) {
            var ax = {type: 'linear'};
            Axes.setConvert(ax);
            s = ax.makeCalcdata(trace.marker, 'size');
            if(s.length > len) s.splice(len, s.length - len);
        }
    }

    calcColorscale(trace);
    arraysToCalcdata(cd, trace);
    calcSelection(cd, trace);

    return cd;
};
