/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var d3 = require('d3');
var tinycolor = require('tinycolor2');

var Plotly = require('../../plotly');
var Lib = require('../../lib');
var Color = require('../../components/color');
var Drawing = require('../../components/drawing');
var Plots = require('../plots');
var Axes = require('../cartesian/axes');
var dragElement = require('../../components/dragelement');
var dragBox = require('../cartesian/dragbox');
var setCursor = require('../../lib/setcursor');
var Fx = require('../../components/fx');
var prepSelect = require('../cartesian/select');

var constants = require('./constants');
var axisNames = constants.axisNames;
var MINZOOM = constants.MINZOOM;
var MINDRAG = constants.MINDRAG;
var blankPath = 'M0,0';

function Polar(gd, id) {
    this.id = id;
    this.gd = gd;

    this.hasClipOnAxisFalse = null;
    this.traceHash = {};
    this.layers = {};

    var fullLayout = gd._fullLayout;
    var polarLayout = fullLayout[id];
    this.clipId = 'clip' + fullLayout._uid + id;

    this.clipDef = fullLayout._clips.append('clipPath')
        .attr('id', this.clipId)

    this.clipCircle = this.clipDef.append('circle')
        .attr({cx: 0, cy: 0});

    this.framework = fullLayout._polarlayer.append('g')
        .attr('class', id);

    this.viewInitial = {
        x: polarLayout.x,
        y: polarLayout.y,
        zoom: polarLayout.zoom
    };

    this.xaxis = {
        type: 'linear',
        _id: 'x'
    };

    this.yaxis = {
        type: 'linear',
        _id: 'y'
    };
}

var proto = Polar.prototype;

module.exports = function createPolar(gd, id) {
    return new Polar(gd, id);
};

proto.plot = function(polarCalcData, fullLayout) {
    var _this = this;
    var polarLayout = fullLayout[_this.id];

    // TODO maybe move to generalUpdatePerTraceModule ?
    _this.hasClipOnAxisFalse = false;
    for(var i = 0; i < polarCalcData.length; i++) {
        var trace = polarCalcData[i][0].trace;

        if(trace.cliponaxis === false) {
            _this.hasClipOnAxisFalse = true;
            break;
        }
    }

    Axes.doAutoRange(polarLayout.radialaxis);

    _this.updateLayers(fullLayout, polarLayout);
    _this.updateLayout(fullLayout, polarLayout);
    _this.updateFx(fullLayout, polarLayout);
    Plots.generalUpdatePerTraceModule(_this, polarCalcData, polarLayout);
};

proto.updateLayers = function(fullLayout, polarLayout) {
    var _this = this;
    var layers = _this.layers;

    // TODO sort to implement 'radialaxis.layer' & 'angularaxis.layer
    var layerData = constants.layerNames.slice();

    var join = _this.framework.selectAll('.polarlayer')
        .data(layerData, String);

    join.enter().append('g')
        .attr('class', function(d) { return 'polarlayer ' + d})
        .each(function(d) {
            var sel = layers[d] = d3.select(this);

            switch(d) {
                case 'frontplot':
                    sel.append('g')
                        .classed('scatterlayer', true)
                        .call(Drawing.setClipUrl, _this.clipId);
                    break;
                case 'backplot':
                    sel.append('g').classed('maplayer', true);
                    break;
                case 'plotbg':
                    layers.bgcircle = sel.append('circle');
                    break;
                case 'grids':
                    axisNames.forEach(function(d) {
                        var k = d + 'grid';
                        layers[k] = sel.append('g')
                            .classed(k, true)
                            .attr('fill', 'none');
                    });
                    break;
                case 'axes':
                    // TODO in fact, there's only one axis (the radial one)!
                    axisNames.forEach(function(d) {
                        layers[d] = sel.append('g').classed(d, true);
                    });
                    break;
                case 'lines':
                    layers.radialline = sel.append('line')
                        .classed('radialline', true)
                        .attr('fill', 'none');
                    layers.angularline = sel.append('circle')
                        .classed('angularline', true)
                        .attr('fill', 'none');
                    break;
            }
        });

    join.order();
};

