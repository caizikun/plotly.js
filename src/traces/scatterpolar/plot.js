/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var scatterPlot = require('../scatter/plot');
var polygonTester = require('../../lib/polygon').tester;

module.exports = function plot(subplot, moduleCalcData) {
    var xa = subplot.xaxis;
    var ya = subplot.yaxis;
    var radius = subplot.radius;

    var plotinfo = {
        xaxis: xa,
        yaxis: ya,
        plot: subplot.framework,
        layerClipId: subplot.hasClipOnAxisFalse ? subplot.clipIds.circle : null
    };

    scatterPlot(subplot.graphDiv, plotinfo, moduleCalcData);

    function pt2deg(p) {
        return rad2deg(Math.atan2(radius - p[1], p[0] - radius));
    }

    // TODO
    // fix polygon testers for segments that wrap around themselves
    for(var i = 0; i < moduleCalcData.length; i++) {
        var trace = moduleCalcData[i][0].trace;

        if(Array.isArray(trace._polygons)) {
            for(var j = 0; j < trace._polygons.length; j++) {
                var pts = trace._polygons[j].pts.slice();
                pts.pop();

                var a0 = pt2deg(pts[0]);
                for(var k = 1; k < pts.length; k++) {
                    var a1 = pt2deg(pts[k]);
                    var arc = Math.abs(a1 - a0);
                    var arcWrapped = Math.abs(wrap360(a1) - wrap360(a0));

                    // COULD DO BETTER !!!

                    if(arc !== arcWrapped) {
                        console.log('wrapped');
                    }


                    a0 = a1;
                }
            }
        }
    }
};

var PI = Math.PI;


function deg2rad(deg) {
    return deg / 180 * PI;
}

function rad2deg(rad) {
    return rad / PI * 180;
}

function wrap180(deg) {
    return ((deg + 180) % 360) - 180;
}

function wrap360(deg) {
    var out = deg % 360;
    return out < 0 ? out + 360 : out;
}
