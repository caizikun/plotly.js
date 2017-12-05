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
var PI = Math.PI;
var blankPath = 'M0,0';

var DEBUG = false;

function Polar(gd, id) {
    this.id = id;
    this.gd = gd;

    this.hasClipOnAxisFalse = null;
    this.traceHash = {};
    this.layers = {};
    this.clipPaths = {};

    var fullLayout = gd._fullLayout;
    var polarLayout = fullLayout[id];
    var clipId = this.clipId = 'clip' + fullLayout._uid + id;

    this.clipPaths.circle = fullLayout._clips.append('clipPath')
        .attr('id', clipId + '-circle')
        .append('path');

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

    // will have to do an autorange for date (and maybe category) axes

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
        .attr('class', function(d) { return 'polarlayer ' + d;})
        .each(function(d) {
            var sel = layers[d] = d3.select(this);

            switch(d) {
                case 'frontplot':
                    sel.append('g')
                        .classed('scatterlayer', true)
                        .call(Drawing.setClipUrl, _this.clipId + '-circle');
                    break;
                case 'backplot':
                    sel.append('g').classed('maplayer', true);
                    break;
                case 'plotbg':
                    layers.bgcircle = sel.append('path');

                    if(DEBUG) {
                        layers.debug = sel.append('rect');
                        layers.debug2 = sel.append('rect');
                    }
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
                    axisNames.forEach(function(d) {
                        layers[d] = sel.append('g').classed(d, true);
                    });
                    break;
                case 'lines':
                    layers.radialline = sel.append('line')
                        .classed('radialline', true)
                        .attr('fill', 'none');
                    layers.angularline = sel.append('path')
                        .classed('angularline', true)
                        .attr('fill', 'none');
                    break;
            }
        });

    join.order();
};