proto.updateLayout = function(fullLayout, polarLayout) {
    var _this = this;
    var layers = _this.layers;
    var gs = fullLayout._size;
    var radialLayout = polarLayout.radialaxis;
    var angularLayout = polarLayout.angularaxis;

    // layout domains
    var xDomain = polarLayout.domain.x;
    var yDomain = polarLayout.domain.y;
    // offsets from paper edge to layout domain box
    var xOffset = _this.xOffset = gs.l + gs.w * xDomain[0];
    var yOffset = _this.yOffset = gs.t + gs.h * (1 - yDomain[1]);
    // lengths of the layout domain box
    var xLength = _this.xLength = gs.w * (xDomain[1] - xDomain[0]);
    var yLength = _this.yLength = gs.h * (yDomain[1] - yDomain[0]);
    // px coordinates of the subplot's center
    var cx = _this.cx = gs.l + gs.w * polarLayout.x;
    var cy = _this.cy = gs.t + gs.h * (1 - polarLayout.y);
    // diameter of polar chart in px
    var diameter;
    // gap (in px and normalized coordinates) between layout domain and actual domain
    var gap, gapNC;
    // actual domains of the polar chart that give a square in px coordinates
    var xDomain2, yDomain2;
    // actual offsets from paper edge to the subplot box top-left corner
    var xOffset2, yOffset2;

    if(xLength > yLength) {
        diameter = yLength;
        gap = (xLength - yLength) / 2;
        gapNC = gap / gs.w;
        xDomain2 = [xDomain[0] + gapNC, xDomain[1] - gapNC];
        yDomain2 = yDomain.slice();
        xOffset2 = xOffset + gap;
        yOffset2 = yOffset;
    } else {
        diameter = xLength;
        gap = (yLength - xLength) / 2;
        gapNC = gap / gs.h;
        xDomain2 = xDomain.slice();
        yDomain2 = [yDomain[0] + gapNC, yDomain[1] - gapNC];
        xOffset2 = xOffset;
        yOffset2 = yOffset + gap;
    }

    _this.diameter = diameter;
    _this.xOffset2 = xOffset2;
    _this.yOffset2 = yOffset2;

    var rRange = radialLayout.range;
    var zoom = polarLayout.zoom;
    var cartesianRange = [-rRange[1], rRange[1]];

    var xaxis = _this.xaxis;
    xaxis.range = cartesianRange.slice();
    xaxis.domain = xDomain2;
    Axes.setConvert(xaxis, fullLayout);
    xaxis.setScale();
    xaxis.isPtWithinRange = function(d) {};

    var yaxis = _this.yaxis;
    yaxis.range = cartesianRange.slice();
    yaxis.domain = yDomain2;
    Axes.setConvert(yaxis, fullLayout);
    yaxis.setScale();
    yaxis.isPtWithinRange = function() { return true; };

    var radialAxis = _this.radialaxis = Lib.extendFlat({}, radialLayout, {
        _axislayer: layers.radialaxis,
        _gridlayer: layers.radialaxisgrid,
        // make this an 'x' axis to make positioning (especially rotation) easier
        _id: 'x',
        // radialaxis uses 'top'/'bottom' -> convert to 'x' axis equivalent
        side: {left: 'top', right: 'bottom'}[radialLayout.side],
        // spans 1/2 of the polar subplot
        domain: [polarLayout.x, xDomain2[1]],
        _length: diameter / gs.w / 2,
        _pos: 0,
        // dummy truthy value to make Axes.doTicks draw the grid
        _counteraxis: true,
        _gridpath: function(d) {
            var r = radialAxis.c2p(d.x);
            return pathCircle(r);
        }
    });
    Axes.setConvert(radialAxis, fullLayout);
    radialAxis.setScale();
    Axes.doTicks(gd, radialAxis, true);

    // maybe radial axis should be above frontplot ??
    var radialTransform = 'translate(' + cx + ',' + cy + ')rotate(0)';
    layers.radialaxis.attr('transform', radialTransform);
    layers.radialaxisgrid
        .attr('transform', radialTransform)
        .selectAll('path').attr('transform', null);
    layers.radialline.attr({
        display: radialLayout.showline ? null : 'none',
        x1: 0,
        y1: 0,
        x2: diameter / 2,
        y2: 0,
        transform: radialTransform
    })
    .attr('stroke-width', radialLayout.linewidth)
    .call(Color.stroke, radialLayout.linecolor);

    var angularAxis = _this.angularaxis = Lib.extendFlat({}, angularLayout, {
        _axislayer: layers.angularaxis,
        _gridlayer: layers.angularaxisgrid,
        // convert start / period to range
        // use gradians for angles to get rounds numbers
        // ... but need to remove first/last tick
        range: [0, 399],
        //
        _id: 'x',
        side: 'bottom',
        // dummy
        domain: [0, 1],
        _length: diameter,
        _pos: 0,
        // maybe?
        _transfn: function() {},
    });
    Axes.setConvert(angularAxis, fullLayout);
    angularAxis.setScale();
    Axes.doTicks(gd, angularAxis, true);

    function positionTick(d) {
        var r = rRange[1];
        var theta = d.x / 200 * Math.PI;
        var x = cx + radialAxis.c2p(r * Math.cos(theta));
        var y = cy + radialAxis.c2p(r * Math.sin(theta));
        return 'translate(' + x + ',' + y + ')';
    }

    layers.angularaxis.selectAll('path.xtick').attr('transform', positionTick);
    layers.angularaxis.selectAll('.xtick > text')
        .attr('transform', positionTick)
        .text(function(d) { return d.text / 400 * 360; });

    layers.angularline.attr({
        display: angularLayout.showline ? null : 'none',
        cx: cx,
        cy: cy,
        r: diameter / 2
    })
    .attr('stroke-width', angularLayout.linewidth)
    .call(Color.stroke, angularLayout.linecolor);

    Drawing.setTranslate(layers.frontplot, xOffset2, yOffset2);

    layers.bgcircle.attr({
        cx: cx,
        cy: cy,
        r: diameter / 2
    })
    .call(Color.fill, polarLayout.bgcolor);

    _this.clipCircle.attr({
        cx: cx - xOffset2,
        cy: cy - yOffset2,
        r: diameter / 2
    });
};

