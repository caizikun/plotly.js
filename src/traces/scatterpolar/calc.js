/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var isNumeric = require('fast-isnumeric');
var BADNUM = require('../../constants/numerical').BADNUM;

var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');

var subTypes = require('../scatter/subtypes');
var calcColorscale = require('../scatter/colorscale_calc');
var arraysToCalcdata = require('../scatter/arrays_to_calcdata');
var calcSelection = require('../scatter/calc_selection');

var toRadConverters = {
    degrees: function(v) { return v / 180 * Math.PI; },
    gradians: function(v) { return v / 200 * Math.PI; },
    radians: Number
};

module.exports = function calc(gd, trace) {
    var fullLayout = gd._fullLayout;
    var subplotId = trace.subplot;
    var radialAxis = fullLayout[subplotId].radialaxis;
    var angularAxis = fullLayout[subplotId].angularaxis;
    var rArray = radialAxis.makeCalcdata(trace, 'r');
    var thetaArray = angularAxis.makeCalcdata(trace, 'theta');
    var len = rArray.length;
    var cd = new Array(len);

    // TODO gotta incorporate polar.direction, polar.rotation
    var theta2rad;

    switch(angularAxis.type) {
        case 'linear':
            theta2rad = toRadConverters[trace.thetaunit];
            break;
        case 'category':
            theta2rad = function(v) {
                return v * 2 * Math.PI / angularAxis._categories.length;
            };
            break;
        case 'date':
            var period = angularAxis.period || 365 * 24 * 60 * 60 * 1000;
            theta2rad = function(v) {
                return (v % period) * 2 * Math.PI / period;
            };
            break;
    }

    for(var i = 0; i < len; i++) {
        var r = rArray[i];
        var theta = thetaArray[i];
        var cdi = cd[i] = {};

        if(isNumeric(r) && isNumeric(theta)) {
            cdi.r = r;
            cdi.theta = theta;

            var thetaInRad = theta2rad(theta);
            cdi.x = r * Math.cos(thetaInRad);
            cdi.y = r * Math.sin(thetaInRad);
        } else {
            cdi.x = BADNUM;
            cdi.y = BADNUM;
        }
    }

    // TODO ...
    // otherwise set by setScale which requires a domain
    radialAxis._m = 1;
    radialAxis._length = 100;
    Axes.expand(radialAxis, rArray, {tozero: true});

    // TODO
    if(angularAxis.type === 'date') {
        angularAxis.autorange = true;
        angularAxis._m = 1;
        angularAxis._length = 100;
        Axes.expand(angularAxis, thetaArray);
    }

    // Axes.expand(angularAxis

    // TODO Dry up with other scatter* traces!
    // fill in some extras
    //
    // TODO needs to bump auto ranges !!!
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
