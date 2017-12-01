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

    // TODO Hmm. I think I just need one clip path after all ...

    this.clipPaths.circle = fullLayout._clips.append('clipPath')
        .attr('id', clipId + '-circle')
        .append('path');

    this.clipPaths.rect = fullLayout._clips.append('clipPath')
        .attr('id', clipId + '-rect')
        .append('rect');

    this.framework = fullLayout._polarlayer.append('g')
        .attr('class', id)

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
        .attr('class', function(d) { return 'polarlayer ' + d})
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
    var aspectRatio = Math.abs((sectorBBox[3] - sectorBBox[1]) / (sectorBBox[2] - sectorBBox[0]));
    // actual lengths of the polar chart sector
    var xLength2 = Math.min(xLength, xLength / aspectRatio);
    var yLength2 = Math.min(yLength, yLength * aspectRatio);
    // actual domains of the polar chart sector that give a square in px coordinates

     // TODO missing a bit of a gap !!!
    
    var xGap = (xLength - xLength2) / gs.w / 2;
    var xDomain2 = _this.xDomain2 = [xDomain[0] + xGap, xDomain[1] - xGap];
    var yGap = (yLength - yLength2) / gs.h / 2;
    var yDomain2 = _this.yDomain2 = [yDomain[0] + yGap, yDomain[1] - yGap];
    // actual offsets from paper edge to the subplot box top-left corner
    var xOffset2 = _this.xOffset2 = gs.l + gs.w * xDomain2[0];
    var yOffset2 = _this.yOffset2 = gs.t + gs.h * (1 - yDomain2[1]);
    // circle radius in px
//     var radius = _this.radius = computeCircleRadius(xLength2, yLength2, sector);
    var radius = _this.radius = Math.min(xLength2, yLength2) / 2;

    // circle center position in px
    var cx;
    if(sectorBBox[0] === -1) {
        cx = xOffset2 + radius;
    } else if(sectorBBox[2] === 1) {
        cx = xOffset2 + xLength2 - radius;
    } else {
        cx = xOffset2;
    }
    var cy;
    if(sectorBBox[1] === -1) {
        cy = yOffset2 + yLength2 - radius;
    } else if(sectorBBox[3] === 1) {
        cy = yOffset2 + radius;
    } else {
        cy = yOffset2;
    }
    _this.center = [cx, cy];

    // ..
    var rRange = radialLayout.range;
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
        _pos: 0,
        // radialaxis uses 'top'/'bottom' -> convert to 'x' axis equivalent
        // TODO does not work!!
        side: {left: 'top', right: 'bottom'}[radialLayout.side],
        // spans 1/2 of the polar subplot
        domain: [(xDomain2[1] - xDomain2[0]) / 2, xDomain2[1]],

        // dummy truthy value to make Axes.doTicks draw the grid
        _counteraxis: true
    });
    Axes.setConvert(radialAxis, fullLayout);
    radialAxis.setScale();
    //
    radialAxis._datafn = function(d) {
        return [d.text, radialAxis.c2p(d.x), radialLayout.side].join('_');
    };
    //
    radialAxis._gridpath = function(d) {
        var r = radialAxis.c2p(d.x);
        return pathSector(r, sector);
    };
    // TODO we should need to do this
    // why does the custom keyfn does not work??
    layers.radialaxisgrid.selectAll('path').remove();
    layers.radialaxis.selectAll('.xtick').remove();
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
        // to get auto nticks right!
        domain: [0, Math.PI],
        range: sector,
        // ...
        side: 'right',
        zeroline: false,
        _pos: 0,

        // dummy truthy value to make Axes.doTicks draw the grid
        _counteraxis: true
    });
    Axes.setConvert(angularAxis, fullLayout);
    angularAxis.setScale();
    var x2rad = angularAxis.x2rad = function(v) {
        if(angularAxis.type === 'category') {
            return v * 2 * Math.PI / angularAxis._categories.length;
        } else if(angularAxis.type === 'date') {
            var period = angularAxis.period || 365 * 24 * 60 * 60 * 1000;
            return (v % period) * 2 * Math.PI / period;
        }
        return v / 180 * Math.PI;
    }
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
                angle = x2rad(angle) / Math.PI * 180;
            }
            return baseTransform + 'rotate(' + -angle + ')';
        });

    layers.angularline.attr({
        display: angularLayout.showline ? null : 'none',
        d: pathSector(radius, sector) + 'Z',
        transform: strTranslate(cx, cy)
    })
    .attr('stroke-width', angularLayout.linewidth)
    .call(Color.stroke, angularLayout.linecolor);

    Drawing.setTranslate(layers.frontplot, xOffset2, yOffset2);

    layers.bgcircle.attr({
        d: pathSector(radius, sector) + 'Z',
        transform: strTranslate(cx, cy)
    })
    .call(Color.fill, polarLayout.bgcolor);

    _this.clipPaths.circle
        .attr('d', pathSector(radius, sector) + 'Z')
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
        _this.xOffset2, _this.yOffset2, 2 * _this.radius, 2 * _this.radius
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
        var clipDy =  vb[1];

        var plotDx = ax._offset - clipDx / xScaleFactor;
        var plotDy = ax._offset - clipDy / yScaleFactor;

        _this.framework
            .call(Drawing.setTranslate, -plotDx, -plotDy)
