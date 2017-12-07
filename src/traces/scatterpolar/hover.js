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
var Lib = require('../../lib');

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
    var radialAxis = subplot.radialaxis;
    var angularAxis = subplot.angularaxis;
    var hoverinfo = cdi.hi || trace.hoverinfo;
    var parts = hoverinfo.split('+');
    var text = [];

    // TODO handle case when theta is outside of polar.sector
    var rad = angularAxis._c2rad(cdi.theta, trace.thetaunit);

    radialAxis._hovertitle = 'r';
    angularAxis._hovertitle = 'θ';

    // show theta value in unit of angular axis
    var theta;
    if(angularAxis.type === 'linear' && trace.thetaunit !== angularAxis.thetaunit) {
        theta = angularAxis.thetaunit === 'degrees' ? Lib.rad2deg(rad) : rad;
    } else {
        theta = cdi.theta;
    }

    function textPart(ax, val) {
        text.push(ax._hovertitle + ': ' + Axes.tickText(ax, val, 'hover').text);
    }

    if(parts.indexOf('all') !== -1) parts = ['r', 'theta'];
    if(parts.indexOf('r') !== -1) textPart(radialAxis, cdi.r);

    // TODO report back in correct 'thetaunit'
    if(parts.indexOf('theta') !== -1) textPart(angularAxis, theta);

    newPointData.extraText = text.join('<br>');

    return scatterPointData;
};
