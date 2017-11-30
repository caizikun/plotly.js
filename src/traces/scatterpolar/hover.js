/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var scatterHover = require('../scatter/hover');
var Axes = require('../../plots/cartesian/axes');

module.exports = function hoverPoints(pointData, xval, yval, hovermode) {
    var scatterPointData = scatterHover(pointData, xval, yval, hovermode);
    if(!scatterPointData || scatterPointData[0].index === false) return;

    var newPointData = scatterPointData[0];
    var cdi = newPointData.cd[newPointData.index];
    var trace = newPointData.trace;

    newPointData.xLabelVal = undefined;
    newPointData.yLabelVal = undefined;

    // TODO handle fill

    // TODO should pass subplot in pointData,
    // so that we don't have to 'manually' add a ref to full trace objects
    var subplot = trace._subplot;
    var hoverinfo = cdi.hi || trace.hoverinfo;
    var parts = hoverinfo.split('+');
    var text = [];

    // TODO must handle case where subplot and trace *thetaunit* differ

    function textPart(ax, val) {
        text.push(ax._hovertitle + ': ' + Axes.tickText(ax, val, 'hover').text);
    }

    var fullLayout = subplot.gd._fullLayout;
    var subplotId = subplot.id;
    var radialaxis = fullLayout[subplotId].radialaxis;
    radialaxis._hovertitle = 'r'
    var angularaxis = fullLayout[subplotId].angularaxis;
    angularaxis._hovertitle = 'θ';

    if(parts.indexOf('all') !== -1) parts = ['r', 'theta'];
    if(parts.indexOf('r') !== -1) textPart(radialaxis, cdi.r);

    // TODO report back in correct 'thetaunit'
    if(parts.indexOf('theta') !== -1) textPart(angularaxis, cdi.theta);

    newPointData.extraText = text.join('<br>');

    return scatterPointData;
};