//             .call(Drawing.setScale, 1 / xScaleFactor, 1 / yScaleFactor);

        _this.clipPaths.rect
            .call(Drawing.setTranslate, plotDx, plotDy);

        return
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

    var bx = _this.center[0] + (radius + bl2) * Math.cos(angle);
    var by = _this.center[1] - (radius + bl2) * Math.sin(-angle);
    radialDrag3.attr('transform', 'translate(' + bx + ',' + by + ')');

    function rerangePrep(evt, startX, startY) {
        r0 = startX;
    }

    function rerangeMove(dx0) {
        _this.radialAxis.p2c()


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
            'rotate('+ angle + ',' + _this.cx + ',' + _this.cy + ')');
    };

    function rotateDone(dragged) {
        _this.framework.attr('transform', null);

//         var updateObj = {};
//         updateObj[_this.id + '.radialaxis.range[1]'] =
//         Plotly.relayout(gd, )
    };

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
}

function computeSectorBBox(sector) {
    var a0 = wrap360(sector[0]);
    var a1 = wrap360(sector[1]);

    if(a0 === a1) return [-1, -1, 1, 1];

    var x0 = Math.cos(deg2rad(a0));
    var y0 = Math.sin(deg2rad(a0));
    var x1 = Math.cos(deg2rad(a1));
    var y1 = Math.sin(deg2rad(a1));

    if(a0 <= 90 && a1 >= 90) {
        y1 = 1;
    } 
    if(a0 <= 180 && a1 >= 180) {
        x0 = -1;
    }
    if(a0 <= 270 && a1 >= 270) {
        y1 = -1;
    }
    if(a0 <= 0 && a1 >= 0) {
        x1 = 1;
    }

    return [x0, y0, x1, y1];
}

function computeCircleRadius(lx, ly, sector) {
    var a0 = wrap360(sector[0]);
    var a1 = wrap360(sector[1]);
    var n = Math.floor(Math.abs(a1 - a0) / 90); 
    var fact = n >= 2 || n === 0 ? 2 : 1;

//     return ly

    return Math.min(lx, ly) / fact;
}

function deg2rad(deg) {
    return deg / 180 * Math.PI;
}

function wrap360(deg) {
    var out = deg % 360;
    return out < 0 ? out + 360 : out;
}

function pathSector(r, sector) {
    var arc = Math.abs(sector[1] - sector[0]);

    if(arc === 360) {
        return Drawing.symbolFuncs[0](r);
    }

    var a0 = deg2rad(sector[0]);
    var a1 = deg2rad(sector[1]);

    var xs = r * Math.cos(a0);
    var ys = -r * Math.sin(a0);
    var xe = r * Math.cos(a1);
    var ye = -r * Math.sin(a1);

    var flags;

    if(arc === 180) {
        flags = [0, 0, 0];
    } else {
        flags = arc < 180 ? [0, 0, 0] : [0, 1, 1]
    }

    return 'M' + [xs, ys] + 
        'A' + [r, r] + ' ' + flags + ' ' + [xe, ye];
}

function strTranslate(x, y) {
    return 'translate(' + x + ',' + y + ')';
}

function strRotate(angle) {
    return 'rotate(' + angle + ')';
}
