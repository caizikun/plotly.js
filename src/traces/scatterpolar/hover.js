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

    // hovering on fill case
    // TODO do we need to constrain the scatter point data further (like for
    // ternary subplots) or not?
    if(newPointData.index === undefined) {
        return scatterPointData;
    }

    newPointData.xLabelVal = undefined;
    newPointData.yLabelVal = undefined;

    var cdi = newPointData.cd[newPointData.index];
    var trace = newPointData.trace;
    var subplot = pointData.subplot;
    var radialaxis = subplot.radialaxis;
    var angularaxis = subplot.angularaxis;
    var hoverinfo = cdi.hi || trace.hoverinfo;
    var parts = hoverinfo.split('+');
    var text = [];

    radialaxis._hovertitle = 'r';
    angularaxis._hovertitle = 'θ';

    // TODO must handle case where subplot and trace *thetaunit* differ
    var theta;

    function textPart(ax, val) {
        text.push(ax._hovertitle + ': ' + Axes.tickText(ax, val, 'hover').text);
    }

    // TODO handle case when theta is outside of polar.sector

    if(parts.indexOf('all') !== -1) parts = ['r', 'theta'];
    if(parts.indexOf('r') !== -1) textPart(radialaxis, cdi.r);

    // TODO report back in correct 'thetaunit'
    if(parts.indexOf('theta') !== -1) textPart(angularaxis, cdi.theta);

    newPointData.extraText = text.join('<br>');

    return scatterPointData;
};