proto.updateFx = function(fullLayout, polarLayout) {
    if(!this.gd._context.staticPlot) {
        this.updateMainDrag(fullLayout, polarLayout);
        this.updateRadialDrag(fullLayout, polarLayout);
    }
};

proto.updateMainDrag = function(fullLayout, polarLayout) {
    var _this = this;
    var gd = _this.gd;
    var layers = _this.layers;
    var zoomlayer = fullLayout._zoomlayer;
    var gs = fullLayout._size;

    var mainDrag = dragBox.makeDragger(
        layers, 'maindrag', 'crosshair', 
        _this.xOffset2, _this.yOffset2, _this.diameter, _this.diameter
    );

    var dragOpts = {
        element: mainDrag,
        gd: gd,
        subplot: _this.id,
        plotinfo: {
            xaxis: _this.xaxis,
            yaxis: _this.yaxis
        },
        xaxes: [_this.xaxis],
        yaxes: [_this.yaxis]
    };

    // use layout domain and offsets to shadow full subplot domain on 'zoom'
    var pw = _this.xLength;
    var ph = _this.yLength;
    var xs = _this.xOffset;
    var ys = _this.yOffset;
    var x0, y0;
    var box, path0, dimmed, lum;
    var zb, corners;

    function zoomPrep(evt, startX, startY) {
        var bbox = mainDrag.getBoundingClientRect();
        var polarLayoutNow = gd._fullLayout[_this.id];
        x0 = startX - bbox.left;
        y0 = startY - bbox.top;
        box = {l: x0, r: x0, w: 0, t: y0, b: y0, h: 0};
        lum = tinycolor(polarLayoutNow.bgcolor).getLuminance();
        path0 = 'M0,0H' + pw + 'V' + ph + 'H0V0';
        dimmed = false;

        zb = dragBox.makeZoombox(zoomlayer, lum, xs, ys, path0);
        corners = dragBox.makeCorners(zoomlayer, xs, ys);
        dragBox.clearSelect(zoomlayer);
    }

    function zoomMove(dx0, dy0) {
        var x1 = Math.max(0, Math.min(pw, dx0 + x0));
        var y1 = Math.max(0, Math.min(ph, dy0 + y0));
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);

        box.w = box.h = Math.max(dx, dy);
        var delta = box.w / 2;

        if(dx > dy) {
            box.l = Math.min(x0, x1);
            box.r = Math.max(x0, x1);
            box.t = Math.min(y0, y1) - delta;
            box.b = Math.min(y0, y1) + delta;
        } else {
            box.t = Math.min(y0, y1);
            box.b = Math.max(y0, y1);
            box.l = Math.min(x0, x1) - delta;
            box.r = Math.max(x0, x1) + delta;
        }

        console.log(box)

        dragBox.updateZoombox(zb, corners, box, path0, dimmed, lum);
        corners.attr('d', dragBox.xyCorners(box));
        dimmed = true;
    }

    function zoomDone(dragged, numClicks) {
        if(Math.min(box.h, box.w) < MINDRAG * 2) {
            if(numClicks === 2) doubleClick();
            return dragBox.removeZoombox(gd);
        }

        dragBox.removeZoombox(gd);

        // Hmm. Can I do this with zoom and x/y ??
        var updateObj = {};
        var polarUpdateObj = updateObj[_this.id] = {};
        polarUpdateObj.zoom = 1;
        polarUpdateObj.x = 0.5;
        polarUpdateObj.y = 0.5;

        Plotly.relayout(gd, polarUpdateObj);
    }

    function panMove(dx, dy) {
        var vb = [dx, dy, pw - dx, ph - dy];
        updateByViewBox(vb);
    }

    function panDone(dragger, numClicks) {
        if(dragged) {
            updateByViewBox([0, 0, pw, ph]);
        } else if(numClicks === 2) {
            doubleClick();
        }
    }

    function zoomWheel() {

    }

    function updateByViewBox(vb) {
        var ax = _this.xaxis;
        var xScaleFactor = vb[2] / _this.ax._length;
        var yScaleFactor = vb[3] / _this.ax._length;
        var clipDx;
        var clipDy;

        var plotDx = ax._offset - clipDx / xScaleFactor;
        var plotDy = ax._offset - clipDy / yScaleFactor;

        _this.framework
            .call(Drawing.setTranslate, plotDx, plotDy)
            .call(Drawing.setScale, 1 / xScaleFactor, 1 / yScaleFactor);

        // maybe cache this at the plot step
        var traceGroups = _this.framework.selectAll('.trace');

        traceGroups.selectAll('.point')
            .call(Drawing.setPointGroupScale, xScaleFactor, yScaleFactor);
        traceGroups.selectAll('.textpoint')
            .call(Drawing.setTextPointsScale, xScaleFactor, yScaleFactor);
        traceGroups
            .call(Drawing.hideOutsideRangePoints, _this);
    } 

    function doubleClick() {
        gd.emit('plotly_doubleclick', null);
        Plotly.relayout(gd, {});
    }

    dragOpts.prepFn = function(evt, startX, startY) {
        var dragModeNow = gd._fullLayout.dragmode;

        switch(dragModeNow) {
            case 'zoom':
                dragOpts.moveFn = zoomMove;
                dragOpts.doneFn = zoomDone;
                zoomPrep(evt, startX, startY);
                break;
            case 'pan':
                dragOpts.moveFn = panMove;
                dragOpts.doneFn = panDone;
                break;
            case 'select':
            case 'lasso':
                prepSelect(evt, startX, startY, dragOpts, dragModeNow);
                break;
        }
    };

    mainDrag.onmousemove = function(evt) {
        Fx.hover(gd, evt, _this.id);
        gd._fullLayout._lasthover = mainDrag;
        gd._fullLayout._hoversubplot = _this.id;
    };

    mainDrag.onmouseout = function(evt) {
        if(gd._dragging) return;
        dragElement.unhover(gd, evt);
    };

    mainDrag.onclick = function(evt) {
        Fx.click(gd, evt, _this.id);
    };

    if(gd._context.scaleZoom) {
        dragBox.attachWheelEventHandler(mainDrag, zoomWheel);
    }

    dragElement.init(dragOpts);
};