proto.updateLayout = function(fullLayout, polarLayout) {
    var _this = this;
    var gd = _this.gd;
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
    // sector to plot
    var sector = polarLayout.sector;
    var sectorBBox = computeSectorBBox(sector);
    var dxSectorBBox = sectorBBox[2] - sectorBBox[0];
    var dySectorBBox = sectorBBox[3] - sectorBBox[1];
    // aspect ratios
    var arDomain = yLength / xLength;
    var arSector = Math.abs(dySectorBBox / dxSectorBBox);
    // actual lengths and domains of subplot box
    var xLength2, yLength2;
    var xDomain2, yDomain2;
    var gap;
    if(arDomain > arSector) {
        xLength2 = xLength;
        yLength2 = xLength * arSector;
        gap = (yLength - yLength2) / gs.h / 2;
        xDomain2 = [xDomain[0], xDomain[1]];
        yDomain2 = [yDomain[0] + gap, yDomain[1] - gap];
    } else {
        xLength2 = yLength / arSector;
        yLength2 = yLength;
        gap = (xLength - xLength2) / gs.w / 2;
        xDomain2 = [xDomain[0] + gap, xDomain[1] - gap];
        yDomain2 = [yDomain[0], yDomain[1]];
    }
    _this.xLength2 = xLength2;
    _this.yLength2 = yLength2;
    _this.xDomain2 = xDomain2;
    _this.yDomain2 = yDomain2;
    // actual offsets from paper edge to the subplot box top-left corner
    var xOffset2 = _this.xOffset2 = gs.l + gs.w * xDomain2[0];
    var yOffset2 = _this.yOffset2 = gs.t + gs.h * (1 - yDomain2[1]);
    // circle radius in px
    var radius = _this.radius = xLength2 / dxSectorBBox;
    // circle center position x position in px
    var cx = _this.cx = xOffset2 - radius * sectorBBox[0];
    // circle center position y position in px
    var cy = _this.cy = yOffset2 + radius * sectorBBox[3];

    if(DEBUG) {
        layers.debug.attr({
            x: xOffset,
            y: yOffset,
            width: xLength,
            height: yLength
        })
        .attr('fill', 'none')
        .attr('stroke-width', '2px')
        .call(Color.stroke, 'red');

        layers.debug2.attr({
            x: xOffset2,
            y: yOffset2,
            width: xLength2,
            height: yLength2
        })
        .attr('fill', 'none')
        .attr('stroke-width', '1px')
        .call(Color.stroke, 'blue');
    }

    var rRange = radialLayout.range;
    var rMax = rRange[1];

    var xaxis = _this.xaxis;
    xaxis.range = [sectorBBox[0] * rMax, sectorBBox[2] * rMax];
    xaxis.domain = xDomain2;
    Axes.setConvert(xaxis, fullLayout);
    xaxis.setScale();
    xaxis.isPtWithinRange = function() {};

    var yaxis = _this.yaxis;
    yaxis.range = [sectorBBox[1] * rMax, sectorBBox[3] * rMax];
    yaxis.domain = yDomain2;
    Axes.setConvert(yaxis, fullLayout);
    yaxis.setScale();
    yaxis.isPtWithinRange = function() { return true; };

    var a0 = wrap360(sector[0]);
    var tickangle = radialLayout.tickangle === 'auto' && (a0 > 90 && a0 <= 270) ?
        180 :
        radialLayout.tickangle;

    var radialAxis = _this.radialaxis = Lib.extendFlat({}, radialLayout, {
        _axislayer: layers.radialaxis,
        _gridlayer: layers.radialaxisgrid,
        // make this an 'x' axis to make positioning (especially rotation) easier
        _id: 'x',
        _pos: 0,
        // radialaxis uses 'top'/'bottom' -> convert to 'x' axis equivalent
        side: {left: 'top', right: 'bottom'}[radialLayout.side],
        // spans length 1 radius
        domain: [0, radius / gs.w],

        // TODO move deeper in doTicks
        tickangle: tickangle,

        // to get _boundingBox computation right when showticklabels is false
        anchor: 'free',
        position: 0,
        // dummy truthy value to make Axes.doTicks draw the grid
        _counteraxis: true
    });
    Axes.setConvert(radialAxis, fullLayout);
    radialAxis.setScale();
    // set special grid path function
    radialAxis._gridpath = function(d) {
        var r = radialAxis.c2p(d.x);
        return pathSector(r, sector);
    };
    Axes.doTicks(gd, radialAxis, true);

    // TODO maybe radial axis should be above frontplot ??

    layers.radialaxis.attr(
        'transform',
        strTranslate(cx, cy) + strRotate(-radialLayout.position)
    );
    layers.radialaxisgrid
        .attr('transform', strTranslate(cx, cy))
        .selectAll('path').attr('transform', null);
    layers.radialline.attr({
        display: radialLayout.showline ? null : 'none',
        x1: 0,
        y1: 0,
        x2: radius,
        y2: 0,
        transform: strTranslate(cx, cy) + strRotate(-radialLayout.position)
    })
    .attr('stroke-width', radialLayout.linewidth)
    .call(Color.stroke, radialLayout.linecolor);

    var angularAxis = _this.angularaxis = Lib.extendFlat({}, angularLayout, {
        // .. !!! ...
        _id: 'angular',
        _axislayer: layers.angularaxis,
        _gridlayer: layers.angularaxisgrid,
        _pos: 0,
        // to get auto nticks right!
        domain: [0, PI],
        range: sector,
        // ...
        side: 'right',
        zeroline: false,
        // to get _boundingBox computation right when showticklabels is false
        anchor: 'free',
        position: 0,
        // dummy truthy value to make Axes.doTicks draw the grid
        _counteraxis: true
    });
    Axes.setConvert(angularAxis, fullLayout);
    angularAxis.setScale();
    var x2rad = angularAxis.x2rad = function(v) {
        if(angularAxis.type === 'category') {
            return v * 2 * PI / angularAxis._categories.length;
        } else if(angularAxis.type === 'date') {
            var period = angularAxis.period || 365 * 24 * 60 * 60 * 1000;
            return (v % period) * 2 * PI / period;
        }
        return deg2rad(v);
    };
    angularAxis._transfn = function(d) {
        var r = radialAxis.range[1];
        var theta = -x2rad(d.x);
        var x = cx + radialAxis.c2p(r * Math.cos(theta));
        var y = cy + radialAxis.c2p(r * Math.sin(theta));
        return 'translate(' + x + ',' + y + ')';
    };
    angularAxis._gridpath = function(d) {
        var r = radialAxis.range[1];
        var theta = -x2rad(d.x);
        var x = radialAxis.c2p(r * Math.cos(theta));
        var y = radialAxis.c2p(r * Math.sin(theta));
        return 'M0,0L' + [-x, -y];
    };
    Axes.doTicks(gd, angularAxis, true);

    layers.angularaxis.selectAll('path.angulartick.ticks')
        .attr('transform', function(d) {
            var baseTransform = d3.select(this).attr('transform');
            var angle = d.x;
            if(angularLayout.type !== 'linear') {
                angle = rad2deg(x2rad(angle));
            }
            return baseTransform + 'rotate(' + -angle + ')';
        });

    layers.angularline.attr({
        display: angularLayout.showline ? null : 'none',
        d: pathSectorClosed(radius, sector),
        transform: strTranslate(cx, cy)
    })
    .attr('stroke-width', angularLayout.linewidth)
    .call(Color.stroke, angularLayout.linecolor);

    Drawing.setTranslate(layers.frontplot, xOffset2, yOffset2);

    layers.bgcircle.attr({
        d: pathSectorClosed(radius, sector),
        transform: strTranslate(cx, cy)
    })
    .call(Color.fill, polarLayout.bgcolor);

    _this.clipPaths.circle
        .attr('d', pathSectorClosed(radius, sector))
        .attr('transform', strTranslate(cx - xOffset2, cy - yOffset2));
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
        _this.xOffset2, _this.yOffset2, _this.xLength2, _this.yLength2
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

    function panDone(dragged, numClicks) {
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
        var xScaleFactor = vb[2] / ax._length;
        var yScaleFactor = vb[3] / ax._length;
        var clipDx = vb[0];
        var clipDy = vb[1];

        var plotDx = ax._offset - clipDx / xScaleFactor;
        var plotDy = ax._offset - clipDy / yScaleFactor;

        _this.framework
            .call(Drawing.setTranslate, -plotDx, -plotDy);
//             .call(Drawing.setScale, 1 / xScaleFactor, 1 / yScaleFactor);

        return;
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
    var radius = _this.radius;
    var angle = deg2rad(polarLayout.radialaxis.position);
    var bl = 50;
    var bl2 = bl / 2;
    var radialDrag = dragBox.makeDragger(layers, 'radialdrag', 'move', -bl2, -bl2, bl, bl);
    var radialDrag3 = d3.select(radialDrag);
    var dragOpts = {element: radialDrag, gd: gd};

    var bx = _this.cx + (radius + bl2) * Math.cos(angle);
    var by = _this.cy - (radius + bl2) * Math.sin(-angle);
    radialDrag3.attr('transform', 'translate(' + bx + ',' + by + ')');

    function rerangePrep(evt, startX, startY) {
        r0 = startX;
    }

    function rerangeMove(dx0) {
        _this.radialAxis.p2c();


    }

    function rerangeDone() {

    }

    var x0, y0, r;

    function rotatePrep(evt, startX, startY) {
        x0 = startX - _this.cx;
        y0 = startY - _this.cy;
    }

    function rotateMove(dx, dy) {
        var x1 = _x1 - bx;
        var y1 = _y1 - by;
        var r = Math.sqrt(x1 * x1, y1 * y1);
        var angle = Math.atan2(y1, x1) / Math.PI * 180;

//         console.log([_x1, _y1], [_this.cx, _this.cy], [x1, y1], angle)

        _this.framework.attr('transform',
            'rotate(' + angle + ',' + _this.cx + ',' + _this.cy + ')');
    }

    function rotateDone(dragged) {
        _this.framework.attr('transform', null);

//         var updateObj = {};
//         updateObj[_this.id + '.radialaxis.range[1]'] =
//         Plotly.relayout(gd, )
    }

    dragOpts.prepFn = function(evt, startX, startY) {
//         rerangePrep(evt, startX, startY);
//         dragOpts.moveFn = rerangeMove;
//         dragOpts.doneFn = rerangeDone;

        rotatePrep(evt, startX, startY);
        dragOpts.moveFn = rotateMove;
        dragOpts.doneFn = rotateDone;

        if(evt.shift) {
        } else {
        }
    };

    dragElement.init(dragOpts);
};

// Finds the bounding box of a given circle sector,
// inspired by https://math.stackexchange.com/q/1852703
//
// assumes:
// - sector[1] < sector[0]
// - counterclockwise rotation
function computeSectorBBox(sector) {
    var s0 = sector[0];
    var s1 = sector[1];
    var arc = s1 - s0;
    var a0 = wrap360(s0);
    var a1 = a0 + arc;

    var ax0 = Math.cos(deg2rad(a0));
    var ay0 = Math.sin(deg2rad(a0));
    var ax1 = Math.cos(deg2rad(a1));
    var ay1 = Math.sin(deg2rad(a1));

    var x0, y0, x1, y1;

    if((a0 <= 90 && a1 >= 90) || (a0 > 90 && a1 >= 450)) {
        y1 = 1;
    } else if(ay0 <= 0 && ay1 <= 0) {
        y1 = 0;
    } else {
        y1 = Math.max(ay0, ay1);
    }

    if((a0 <= 180 && a1 >= 180) || (a0 > 180 && a1 >= 540)) {
        x0 = -1;
    } else if(ax0 >= 0 && ax1 >= 0) {
        x0 = 0;
    } else {
        x0 = Math.min(ax0, ax1);
    }

    if((a0 <= 270 && a1 >= 270) || (a0 > 270 && a1 >= 630)) {
        y0 = -1;
    } else if(ay0 >= 0 && ay1 >= 0) {
        y0 = 0;
    } else {
        y0 = Math.min(ay0, ay1);
    }

    if(a1 >= 360) {
        x1 = 1;
    } else if(ax0 <= 0 && ax1 <= 0) {
        x1 = 0;
    } else {
        x1 = Math.max(ax0, ax1);
    }

    return [x0, y0, x1, y1];
}

function deg2rad(deg) {
    return deg / 180 * PI;
}

function rad2deg(rad) {
    return rad / PI * 180;
}

function wrap360(deg) {
    var out = deg % 360;
    return out < 0 ? out + 360 : out;
}

function pathSector(r, sector) {
    if(isFullCircle(sector)) {
        return Drawing.symbolFuncs[0](r);
    }

    var xs = r * Math.cos(deg2rad(sector[0]));
    var ys = -r * Math.sin(deg2rad(sector[0]));
    var xe = r * Math.cos(deg2rad(sector[1]));
    var ye = -r * Math.sin(deg2rad(sector[1]));

    var arc = Math.abs(sector[1] - sector[0]);
    var flags = arc <= 180 ? [0, 0, 0] : [0, 1, 0];

    return 'M' + [xs, ys] +
        'A' + [r, r] + ' ' + flags + ' ' + [xe, ye];
}

function pathSectorClosed(r, sector) {
    return pathSector(r, sector) +
        (isFullCircle(sector) ?  '' : 'L0,0Z');
}

function isFullCircle(sector) {
    var arc = Math.abs(sector[1] - sector[0]);
    return arc === 360;
}

function strTranslate(x, y) {
    return 'translate(' + x + ',' + y + ')';
}

function strRotate(angle) {
    return 'rotate(' + angle + ')';
}