proto.updateRadialDrag = function(fullLayout, polarLayout) {
    var _this = this;
    var gd = _this.gd;
    var layers = _this.layers;
    var radialDrag = dragBox.makeDragger(layers, 'radialdrag', 'move', 0, 0, 50, 50);
    var radialDrag3 = d3.select(radialDrag);
    var dragOpts = {element: radialDrag, gd: gd};

    radialDrag3.attr('transform',
        'translate(' + (_this.xOffset + _this.xLength / 2) + ',' + (_this.yOffset - 25) + ')');

    var r0, angle0;

    function rerangePrep(evt, startX, startY) {
        r0 = startX;
    }

    function rerangeMove(dx0) {
        _this.radialAxis.p2c()


    }

    function rerangeDone() {

    }

    function rotatePrep() {

    }

    function rotateMove(dx0, dy0) {
        var angle = Math.atan2(dy0, dx0) / Math.PI * 180;
        console.log(dx0, dy0, angle, angle0)
        _this.framework.attr('transform',
            'rotate('+ angle + ',' + _this.xOffset + ',' + _this.yOffset + ')');
    };

    function rotateDone(dragged) {
        _this.framework.attr('transform', null);
    };

    dragOpts.prepFn = function(evt, startX, startY) {
        angle0 = Math.atan2(startY, startX) / Math.PI * 180;

//         rerangePrep(evt, startX, startY);
//         dragOpts.moveFn = rerangeMove;
//         dragOpts.doneFn = rerangeDone;

        rotatePrep();
        dragOpts.moveFn = rotateMove;
        dragOpts.doneFn = rotateDone;

        if(evt.shift) {
        } else {
        }
    };

    dragElement.init(dragOpts);
}

function pathCircle(r) {
    return Drawing.symbolFuncs[0](r);
}
